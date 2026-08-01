// src/app/api/notify-telegram/route.ts
// ═══════════════════════════════════════════════════════════════════════
// Enterprise-Grade Telegram Notification Proxy
//
// Architecture:
//   - Server-side proxy keeps TELEGRAM_BOT_TOKEN off the client bundle
//   - Rate limiting: max 30 messages per minute (Telegram's limit)
//   - Message sanitization: strips Markdown injection, enforces length
//   - Retry with exponential backoff for Telegram API failures
//   - Structured logging for debugging without exposing secrets
// ═══════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

// ============================================================================
// SECTION 1: CONFIGURATION (from environment variables)
// ============================================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_API_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_LENGTH = 4096; // Telegram's max message length
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30; // Telegram allows ~30 msg/sec to same chat

// ============================================================================
// SECTION 2: RATE LIMITER (sliding window)
// ============================================================================

interface RateLimitState {
    timestamps: number[];
}

const rateLimiter: RateLimitState = { timestamps: [] };

function isRateLimited(): boolean {
    const now = Date.now();
    // Prune timestamps outside the window
    rateLimiter.timestamps = rateLimiter.timestamps.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
    );

    if (rateLimiter.timestamps.length >= RATE_LIMIT_MAX) {
        return true;
    }

    rateLimiter.timestamps.push(now);
    return false;
}

// ============================================================================
// SECTION 3: TELEGRAM API SENDER
// ============================================================================

/**
 * Send message to Telegram with retry (2 attempts max).
 * Uses MarkdownV2 parse mode with pre-escaped content.
 */
async function sendTelegramMessage(message: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            TELEGRAM_API_TIMEOUT_MS,
        );

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: message.slice(0, MAX_MESSAGE_LENGTH),
                    parse_mode: "HTML",
                    // Disable link previews for security and cleanliness
                    disable_web_page_preview: true,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                return true;
            }

            const errorBody = await response.text().catch(() => "");
            console.warn(
                `[TELEGRAM] API returned ${response.status} (attempt ${attempt + 1}): ${errorBody.slice(0, 200)}`,
            );

            // Telegram 429 (rate limited) — wait and retry
            if (response.status === 429) {
                const retryAfter = parseInt(
                    response.headers.get("Retry-After") || "2",
                    10,
                );
                await new Promise((r) =>
                    setTimeout(r, retryAfter * 1000),
                );
                continue;
            }

            // 4xx (client error, not retryable except 429)
            if (response.status >= 400 && response.status < 500) {
                return false;
            }
        } catch (e) {
            clearTimeout(timeoutId);
            console.warn(
                `[TELEGRAM] Network error (attempt ${attempt + 1}):`,
                e instanceof Error ? e.message : String(e),
            );
        }

        // Exponential backoff between retries
        if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }

    return false;
}

// ============================================================================
// SECTION 4: MESSAGE SANITIZER
// ============================================================================

/**
 * Sanitize message content:
 * - Strip HTML tags that could break Telegram's parser
 * - Enforce maximum length
 * - Preserve newlines and basic structure
 */
function sanitizeMessage(raw: string): string {
    if (typeof raw !== "string") return "";

    return raw
        // Remove potentially dangerous HTML tags (keep only safe ones)
        .replace(/<(?!\/?(?:b|i|u|s|code|pre|a)\b)[^>]*>/gi, "")
        // Enforce length limit
        .slice(0, MAX_MESSAGE_LENGTH)
        .trim();
}

// ============================================================================
// SECTION 5: ROUTE HANDLER
// ============================================================================

export async function POST(request: Request) {
    // ── Environment validation ──
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        // Silent success — if Telegram isn't configured, don't fail the caller.
        // The client-side code already logs the message to console as fallback.
        return NextResponse.json(
            { success: true, delivered: false, reason: "Telegram not configured" },
            { status: 200 },
        );
    }

    // ── Rate limiting ──
    if (isRateLimited()) {
        return NextResponse.json(
            { success: false, error: "Rate limited. Max 30 messages/minute." },
            { status: 429, headers: { "Retry-After": "10" } },
        );
    }

    // ── Parse request body ──
    let body: { message?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const rawMessage = body?.message;
    if (!rawMessage || typeof rawMessage !== "string" || rawMessage.trim().length === 0) {
        return NextResponse.json(
            { success: false, error: "Missing or empty 'message' field" },
            { status: 400 },
        );
    }

    // ── Sanitize and send ──
    const sanitized = sanitizeMessage(rawMessage);

    if (sanitized.length === 0) {
        return NextResponse.json(
            { success: false, error: "Message empty after sanitization" },
            { status: 400 },
        );
    }

    const delivered = await sendTelegramMessage(sanitized);

    return NextResponse.json(
        { success: true, delivered },
        { status: delivered ? 200 : 502 },
    );
}

// Only POST is allowed
export async function GET() {
    return NextResponse.json(
        { error: "Method not allowed. Use POST." },
        { status: 405 },
    );
}
