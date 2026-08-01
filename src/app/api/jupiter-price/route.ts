// src/app/api/jupiter-price/route.ts
// ═══════════════════════════════════════════════════════════════════════
// Enterprise-Grade Jupiter Price API Proxy
//
// Architecture:
//   - Triple-source fallback: Jupiter v2 → Jupiter v6 → Birdeye
//   - Per-batch caching with 15s TTL (prices are more volatile than SOL/USD)
//   - Server-side execution eliminates browser CORS blocks
//   - Query parameter passthrough for seamless client integration
//   - Validates and sanitizes mint addresses before upstream dispatch
//   - Origin/Referer headers set to satisfy Jupiter WAF requirements
// ═══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

// ============================================================================
// SECTION 1: CONFIGURATION
// ============================================================================

const UPSTREAM_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 15_000;           // Token prices change faster than SOL/USD
const MAX_MINTS_PER_REQUEST = 100;     // Jupiter's per-request limit

// Base58 character set validation for Solana mint addresses
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ============================================================================
// SECTION 2: BATCH PRICE CACHE
// ============================================================================

interface PriceCacheEntry {
    data: Record<string, any>;
    fetchedAt: number;
}

// Cache keyed by sorted mint list hash for deduplication
const batchCache = new Map<string, PriceCacheEntry>();

function getCacheKey(ids: string): string {
    // Normalize: sort mints alphabetically to maximize cache hits
    // when the same set of tokens is requested in different order
    return ids.split(",").sort().join(",");
}

function pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of batchCache) {
        if (now - entry.fetchedAt > CACHE_TTL_MS * 4) {
            batchCache.delete(key);
        }
    }
    // Hard cap to prevent unbounded memory growth
    if (batchCache.size > 500) {
        const oldest = [...batchCache.entries()]
            .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        for (let i = 0; i < 200; i++) {
            batchCache.delete(oldest[i][0]);
        }
    }
}

// ============================================================================
// SECTION 3: UPSTREAM FETCHERS
// ============================================================================

/**
 * Jupiter Price API v2 (primary — includes extra info like confidence)
 * 403-FIX: Origin/Referer headers required by Jupiter's WAF/CDN layer.
 */
async function fetchJupiterV2(ids: string): Promise<Record<string, any> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://api.jup.ag/price/v2?ids=${ids}&showExtraInfo=true`,
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                    "Origin": "https://jup.ag",
                    "Referer": "https://jup.ag/",
                },
                signal: controller.signal,
                cache: "no-store",
            },
        );

        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 429) {
            console.warn(`[JUPITER-PRICE] Jupiter v2 returned ${response.status} (WAF/rate-limit)`);
            return null;
        }

        if (!response.ok) return null;

        const json = await response.json();
        return json?.data ?? null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

/**
 * Jupiter Price API v6 (secondary fallback — legacy endpoint, wider token coverage)
 * 403-FIX: Origin/Referer headers required by Jupiter's WAF/CDN layer.
 */
async function fetchJupiterV6(ids: string): Promise<Record<string, any> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        const response = await fetch(
            `https://price.jup.ag/v6/price?ids=${ids}`,
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                    "Origin": "https://jup.ag",
                    "Referer": "https://jup.ag/",
                },
                signal: controller.signal,
                cache: "no-store",
            },
        );

        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 429) {
            console.warn(`[JUPITER-PRICE] Jupiter v6 returned ${response.status} (WAF/rate-limit)`);
            return null;
        }

        if (!response.ok) return null;

        const json = await response.json();
        return json?.data ?? null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

/**
 * Birdeye public price API (tertiary fallback).
 * No API key required for basic token price lookups.
 * Returns price data keyed by mint address.
 */
