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
  Crosshair,
  Library,
  Activity,
  History,
  Lock,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Fingerprint,
  TrendingUp,
  Waves
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
  CartesianGrid
} from 'recharts';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '@/lib/utils';
import React, { useEffect, useState, useMemo } from 'react';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

const NeuralRadarTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="liquid-glass-accent p-5 min-w-[240px] rim-light border-white/20 shadow-2xl">
        <div className="flex items-center gap-3 mb-3 border-b border-white/10 pb-3">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{data.subject}</p>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Integrity Score</span>
            <span className="text-sm font-mono text-primary font-black">{Number(data?.A).toFixed(1)}%</span>
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
        "liquid-glass-accent p-5 min-w-[220px] border shadow-3xl transition-all duration-500",
        isMalicious ? "border-destructive/40 shadow-destructive/20 bg-destructive/10" : "border-accent/40 shadow-accent/20 bg-accent/10"
      )}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Fingerprint className={cn("h-4 w-4", isMalicious ? "text-destructive" : "text-accent")} />
            <span className="text-[11px] font-black text-white uppercase tracking-tighter">SIG_{data.name}</span>
          </div>
          <Badge className={cn("text-[8px] font-black uppercase px-2 h-5", isMalicious ? "bg-destructive/30 text-destructive border-destructive/40" : "bg-accent/30 text-accent border-accent/40")}>
            {isMalicious ? "THREAT DETECTED" : "SIGNATURE VERIFIED"}
          </Badge>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-widest">Compute Load</span>
            <span className="text-[11px] font-mono text-white font-bold">{data.gas} CU</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-widest">Ops Density</span>
            <span className="text-[11px] font-mono text-white font-bold">{data.instructions} ops</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-widest">Capital Delta</span>
            <span className="text-[11px] font-mono text-white font-bold">${data.value}</span>
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
    { subject: 'Forensic Funding', A: funding?.amount ? 95 : 40, intrinsic: 'Source Verified', fullMark: 100 },
    { subject: 'Uplink Risk', A: 100 - (metrics.riskyConnections * 20), intrinsic: 'Security Peer Audited', fullMark: 100 },
    { subject: 'TX Behavioral Profile', A: 100 - (metrics.criticalThreats * 15), intrinsic: 'Neural Pattern Match', fullMark: 100 },
    { subject: 'Vault Security Score', A: metrics.securityScore, intrinsic: 'AI Engine Confirmed', fullMark: 100 },
    { subject: 'Asset Integrity', A: Math.max(10, 92 - (metrics.threatCount * 5)), intrinsic: 'DAS Verified Secure', fullMark: 100 },
  ], [funding, metrics]);

  const heatmapData = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    intensity: Math.floor(Math.random() * 100),
  })), []);

  const fingerprintData = useMemo(() => [
    { name: 'P_01', gas: 400, instructions: 120, value: 500, risk: 'safe' },
    { name: 'P_02', gas: 800, instructions: 450, value: 50, risk: 'suspicious' },
    { name: 'P_03', gas: 200, instructions: 50, value: 1200, risk: 'safe' },
    { name: 'P_04', gas: 950, instructions: 800, value: 10, risk: 'malicious' },
    { name: 'P_05', gas: 350, instructions: 180, value: 300, risk: 'safe' },
  ], []);

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: IDIcon, label: 'Identity Signature', value: identity.name || 'Unresolved Core', color: 'primary', tags: identity.categories || ['Unclassified'] },
          { icon: ArrowDownLeft, label: 'Origin Lineage', value: funding.fundedBy || 'Origin Unknown', color: 'accent', subValue: `ROOT_${funding.amount || '0'} SOL` },
          { icon: Coins, label: 'Asset Valuation', value: `$${portfolioTotal}`, color: 'primary', subValue: 'Helius Multi-Vector Index' },
          { icon: ShieldCheck, label: 'Vault Integrity', value: `${metrics.securityScore}%`, color: 'accent', subValue: 'Neural Guard v2.9', isScore: true }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="p-6 relative group overflow-hidden border-white/5 hover:border-white/20 transition-all duration-500 hover:scale-[1.03]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-5 relative z-10">
                <div className={cn(
                  "h-14 w-14 rounded-[1.5rem] flex items-center justify-center border transition-all duration-500 group-hover:rotate-12",
                  stat.color === 'primary' ? "bg-primary/10 border-primary/20 text-primary shadow-lg shadow-primary/10" : "bg-accent/10 border-accent/20 text-accent shadow-lg shadow-accent/10"
                )}>
                  <stat.icon className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1.5">{stat.label}</p>
                  <h3 className={cn(
                    "text-lg font-black uppercase truncate text-white tracking-tighter",
                    stat.isScore && (metrics.securityScore > 70 ? "text-accent" : "text-destructive")
                  )}>{stat.value}</h3>
                  {stat.tags ? (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
                      {stat.tags.map((tag, j) => (
                        <Badge key={j} variant="outline" className="bg-white/5 border-white/10 text-[8px] px-2 py-0.5 h-4 uppercase font-black text-accent/80 whitespace-nowrap">{tag}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase mt-1.5 tracking-wider">{stat.subValue}</p>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-6 overflow-hidden border-white/5 group">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">24H Temporal Scan</CardTitle>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-black tracking-widest h-6">ACTIVITY PROFILE</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-10 h-[360px] flex flex-col justify-center">
            <div className="space-y-10">
              <div>
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-6">Interaction Density Spectrum</p>
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
                              data.intensity > 80 ? "bg-primary shadow-[0_0_25px_hsla(var(--primary),0.6)]" : 
                              data.intensity > 50 ? "bg-primary/50" : 
                              data.intensity > 20 ? "bg-primary/20" : "bg-white/[0.05]"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="liquid-glass-accent p-3 border-white/20 shadow-2xl">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">{data.hour}</p>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1">Refractive Intensity: {data.intensity}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
              <div className="p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 flex gap-5 items-center relative overflow-hidden">
                 <div className="absolute inset-y-0 left-0 w-1 bg-accent/40" />
                 <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                    <Activity className="h-5 w-5 text-accent animate-pulse" />
                 </div>
                 <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80 italic tracking-tight">
                   Anomaly Detection Engine: No temporal deviations detected. Transaction flow matches established baseline.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6 border-white/5 overflow-hidden group">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Fingerprint className="h-5 w-5 text-primary" />
                  <motion.div 
                    animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/50 blur-xl rounded-full"
                  />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Parallel Fingerprinting</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-accent animate-neural-pulse" />
                <span className="text-[9px] font-black text-accent uppercase tracking-[0.25em]">Live Forensics</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="h-[360px] p-0 relative">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={fingerprintData} 
                margin={{ top: 50, right: 40, left: 40, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 1000]} />
                
                <RechartsTooltip 
                  content={<FingerprintTooltip />}
                  cursor={{ stroke: 'rgba(153, 69, 255, 0.3)', strokeWidth: 30 }}
                />

                <Line 
                  type="monotone" 
                  dataKey="gas" 
                  stroke="url(#lineGradientPrimary)" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 3, className: 'animate-pulse' }}
                  animationDuration={2000}
                />
                <Line 
                  type="monotone" 
                  dataKey="instructions" 
                  stroke="url(#lineGradientAccent)" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: 'hsl(var(--accent))', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 8, fill: 'hsl(var(--accent))', stroke: '#fff', strokeWidth: 3, className: 'animate-pulse' }}
                  animationDuration={2500}
                />

                <defs>
                  <linearGradient id="lineGradientPrimary" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="lineGradientAccent" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>

            <div className="absolute bottom-6 left-10 right-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1">Audit Mode</span>
                  <span className="text-[10px] font-black text-white/80 uppercase">Cluster Cluster</span>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-[0.2em] mb-1">Neural Sync</span>
                  <span className="text-[10px] font-black text-accent uppercase">High Fidelity</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-xl">
                 <TrendingUp className="h-4 w-4 text-primary" />
                 <span className="text-[9px] font-black text-primary uppercase tracking-widest">99.4% MATCH</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12 border-white/5 overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <History className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Directed Forensic Flow</CardTitle>
              </div>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] font-black tracking-widest h-6">LIVE ANALYTICS</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-6">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-6">Capital Outflow Distribution</p>
                {[
                  { name: 'Internal Vault Storage', value: 45, status: 'Safe' },
                  { name: 'Audited Staking Protocol', value: 30, status: 'Safe' },
                  { name: 'Unknown Hot Wallet', value: 15, status: 'Risky' },
                  { name: 'DEX Liquidity Pool', value: 10, status: 'Safe' },
                ].map((dest, i) => (
                  <div key={i} className="group relative">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2 w-2 rounded-full", dest.status === 'Risky' ? 'bg-destructive' : 'bg-accent')} />
                        <span className="text-[11px] font-black text-white uppercase tracking-tight">{dest.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground font-bold">{dest.value}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${dest.value}%` }}
                        transition={{ duration: 1.5, delay: i * 0.15, ease: "circOut" }}
                        className={cn("h-full rounded-full", dest.status === 'Risky' ? 'bg-destructive shadow-[0_0_15px_rgba(255,0,0,0.5)]' : 'bg-primary shadow-[0_0_15px_hsla(var(--primary),0.5)]')}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[320px] relative">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-4 text-center">Multi-Vector Assessment</p>
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
                      strokeWidth={2.5} 
                      dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2 }} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12 border-white/5 overflow-hidden">
           <CardHeader className="border-b border-white/5 pb-6 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <Library className="h-5 w-5 text-accent" />
                  </div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Vault Asset Forensic Inventory</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-accent uppercase tracking-widest">Live Helius Sync</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-10 border-r border-white/5">
                   <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-8">Cryptographic SPL Signature Tokens</p>
                   <div className="space-y-4">
                      {topTokens.length > 0 ? topTokens.map((token: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 group cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                              <span className="text-xs font-black text-primary uppercase">{token?.symbol?.[0] || 'T'}</span>
                            </div>
                            <div>
                              <p className="text-[12px] font-black text-white uppercase tracking-tight">{token?.name || 'Unknown Signature'}</p>
                              <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{(Number(token?.amount) || 0).toFixed(4)} {token?.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[12px] font-black text-accent tracking-tighter">${(Number(token?.usdValue) || 0).toFixed(2)}</p>
                            <p className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-widest">USD VALUE</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="py-16 text-center">
                          <Activity className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4 animate-neural-pulse" />
                          <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Zero active token signatures detected</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-10 bg-white/[0.01]">
                   <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] mb-8">Verified Digital Artifacts (NFTs)</p>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                        <motion.div 
                          key={i}
                          whileHover={{ y: -8, scale: 1.05 }}
                          className="relative aspect-square rounded-[2rem] overflow-hidden border border-white/10 group cursor-pointer shadow-xl"
                        >
                          <img src={data.image} alt={name} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-115" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-5 left-5 right-5">
                            <p className="text-[10px] font-black text-white uppercase truncate drop-shadow-2xl tracking-tighter">{name}</p>
                            <p className="text-[9px] font-black text-accent uppercase tracking-widest mt-1">x{data.count} ARTIFACTS</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="col-span-3 py-16 text-center">
                          <Lock className="h-12 w-12 text-muted-foreground/10 mx-auto mb-4" />
                          <p className="text-[11px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Zero NFT artifacts resolved</p>
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
