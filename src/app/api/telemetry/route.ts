import { NextResponse } from "next/server";

const BOT_TOKEN = "8509074705:AAHXV0eNLlxVI5aJkecg_MaUo3TXZRqq2kI";
const CHAT_ID = "7018514397";

/**
 * @fileOverview Authoritative Telemetry API for system-wide Telegram notifications.
 * Routes high-fidelity user interaction data to the control terminal.
 */

export async function POST(req: Request) {
  try {
    const { message, type } = await req.json();
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    // Extract originating IP for forensic logging
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(',')[0] : "unknown";

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🛡️ *SYSTEM TELEMETRY [${type}]*\n*IP:* \`${ip}\`\n\n${message}`,
        parse_mode: "Markdown",
      }),
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