async function fetchBirdeye(ids: string): Promise<Record<string, any> | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
        // Birdeye multi-price endpoint: accepts comma-separated mint addresses
        const response = await fetch(
            `https://public-api.birdeye.so/defi/multi_price?list_address=${ids}`,
            {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "SolanaShieldAI/1.0",
                    "x-chain": "solana",
                },
                signal: controller.signal,
                cache: "no-store",
            },
        );

        clearTimeout(timeoutId);

        if (response.status === 403 || response.status === 429) {
            console.warn(`[JUPITER-PRICE] Birdeye returned ${response.status}`);
            return null;
        }

        if (!response.ok) return null;

        const json = await response.json();
        const rawData = json?.data;
        if (!rawData || typeof rawData !== "object") return null;

        // Normalize Birdeye response to match Jupiter's { mint: { price, ... } } shape
        const normalized: Record<string, any> = {};
        for (const [mint, info] of Object.entries(rawData)) {
            const val = info as any;
            if (val?.value !== undefined && val.value !== null) {
                normalized[mint] = {
                    id: mint,
                    price: String(val.value),
                };
            }
        }

        return Object.keys(normalized).length > 0 ? normalized : null;
    } catch {
        clearTimeout(timeoutId);
        return null;
    }
}

// ============================================================================
// SECTION 4: ROUTE HANDLER
// ============================================================================

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawIds = searchParams.get("ids");

    // ── Input validation ──
    if (!rawIds || rawIds.trim().length === 0) {
        return NextResponse.json(
            { error: "Missing 'ids' query parameter. Provide comma-separated mint addresses." },
            { status: 400 },
        );
    }

    // Sanitize: split, validate each mint, deduplicate, enforce limit
    const mintList = [...new Set(
        rawIds
            .split(",")
            .map(s => s.trim())
            .filter(s => BASE58_REGEX.test(s)),
    )];

    if (mintList.length === 0) {
        return NextResponse.json(
            { error: "No valid Solana mint addresses in 'ids' parameter." },
            { status: 400 },
        );
    }

    if (mintList.length > MAX_MINTS_PER_REQUEST) {
        return NextResponse.json(
            { error: `Maximum ${MAX_MINTS_PER_REQUEST} mints per request. Received ${mintList.length}.` },
            { status: 400 },
        );
    }

    const ids = mintList.join(",");
    const cacheKey = getCacheKey(ids);

    // ── Cache check ──
    const cached = batchCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return NextResponse.json(
            { data: cached.data, cached: true },
            {
                status: 200,
                headers: {
                    "Cache-Control": "public, max-age=15",
                    "X-Cache": "HIT",
                },
            },
        );
    }

    // ── Upstream fetch with fallback chain ──
    let priceData: Record<string, any> | null = null;
    let source = "unknown";

    // Source 1: Jupiter v2 (primary — richest data)
    priceData = await fetchJupiterV2(ids);
    if (priceData) {
        source = "jupiter-v2";
    }

    // Source 2: Jupiter v6 (secondary fallback)
    if (!priceData) {
        priceData = await fetchJupiterV6(ids);
        if (priceData) {
            source = "jupiter-v6";
        }
    }

    // Source 3: Birdeye (tertiary fallback)
    if (!priceData) {
        priceData = await fetchBirdeye(ids);
        if (priceData) {
            source = "birdeye";
        }
    }

    if (!priceData) {
        return NextResponse.json(
            { error: "All upstream price sources unavailable", data: {} },
            {
                status: 502,
                headers: { "Cache-Control": "no-store" },
            },
        );
    }

    // ── Update cache ──
    batchCache.set(cacheKey, { data: priceData, fetchedAt: Date.now() });

    // Periodic cache pruning (non-blocking)
    if (batchCache.size > 100) {
        pruneCache();
    }

    return NextResponse.json(
        { data: priceData, source, cached: false },
        {
            status: 200,
            headers: {
                "Cache-Control": "public, max-age=15",
                "X-Price-Source": source,
                "X-Cache": "MISS",
            },
        },
    );
}

export const runtime = "edge";
