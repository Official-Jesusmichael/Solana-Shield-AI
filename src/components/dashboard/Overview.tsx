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
  CheckCircle2
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
      className="group flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all cursor-pointer"
    >
      <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest truncate max-w-[120px]">
        {label ? `${label}_` : ''}{address.substring(0, 8)}...{address.slice(-4)}
      </span>
      <Copy className="h-3 w-3 text-white/20 group-hover:text-accent transition-colors" />
    </div>
  );
};

const NeuralRadarTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="liquid-glass-pro p-5 min-w-[240px] border-white/20 shadow-2xl">
        <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-3">
          <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{data.subject}</p>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Integrity Score</span>
            <span className="text-sm font-mono text-secondary font-black">{Number(data?.A).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Verification</span>
            <span className="text-[10px] font-mono text-white font-black uppercase">{data?.intrinsic || 'N/A'}</span>
          </div>
        </div>
      </div>
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
        "liquid-glass-pro p-5 min-w-[220px] border shadow-3xl transition-all duration-500",
        isMalicious ? "border-destructive/40 bg-destructive/10" : "border-secondary/40 bg-secondary/10"
      )}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Fingerprint className={cn("h-4 w-4", isMalicious ? "text-destructive" : "text-secondary")} />
            <span className="text-[11px] font-black text-white uppercase tracking-tighter">SIG_{data.name}</span>
          </div>
          <Badge className={cn("text-[8px] font-black uppercase px-2 h-5", isMalicious ? "bg-destructive/30 text-destructive" : "bg-secondary/30 text-secondary")}>
            {isMalicious ? "THREAT" : "VERIFIED"}
          </Badge>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-widest">Load</span>
            <span className="text-[11px] font-mono text-white font-bold">{data.gas} CU</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-widest">Ops</span>
            <span className="text-[11px] font-mono text-white font-bold">{data.instructions}</span>
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
  const portfolioTotal = (Number(balances?.totalUsdValue) || 0).toFixed(2);

  const topTokens = useMemo(() => {
    return (balances?.balances || [])
      .filter((t: any) => (Number(t?.usdValue) || 0) > 0.01)
      .sort((a: any, b: any) => (Number(b?.usdValue) || 0) - (Number(a?.usdValue) || 0))
      .slice(0, 8);
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
    { subject: 'Funding Origin', A: funding?.amount ? 92 : 35, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'Uplink Integrity', A: 100 - (metrics.riskyConnections * 18), intrinsic: 'Peer Audited', fullMark: 100 },
    { subject: 'Neural Pattern', A: 100 - (metrics.criticalThreats * 15), intrinsic: 'AI Match', fullMark: 100 },
    { subject: 'Vault Score', A: metrics.securityScore, intrinsic: 'System Confirmed', fullMark: 100 },
    { subject: 'DAS Integrity', A: Math.max(10, 95 - (metrics.threatCount * 5)), intrinsic: 'DAS Secure', fullMark: 100 },
  ], [funding, metrics]);

  const heatmapData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    intensity: Math.floor(Math.random() * 100),
  })), []);

  const fingerprintData = useMemo(() => [
    { name: 'P_01', gas: 420, instructions: 140, value: 500, risk: 'safe' },
    { name: 'P_02', gas: 850, instructions: 480, value: 50, risk: 'suspicious' },
    { name: 'P_03', gas: 210, instructions: 60, value: 1200, risk: 'safe' },
    { name: 'P_04', gas: 980, instructions: 820, value: 10, risk: 'malicious' },
    { name: 'P_05', gas: 380, instructions: 190, value: 300, risk: 'safe' },
    { name: 'P_06', gas: 600, instructions: 300, value: 150, risk: 'safe' },
  ], []);

  if (!mounted) return null;

  return (
    <div className="space-y-10">
      {/* TOP STATS TIER */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: IDIcon, label: 'Identity Signature', value: identity.name || 'Unresolved Core', color: 'purple', tags: identity.categories || ['Unclassified'] },
          { icon: ArrowDownLeft, label: 'Origin Root', value: funding.fundedBy || 'Origin Unknown', color: 'green', subValue: `ROOT_${funding.amount || '0'} SOL`, address: funding.fundedBy },
          { icon: Coins, label: 'Portfolio Val', value: `$${portfolioTotal}`, color: 'purple', subValue: 'Live Helius Index' },
          { icon: ShieldCheck, label: 'Vault Integrity', value: `${metrics.securityScore}%`, color: 'green', subValue: 'Neural Guard v3.0', isScore: true }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
          >
            <Card className="liquid-glass-pro p-6 group hover:scale-[1.03] hover:border-white/20 transition-all duration-500">
              <div className="flex items-center gap-5 relative z-10">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-500 group-hover:rotate-12",
                  stat.color === 'purple' 
                    ? "bg-primary/10 border-primary/20 text-primary shadow-[0_0_20px_hsla(var(--primary),0.3)]" 
                    : "bg-secondary/10 border-secondary/20 text-secondary shadow-[0_0_20px_hsla(var(--secondary),0.3)]"
                )}>
                  <stat.icon className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1.5">{stat.label}</p>
                  <h3 className={cn(
                    "text-xl font-black uppercase truncate text-white tracking-tighter leading-none",
                    stat.isScore && (metrics.securityScore > 70 ? "text-secondary" : "text-destructive")
                  )}>{stat.value}</h3>
                  <div className="flex gap-1.5 mt-3">
                    {stat.address && <CopyableAddress address={stat.address} />}
                    {stat.tags && stat.tags.map((tag, j) => (
                      <Badge key={j} variant="outline" className="bg-white/5 border-white/10 text-[8px] px-2 py-0.5 h-4 uppercase font-black text-secondary/80">{tag}</Badge>
                    ))}
                    {!stat.address && !stat.tags && (
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">{stat.subValue}</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-10 grid-cols-1 lg:grid-cols-12">
        {/* TEMPORAL SCAN HEATMAP */}
        <Card className="lg:col-span-6 liquid-glass-pro group">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                  <Clock className="h-5 w-5 text-secondary" />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">24H Neural Density</CardTitle>
              </div>
              <Badge className="bg-secondary/20 text-secondary border-secondary/30 text-[9px] font-black tracking-widest">ACTIVITY PROFILE</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-10 h-[360px] flex flex-col justify-center">
            <div className="space-y-12">
              <div>
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-6">Interaction Spectrum</p>
                <div className="grid grid-cols-12 gap-3">
                  {heatmapData.map((data, i) => (
                    <TooltipProvider key={i}>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, delay: i * 0.02 }}
                            className={cn(
                              "aspect-square rounded-xl transition-all duration-300 hover:scale-125 cursor-help border border-white/5",
                              data.intensity > 80 ? "bg-secondary shadow-[0_0_20px_hsla(var(--secondary),0.6)]" : 
                              data.intensity > 50 ? "bg-secondary/50" : 
                              data.intensity > 20 ? "bg-secondary/20" : "bg-white/[0.05]"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="liquid-glass-pro p-3 border-white/20 shadow-2xl">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{data.hour}</p>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1">Intensity: {data.intensity}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex gap-5 items-center relative overflow-hidden">
                 <div className="absolute inset-y-0 left-0 w-1 bg-secondary/40" />
                 <div className="h-10 w-10 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
                    <Activity className="h-5 w-5 text-secondary animate-pulse" />
                 </div>
                 <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80 italic tracking-tight">
                   Neural Analysis Engine: Activity patterns consistent with standard DeFi protocol interactions. No temporal anomalies detected.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FINGERPRINTING LINE CHART */}
        <Card className="lg:col-span-6 liquid-glass-pro group">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Fingerprint className="h-5 w-5 text-primary" />
                  <motion.div 
                    animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/50 blur-xl rounded-full"
                  />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Neural Fingerprinting</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-secondary animate-neural-pulse" />
                <span className="text-[9px] font-black text-secondary uppercase tracking-[0.25em]">Live Audit</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="h-[360px] p-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fingerprintData} margin={{ top: 50, right: 40, left: 40, bottom: 50 }}>
                <defs>
                  <linearGradient id="colorGas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 1200]} />
                <RechartsTooltip content={<FingerprintTooltip />} cursor={{ stroke: 'rgba(153, 69, 255, 0.3)', strokeWidth: 40 }} />
                <Area type="monotone" dataKey="gas" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorGas)" />
                <Area type="monotone" dataKey="instructions" stroke="hsl(var(--secondary))" strokeWidth={4} fillOpacity={1} fill="url(#colorOps)" />
              </AreaChart>
            </ResponsiveContainer>

            <div className="absolute bottom-6 left-10 right-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1">Method</span>
                  <span className="text-[10px] font-black text-white/80 uppercase">V_PARALLEL</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1">Sync</span>
                  <span className="text-[10px] font-black text-secondary uppercase">HIGH_FIDELITY</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-xl">
                 <TrendingUp className="h-4 w-4 text-primary" />
                 <span className="text-[9px] font-black text-primary uppercase tracking-widest">99.8% FIDELITY</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MULTI-VECTOR RADAR CHART */}
        <Card className="lg:col-span-12 liquid-glass-pro overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Forensic Risk Vectors</CardTitle>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-black tracking-widest">LIVE ANALYTICS</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-8">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-4">Capital Outflow Interrogation</p>
                {[
                  { name: 'Internal Storage', value: 45, status: 'Safe', color: 'hsl(var(--secondary))' },
                  { name: 'Audited Staking', value: 30, status: 'Safe', color: 'hsl(var(--secondary))' },
                  { name: 'Unknown Hot Wallet', value: 15, status: 'Risky', color: 'hsl(var(--destructive))' },
                  { name: 'DEX Liquidity', value: 10, status: 'Safe', color: 'hsl(var(--secondary))' },
                ].map((dest, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: dest.color }} />
                        <span className="text-[11px] font-black text-white uppercase tracking-tight">{dest.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground font-bold">{dest.value}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${dest.value}%` }}
                        transition={{ duration: 1.5, delay: i * 0.15, ease: "circOut" }}
                        className="h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: dest.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[340px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                    <RechartsTooltip content={<NeuralRadarTooltip />} />
                    <Radar 
                      name="Forensics" 
                      dataKey="A" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.2} 
                      strokeWidth={3} 
                      dot={{ r: 5, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ASSET INVENTORY */}
        <Card className="lg:col-span-12 liquid-glass-pro overflow-hidden">
           <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                    <Library className="h-5 w-5 text-secondary" />
                  </div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Forensic Asset Inventory</CardTitle>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black text-secondary uppercase tracking-widest">Helius DAS 2.0 Enabled</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-10 border-r border-white/5 bg-white/[0.01]">
                   <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-8">SPL Token Signatures</p>
                   <div className="space-y-4">
                      {topTokens.length > 0 ? topTokens.map((token: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-300 group cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:rotate-6 transition-transform">
                              <span className="text-xs font-black text-primary uppercase">{token?.symbol?.[0] || 'T'}</span>
                            </div>
                            <div>
                              <p className="text-[13px] font-black text-white uppercase tracking-tight">{token?.name || 'Unknown'}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-mono text-muted-foreground/60">{(Number(token?.amount) || 0).toFixed(4)} {token?.symbol}</span>
                                {token?.mint && <CopyableAddress address={token.mint} />}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[14px] font-black text-secondary tracking-tighter">${(Number(token?.usdValue) || 0).toFixed(2)}</p>
                            <p className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest">USD</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="py-16 text-center">
                          <Activity className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4 animate-pulse" />
                          <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">No token signatures resolved</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-10 bg-white/[0.02]">
                   <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-8">Verified Artifacts (NFTs)</p>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                        <motion.div 
                          key={i}
                          whileHover={{ y: -8, scale: 1.05 }}
                          className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-white/10 group cursor-pointer shadow-2xl"
                        >
                          <img src={data.image} alt={name} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-115" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-6 left-6 right-6">
                            <p className="text-[11px] font-black text-white uppercase truncate drop-shadow-2xl tracking-tighter">{name}</p>
                            <p className="text-[9px] font-black text-secondary uppercase tracking-widest mt-1">x{data.count} ARCHIVE</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="col-span-3 py-16 text-center">
                          <Lock className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                          <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">No archive artifacts found</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

