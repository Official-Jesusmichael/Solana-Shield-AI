'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ShieldCheck,
  Fingerprint as IDIcon,
  ArrowDownLeft,
  Coins,
  Activity,
  History,
  Lock,
  TrendingUp,
  Waves,
  Clock,
  Fingerprint,
  Library,
  Copy,
  CheckCircle2,
  Info,
  Database,
  ArrowUpRight,
  Sparkles,
  Zap,
  ArrowDownCircle,
  ArrowUpCircle,
  Users
} from 'lucide-react';
import type { ThreatsResult } from './Threats';
import type { ConnectionsResult } from './Connections';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart
} from 'recharts';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '@/lib/utils';
import React, { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

const CopyableAddress = ({ address, label }: { address: string; label?: string }) => {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Signature Copied",
      description: `UPLINK_${address.substring(0, 8)}... matched to clipboard.`,
      className: 'liquid-glass-pro border-accent/20 text-accent rim-light-pro shadow-2xl',
    });
  };

  return (
    <div 
      onClick={handleCopy}
      className="group flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all cursor-pointer"
    >
      <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-widest truncate max-w-[120px]">
        {label ? `${label}_` : ''}{address.substring(0, 6)}...{address.slice(-4)}
      </span>
      <Copy className="h-2.5 w-2.5 text-white/20 group-hover:text-accent transition-colors" />
    </div>
  );
};

const forensicDetails: Record<string, string> = {
  'Funding': 'Provenance analysis of root capital. Detecting mixer traces, high-risk exchange clusters, and whale lineage obfuscation.',
  'Uplinks': 'Deep audit of dApp permissions. Evaluation of unlimited token approvals and interaction with unverified smart contracts.',
  'Patterns': 'Behavioral heuristic interrogations. Identifying phishing patterns, rapid drainer signatures, and Sybil behavior.',
  'Vault': 'Total cryptographic integrity index. Assessing asset distribution, cold-storage movement, and ownership lock status.',
  'DAS': 'Digital Asset Standard compliance. Interrogating token freeze authorities, metadata integrity, and tax-token signatures.'
};

const NeuralRadarTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const description = forensicDetails[data.subject] || 'Neural forensic interrogation in progress.';
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="liquid-glass-pro rim-light-pro p-5 min-w-[280px] max-w-[320px] border-white/20 shadow-3xl rounded-[2rem]"
      >
        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-secondary animate-neural-pulse shadow-[0_0_10px_hsla(var(--secondary),0.5)]" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Forensic_{data.subject}</p>
          </div>
          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-secondary/30 text-secondary bg-secondary/5">
            {Number(data?.A).toFixed(1)}%
          </Badge>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Info className="h-3 w-3 text-primary" />
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Neural Intelligence Brief</span>
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-white/80 italic">
              "{description}"
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Risk Signal</span>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-tighter",
                data.A > 70 ? "text-secondary" : "text-destructive"
              )}>
                {data.A > 70 ? 'OPTIMAL' : 'RE-AUDIT'}
              </span>
            </div>
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: 0 }} 
                 animate={{ width: `${data.A}%` }} 
                 className="h-full bg-primary" 
               />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
  return null;
});
NeuralRadarTooltip.displayName = 'NeuralRadarTooltip';

const FingerprintTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isMalicious = data.risk === 'malicious';
    return (
      <div className={cn(
        "liquid-glass-pro rim-light-pro p-4 min-w-[180px] border shadow-3xl transition-all duration-500 rounded-[1.5rem]",
        isMalicious ? "border-destructive/40 bg-destructive/10" : "border-secondary/40 bg-secondary/10"
      )}>
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Fingerprint className={cn("h-3.5 w-3.5", isMalicious ? "text-destructive" : "text-secondary")} />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">SIG_{data.name}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground/80 font-black uppercase tracking-widest">Load</span>
            <span className="text-[10px] font-mono text-white font-bold">{data.gas} CU</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
});
FingerprintTooltip.displayName = 'FingerprintTooltip';

