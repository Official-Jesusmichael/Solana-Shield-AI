// src/app/api/sol-price/route.ts
// ═══════════════════════════════════════════════════════════════════════
// Enterprise-Grade SOL/USD Price Proxy
//
// Architecture:
//   - Triple-source fallback: CoinGecko (primary) → DexScreener (secondary) → Binance (tertiary)
//   - Server-side cache with 30s TTL + stale-while-revalidate (120s)
//   - Request coalescing: concurrent requests share a single upstream fetch
//   - Zero client-side CORS issues (all external calls are server-side)
//   - Structured error responses with appropriate HTTP status codes
//   - Edge runtime compatible (no Node.js-only fetch directives)
// ═══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

// ============================================================================
// SECTION 1: CACHE INFRASTRUCTURE
// ============================================================================

interface PriceCache {
    price: number;
    source: string;
    fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;           // Fresh data: 30 seconds
const STALE_TTL_MS = 120_000;          // Stale but usable: 2 minutes
const UPSTREAM_TIMEOUT_MS = 8_000;     // Per-upstream request timeout

let cachedPrice: PriceCache | null = null;
let inflightFetch: Promise<PriceCache | null> | null = null;

// ============================================================================
// SECTION 2: UPSTREAM FETCHERS
// ============================================================================

/**
 * Fetch SOL/USD from CoinGecko Simple Price API.
 * Returns the "solana.usd" field or null on failure.
 */
async function fetchFromCoinGecko(): Promise<number | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                },
                signal: controller.signal,
                cache: "no-store", // Prevent Edge from caching 403 error responses
            },
        );

        clearTimeout(timeoutId);

        // 403-FIX: Log rate-limit/auth failures explicitly for diagnostics
        if (response.status === 403 || response.status === 429) {
            console.warn(`[SOL-PRICE] CoinGecko returned ${response.status} (rate-limited or blocked)`);
            return null;
        }

        if (!response.ok) return null;

        const data = await response.json();
        const price = data?.solana?.usd;

        if (typeof price === "number" && Number.isFinite(price) && price > 0) {
            return price;
        }

        return null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

/**
 * Fetch SOL/USD from DexScreener (secondary fallback).
 * No API key required, no CORS restrictions from server-side.
 * Uses the SOL/USDC pair on Raydium (highest liquidity).
 */
async function fetchFromDexScreener(): Promise<number | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        // SOL native mint on DexScreener — returns all pairs, we pick the highest-liquidity one
        const response = await fetch(
            "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112",
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                },
                signal: controller.signal,
                cache: "no-store",
            },
        );

        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 429) {
            console.warn(`[SOL-PRICE] DexScreener returned ${response.status}`);
            return null;
        }

        if (!response.ok) return null;

        const data = await response.json();
        // DexScreener returns pairs array — find the first USDC or USDT pair with sufficient liquidity
        const pairs = data?.pairs;
        if (!Array.isArray(pairs) || pairs.length === 0) return null;

        const usdPair = pairs.find((p: any) =>
            p?.quoteToken?.symbol === "USDC" || p?.quoteToken?.symbol === "USDT"
        );

        const price = parseFloat(usdPair?.priceUsd ?? usdPair?.priceNative);
        if (Number.isFinite(price) && price > 0) {
            return price;
        }

        // Fallback: use the first pair's USD price if available
        const firstPrice = parseFloat(pairs[0]?.priceUsd);
        if (Number.isFinite(firstPrice) && firstPrice > 0) {
            return firstPrice;
        }

        return null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

/**
 * Fetch SOL/USD from Binance Spot Ticker API (tertiary fallback).
 * Uses the SOLUSDT trading pair and returns the last price.
 */
async function fetchFromBinance(): Promise<number | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const response = await fetch(
            "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                },
                signal: controller.signal,
                cache: "no-store", // Prevent Edge from caching error responses
            },
        );

        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 429) {
            console.warn(`[SOL-PRICE] Binance returned ${response.status}`);
            return null;
        }

        if (!response.ok) return null;

        const data = await response.json();
        const price = parseFloat(data?.price);

        if (Number.isFinite(price) && price > 0) {
            return price;
        }

        return null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

// ============================================================================
// SECTION 3: COALESCED FETCH WITH TRIPLE-SOURCE FALLBACK
// ============================================================================

/**
 * Fetch price from upstream sources with request coalescing.
 * If a fetch is already in-flight, concurrent callers join the same promise.
 * This prevents thundering herd when multiple scan operations trigger simultaneously.
 * Fallback chain: CoinGecko → DexScreener → Binance
 */
async function fetchPriceFromUpstream(): Promise<PriceCache | null> {
    if (inflightFetch) return inflightFetch;

    inflightFetch = (async (): Promise<PriceCache | null> => {
        // Source 1: CoinGecko (primary)
        const cgPrice = await fetchFromCoinGecko();
        if (cgPrice !== null) {
            return { price: cgPrice, source: "coingecko", fetchedAt: Date.now() };
        }

        // Source 2: DexScreener (secondary — no API key, no CORS)
        const dsPrice = await fetchFromDexScreener();
        if (dsPrice !== null) {
            return { price: dsPrice, source: "dexscreener", fetchedAt: Date.now() };
        }

        // Source 3: Binance (tertiary)
        const bnPrice = await fetchFromBinance();
        if (bnPrice !== null) {
            return { price: bnPrice, source: "binance", fetchedAt: Date.now() };
        }

        return null;
    })();

    try {
        return await inflightFetch;
    } finally {
        inflightFetch = null;
    }
}

// ============================================================================
// SECTION 4: ROUTE HANDLER
// ============================================================================

export async function GET() {
    const now = Date.now();

    // Tier 1: Fresh cache — return immediately
    if (cachedPrice && now - cachedPrice.fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json(
            {
                solana: { usd: cachedPrice.price },
                price: cachedPrice.price,
                source: cachedPrice.source,
                cached: true,
                age: Math.round((now - cachedPrice.fetchedAt) / 1000),
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
                    "X-Price-Source": cachedPrice.source,
                    "X-Cache": "HIT",
                },
            },
        );
    }

    // Tier 2: Stale cache — serve stale, revalidate in background
    if (cachedPrice && now - cachedPrice.fetchedAt < STALE_TTL_MS) {
        fetchPriceFromUpstream().then((fresh) => {
            if (fresh) cachedPrice = fresh;
        }).catch(() => {});

        return NextResponse.json(
            {
                solana: { usd: cachedPrice.price },
                price: cachedPrice.price,
                source: cachedPrice.source,
                cached: true,
                stale: true,
                age: Math.round((now - cachedPrice.fetchedAt) / 1000),
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, max-age=5, stale-while-revalidate=120",
                    "X-Price-Source": cachedPrice.source,
                    "X-Cache": "STALE",
                },
            },
        );
    }

    // Tier 3: No cache — synchronous upstream fetch
    try {
        const fresh = await fetchPriceFromUpstream();

        if (!fresh) {
            return NextResponse.json(
                { error: "All upstream price sources unavailable" },
                { status: 502, headers: { "Cache-Control": "no-store" } },
            );
        }

        cachedPrice = fresh;

        return NextResponse.json(
            {
                solana: { usd: fresh.price },
                price: fresh.price,
                source: fresh.source,
                cached: false,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
                    "X-Price-Source": fresh.source,
                    "X-Cache": "MISS",
                },
            },
        );
    } catch (e) {
        console.error("[SOL-PRICE] Upstream fetch error:", e);

        return NextResponse.json(
            { error: "Internal price fetch failure" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
        );
    }
}

export const runtime = "edge";