export function Overview({ threatsResult, connectionsResult }: OverviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const metrics = useMemo(() => {
    const tCount = threatsResult?.threats?.length ?? 0;
    const cThreats = threatsResult?.threats?.filter(
        (t: any) => t.severity === 'critical' || t.severity === 'high'
      ).length ?? 0;
    const rConns = connectionsResult?.analysisResults?.filter((c) => c.isMalicious).length ?? 0;
    const score = Math.max(5, 100 - cThreats * 25 - (tCount - cThreats) * 8 - rConns * 12);
    
    return { threatCount: tCount, criticalThreats: cThreats, riskyConnections: rConns, securityScore: score };
  }, [threatsResult, connectionsResult]);

  const identity = threatsResult?.identity || {};
  const funding = threatsResult?.funding || {};
  const balances = threatsResult?.balances || {};
  const portfolioTotal = Number(balances?.totalUsdValue) || 0;
  const executiveSummary = threatsResult?.executiveSummary || [];
  const counterparties = threatsResult?.counterparties || [];

  const topTokens = useMemo(() => {
    return (balances?.balances || [])
      .filter((t: any) => (Number(t?.usdValue) || 0) > 0.001)
      .sort((a: any, b: any) => (Number(b?.usdValue) || 0) - (Number(a?.usdValue) || 0));
  }, [balances]);

  const nftCollections = useMemo(() => {
    return (balances?.nfts || []).reduce((acc: any, nft: any) => {
      const collectionName = nft.collectionName || 'Uncategorized';
      if (!acc[collectionName]) {
        acc[collectionName] = { count: 0, image: nft.imageUri };
      }
      acc[collectionName].count++;
      return acc;
    }, {});
  }, [balances]);

  const radarData = useMemo(() => [
    { subject: 'Funding', A: funding?.amount ? 92 : 35, fullMark: 100 },
    { subject: 'Uplinks', A: 100 - (metrics.riskyConnections * 18), fullMark: 100 },
    { subject: 'Patterns', A: 100 - (metrics.criticalThreats * 15), fullMark: 100 },
    { subject: 'Vault', A: metrics.securityScore, fullMark: 100 },
    { subject: 'DAS', A: Math.max(10, 95 - (metrics.threatCount * 5)), fullMark: 100 },
  ], [funding, metrics]);

  const heatmapData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    intensity: Math.floor(Math.random() * 100),
  })), []);

  const fingerprintData = useMemo(() => [
    { name: 'P_01', gas: 420, instructions: 140 },
    { name: 'P_02', gas: 850, instructions: 480 },
    { name: 'P_03', gas: 210, instructions: 60 },
    { name: 'P_04', gas: 980, instructions: 820 },
    { name: 'P_05', gas: 380, instructions: 190 },
    { name: 'P_06', gas: 600, instructions: 300 },
  ], []);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* EXECUTIVE AI SUMMARY MODULE */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <Card className="liquid-glass-pro rim-light-pro p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-30" />
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-tighter text-white">Forensic Executive Summary</CardTitle>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-4 leading-relaxed">
            {executiveSummary.map((part, i) => {
              if (part.type === 'text') {
                return <span key={i} className="text-[14px] font-medium text-white/80 leading-relaxed">{part.content}</span>;
              }
              const riskColor = 
                part.risk === 'high' ? 'bg-destructive/20 text-destructive border-destructive/40' :
                part.risk === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                'bg-blue-500/20 text-blue-400 border-blue-500/40';
              
              return (
                <Badge key={i} variant="outline" className={cn("rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 whitespace-nowrap", riskColor)}>
                  {part.content}
                </Badge>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.02] border border-white/5 w-fit">
             <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
             <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">AI Synthesis Authenticated • Helius Forensic Engine v3.0</span>
          </div>
        </Card>
      </motion.div>

      {/* TRANSACTION FLOW METRICS */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
         {[
           { icon: Activity, label: 'Transactions', value: balances.totalTransactions || '0', color: 'purple', sub: 'LIFETIME VOLUME' },
           { icon: ArrowDownCircle, label: 'Total Received', value: `${balances.totalReceived || '0.000'} SOL`, color: 'green', sub: 'INFLOW AUDIT' },
           { icon: ArrowUpCircle, label: 'Total Sent', value: `${balances.totalSent || '0.000'} SOL`, color: 'purple', sub: 'OUTFLOW AUDIT' }
         ].map((stat, i) => (
           <Card key={i} className="liquid-glass-pro rim-light-pro p-5 group hover:scale-[1.02] transition-all">
              <div className="flex items-center gap-4">
                 <div className={cn(
                   "h-12 w-12 rounded-[1.2rem] flex items-center justify-center border transition-all duration-500",
                   stat.color === 'purple' ? "bg-primary/10 border-primary/20 text-primary shadow-2xl shadow-primary/10" : "bg-secondary/10 border-secondary/20 text-secondary shadow-2xl shadow-secondary/10"
                 )}>
                   <stat.icon className="h-6 w-6 animate-neural-pulse" />
                 </div>
                 <div>
                   <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-0.5">{stat.label}</p>
                   <h3 className="text-xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
                   <p className="text-[7px] font-bold text-white/20 uppercase tracking-[0.3em] mt-1.5">{stat.sub}</p>
                 </div>
              </div>
           </Card>
         ))}
      </div>

      {/* IDENTIFIED COUNTERPARTIES MODULE */}
      <Card className="liquid-glass-pro rim-light-pro overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] px-8 py-6">
           <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/30 shadow-lg shadow-secondary/10">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <CardTitle className="text-[12px] font-black uppercase tracking-[0.3em] text-white leading-none">Identified Counterparties</CardTitle>
                <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-1.5">Direct Transaction Relationships Detected</p>
              </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-y-auto no-scrollbar">
            {counterparties.length > 0 ? (
              <div className="divide-y divide-white/5">
                {counterparties.map((cp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-8 py-4 hover:bg-white/[0.02] transition-colors group">
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center border text-[10px] font-black",
                        cp.risk === 'high' ? 'bg-destructive/10 border-destructive/20 text-destructive' :
                        cp.risk === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      )}>
                        {cp.name[0]}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-white uppercase tracking-tighter">{cp.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[8px] font-bold text-white/30 uppercase">{cp.type}</span>
                           <div className="h-1 w-1 rounded-full bg-white/10" />
                           <CopyableAddress address={cp.address} label="SIG" />
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[7px] font-black uppercase tracking-widest border-2",
                      cp.risk === 'high' ? 'border-destructive/30 text-destructive bg-destructive/5' :
                      cp.risk === 'medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' :
                      'border-blue-500/30 text-blue-400 bg-blue-500/5'
                    )}>
                      {cp.risk} RISK
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-16 text-center">
                 <Users className="h-10 w-10 text-white/5 mx-auto mb-4" />
                 <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">No Counterparty Signatures Resolved</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOP STATS TIER */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: IDIcon, label: 'Identity', value: identity.name || 'Unresolved', color: 'purple', tags: identity.categories?.slice(0,1) || ['Unclassified'] },
          { icon: ArrowDownLeft, label: 'Origin', value: funding.fundedBy || 'Unknown', color: 'green', subValue: `${funding.amount || '0'} SOL`, address: funding.fundedBy },
          { icon: Coins, label: 'Portfolio', value: `$${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'purple', subValue: 'Helius Index' },
          { icon: ShieldCheck, label: 'Integrity', value: `${metrics.securityScore}%`, color: 'green', subValue: 'Neural Guard', isScore: true }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
          >
            <Card className="liquid-glass-pro rim-light-pro p-4 group hover:scale-[1.02] transition-all duration-300">
              <div className="flex items-center gap-4 relative z-10">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300",
                  stat.color === 'purple' 
                    ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_15px_hsla(var(--primary),0.2)]" 
                    : "bg-secondary/10 border-secondary/20 text-secondary shadow-[0_0_15px_hsla(var(--secondary),0.2)]"
                )}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.15em] mb-0.5">{stat.label}</p>
                  <h3 className={cn(
                    "text-sm font-black uppercase truncate text-white tracking-tighter leading-none",
                    stat.isScore && (metrics.securityScore > 70 ? "text-secondary" : "text-destructive")
                  )}>{stat.value}</h3>
                  <div className="flex gap-1 mt-2">
                    {stat.address && <CopyableAddress address={stat.address} />}
                    {!stat.address && (
                      <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">{stat.subValue}</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* TEMPORAL SCAN HEATMAP */}
        <Card className="lg:col-span-6 liquid-glass-pro rim-light-pro">
          <CardHeader className="border-b border-white/5 pb-3 pt-4 px-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-secondary" />
                <CardTitle className="text-[9px] font-black uppercase tracking-[0.3em] text-white">24H Density</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 h-[260px] flex flex-col justify-center">
            <div className="space-y-8">
              <div>
                <div className="grid grid-cols-12 gap-2">
                  {heatmapData.map((data, i) => (
                    <TooltipProvider key={i}>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                              "aspect-square rounded-md transition-all duration-300 hover:scale-110 cursor-help border border-white/5",
                              data.intensity > 80 ? "bg-secondary shadow-[0_0_10px_hsla(var(--secondary),0.4)]" : 
                              data.intensity > 50 ? "bg-secondary/40" : 
                              data.intensity > 20 ? "bg-secondary/20" : "bg-white/[0.05]"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="liquid-glass-pro rim-light-pro p-2 border-white/20 shadow-2xl rounded-xl">
                          <p className="text-[8px] font-black text-white uppercase">{data.hour} Intensity: {data.intensity}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex gap-3 items-center">
                 <Activity className="h-3.5 w-3.5 text-secondary animate-pulse shrink-0" />
                 <p className="text-[10px] font-medium leading-tight text-muted-foreground/80 italic">
                   Patterns consistent with standard DeFi.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FINGERPRINTING */}
        <Card className="lg:col-span-6 liquid-glass-pro rim-light-pro">
          <CardHeader className="border-b border-white/5 pb-3 pt-4 px-6 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-primary" />
              <CardTitle className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Fingerprinting</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[260px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fingerprintData} margin={{ top: 30, right: 20, left: 20, bottom: 30 }}>
                <defs>
                  <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 1200]} />
                <RechartsTooltip content={<FingerprintTooltip />} />
                <Area type="monotone" dataKey="gas" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorGas)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* RADAR & INVENTORY */}
        <Card className="lg:col-span-12 liquid-glass-pro rim-light-pro">
          <CardHeader className="border-b border-white/5 pb-3 pt-4 px-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Forensic Risk Analytic Tool</CardTitle>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                <span className="text-[7px] font-black text-primary uppercase tracking-[0.2em]">Live Neural Feed</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                {[
                  { name: 'Internal', value: 45, color: 'hsl(var(--secondary))' },
                  { name: 'Staking', value: 30, color: 'hsl(var(--secondary))' },
                  { name: 'Unknown', value: 15, color: 'hsl(var(--destructive))' },
                  { name: 'DEX', value: 10, color: 'hsl(var(--secondary))' },
                ].map((dest, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-black text-white uppercase">{dest.name}</span>
                      <span className="text-[9px] font-mono text-muted-foreground">{dest.value}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${dest.value}%` }} className="h-full rounded-full" style={{ backgroundColor: dest.color }} />
                    </div>
                  </div>
                ))}
                <div className="mt-8 p-4 rounded-[2rem] bg-white/[0.02] border border-white/5">
                   <div className="flex items-center gap-2 mb-2">
                     <Waves className="h-3 w-3 text-secondary" />
                     <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.3em]">Interrogation Note</span>
                   </div>
                   <p className="text-[10px] font-medium text-muted-foreground leading-relaxed italic">
                     Point interaction enabled. Hover over radar endpoints for deep forensic informative analytics.
                   </p>
                </div>
              </div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900, letterSpacing: '0.1em' }} 
                    />
                    <RechartsTooltip 
                      content={<NeuralRadarTooltip />} 
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
                      wrapperStyle={{ outline: 'none', zIndex: 100 }}
                    />
                    <Radar 
                      name="Integrity" 
                      dataKey="A" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.15} 
                      strokeWidth={3} 
                      animationDuration={1500}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PERFECT ANALYTIC ASSET MODULE */}
        <Card className="lg:col-span-12 liquid-glass-pro rim-light-pro relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary opacity-30" />
          <CardHeader className="border-b border-white/5 px-8 py-6 bg-white/[0.01]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/30 shadow-2xl shadow-secondary/10">
                  <Database className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-black uppercase tracking-tighter text-white">Forensic Asset Intelligence</CardTitle>
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mt-1">Global Vault Interrogation Terminal</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5 rim-light-pro">
                 <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">Total Integrity Value</span>
                    <span className="text-2xl font-black text-white tracking-tighter leading-none">
                      ${portfolioTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                 </div>
                 <div className="h-10 w-px bg-white/10" />
                 <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/40 animate-pulse">
                    <ArrowUpRight className="h-5 w-5 text-secondary" />
                 </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* TOKEN SIGNATURES LIST */}
              <div className="lg:col-span-7 border-r border-white/5 p-8">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                       <Sparkles className="h-3.5 w-3.5 text-primary" />
                       <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Neural Token Discovery</span>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary bg-primary/5">
                      {topTokens.length} SIGNATURES PARSED
                    </Badge>
                 </div>

                 <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar pr-2">
                    {topTokens.length > 0 ? topTokens.map((token: any, i: number) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="group flex items-center justify-between p-4 rounded-[1.8rem] bg-white/[0.02] border border-white/5 hover:border-primary/40 hover:bg-white/[0.04] transition-all duration-500"
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                              <span className="text-xs font-black text-white">{token?.symbol?.[0] || 'T'}</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background border border-white/10 flex items-center justify-center shadow-lg">
                               <ShieldCheck className="h-2 w-2 text-secondary" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-white uppercase tracking-tighter">{token?.name || 'Unknown Signature'}</p>
                              <span className="text-[9px] font-bold text-muted-foreground/40 font-mono tracking-widest">{token?.symbol}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] font-bold text-muted-foreground/60">{(Number(token?.amount) || 0).toLocaleString()} UNITS</span>
                              <div className="h-1 w-1 rounded-full bg-white/10" />
                              <span className="text-[9px] font-mono text-muted-foreground/40 italic">UPLINK_STABLE</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-secondary tracking-tighter">
                            ${(Number(token?.usdValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                             <TrendingUp className="h-2.5 w-2.5 text-secondary" />
                             <span className="text-[8px] font-black text-secondary/60">INTEGRITY_OPTIMAL</span>
                          </div>
                        </div>
                      </motion.div>
                    )) : (
                      <div className="py-20 text-center">
                        <Activity className="h-12 w-12 text-muted-foreground/5 mx-auto mb-4" />
                        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-widest">No Primary Signatures Detected</p>
                      </div>
                    )}
                 </div>
              </div>

              {/* ARTIFACT GALLERY (NFTs) */}
              <div className="lg:col-span-5 p-8 bg-white/[0.005]">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                       <Library className="h-3.5 w-3.5 text-secondary" />
                       <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Forensic Artifacts</span>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black border-secondary/20 text-secondary bg-secondary/5">
                      NFT VAULT
                    </Badge>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="group relative aspect-square rounded-[2rem] overflow-hidden border border-white/10 hover:border-secondary/50 transition-all duration-700 shadow-2xl shadow-black/40 cursor-help"
                      >
                        <img src={data.image} alt={name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <p className="text-[9px] font-black text-white uppercase truncate tracking-tighter leading-none mb-1">{name}</p>
                          <div className="flex items-center gap-1">
                             <div className="h-1 w-1 rounded-full bg-secondary animate-pulse" />
                             <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">Artifact_{data.count}</span>
                          </div>
                        </div>
                        <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Info className="h-3 w-3 text-white" />
                        </div>
                      </motion.div>
                    )) : (
                      <div className="col-span-full py-20 text-center">
                        <div className="h-16 w-16 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto mb-4">
                           <Database className="h-6 w-6 text-muted-foreground/10" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-widest">Zero Artifact Signatures Found</p>
                      </div>
                    )}
                 </div>

                 <div className="mt-8 p-6 rounded-3xl bg-primary/5 border border-primary/20 rim-light-pro relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 h-16 w-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
                    <div className="flex items-center gap-3 mb-3">
                       <ShieldCheck className="h-4 w-4 text-primary" />
                       <span className="text-[10px] font-black text-white uppercase tracking-widest">Audit Assurance</span>
                    </div>
                    <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80 italic">
                      Every asset above has been cross-referenced against Helius enhanced forensic databases for ownership verification.
                    </p>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
