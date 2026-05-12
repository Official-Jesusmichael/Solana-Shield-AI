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
import { motion } from 'framer-motion';
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

// Memoized Chart Components for faster rendering
const NeuralRadarTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="liquid-glass-accent p-4 min-w-[220px] rim-light">
        <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
          <Crosshair className="h-3 w-3 text-primary animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white">{data.subject}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-bold">Integrity Score</span>
            <span className="text-sm font-mono text-primary font-black">{(Number(data?.A) || 0).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-bold">Verification</span>
            <span className="text-xs font-mono text-white font-black">{data?.intrinsic || 'N/A'}</span>
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
        "liquid-glass-accent p-4 min-w-[200px] border shadow-2xl transition-all duration-300",
        isMalicious ? "border-destructive/30 shadow-destructive/10" : "border-accent/30 shadow-accent/10"
      )}>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Fingerprint className={cn("h-3 w-3", isMalicious ? "text-destructive" : "text-accent")} />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">SIG_{data.name}</span>
          </div>
          <Badge className={cn("text-[7px] font-black uppercase px-1.5 h-4", isMalicious ? "bg-destructive/20 text-destructive border-destructive/30" : "bg-accent/20 text-accent border-accent/30")}>
            {isMalicious ? "THREAT" : "VERIFIED"}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground font-bold uppercase">Compute Load</span>
            <span className="text-[10px] font-mono text-white font-bold">{data.gas} CU</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground font-bold uppercase">Instructions</span>
            <span className="text-[10px] font-mono text-white font-bold">{data.instructions} ops</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground font-bold uppercase">Value Delta</span>
            <span className="text-[10px] font-mono text-white font-bold">${data.value}</span>
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
    { subject: 'Funding', A: funding?.amount ? 95 : 40, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'dApp Risk', A: 100 - (metrics.riskyConnections * 20), intrinsic: 'Peer Audited', fullMark: 100 },
    { subject: 'TX Profile', A: 100 - (metrics.criticalThreats * 15), intrinsic: 'AI Modeled', fullMark: 100 },
    { subject: 'Vault Score', A: metrics.securityScore, intrinsic: 'Neural Agg.', fullMark: 100 },
    { subject: 'Assets', A: Math.max(10, 92 - (metrics.threatCount * 5)), intrinsic: 'DAS Secure', fullMark: 100 },
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
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-primary/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-primary/20">
            <IDIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Identity Signature</p>
            <h3 className="text-sm font-black uppercase truncate text-white">{identity.name || 'Unresolved Core'}</h3>
            <div className="flex gap-1 mt-1.5 overflow-x-auto no-scrollbar">
              {(identity.categories || ['Unclassified']).map((cat: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] px-1.5 py-0 h-4 uppercase font-bold text-accent whitespace-nowrap">{cat}</Badge>
              ))}
            </div>
          </div>
        </Card>

        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-accent/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-accent/20">
            <ArrowDownLeft className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Origin Lineage</p>
            <h3 className="text-sm font-black uppercase truncate text-white">{funding.fundedBy || 'Origin Unknown'}</h3>
            <p className="text-xs font-mono text-accent/80 mt-1.5">ROOT_{funding.amount || '0'} SOL</p>
          </div>
        </Card>

        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-primary/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-primary/20">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Asset Valuation</p>
            <h3 className="text-xl font-black font-headline tracking-tighter text-white">${portfolioTotal}</h3>
            <p className="text-[9px] font-bold text-primary uppercase mt-1">Helius Multi-Vector Index</p>
          </div>
        </Card>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02] cursor-help border-l-4 border-l-accent">
                <div className="h-12 w-12 rounded-[1.25rem] bg-accent/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-accent/20">
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Vault Integrity</p>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xl font-black font-headline tracking-tighter", metrics.securityScore > 70 ? "text-accent" : "text-destructive")}>{metrics.securityScore}%</span>
                    <div className={cn("h-2 w-2 rounded-full animate-pulse", metrics.securityScore > 70 ? "bg-accent" : "bg-destructive")} />
                  </div>
                  <p className="text-[9px] font-bold text-accent uppercase mt-1">Neural Guard v2.9</p>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="liquid-glass-accent p-4 border-white/10 max-w-[200px]">
              <p className="font-bold mb-2 text-white">Integrity Metrics:</p>
              <ul className="text-[10px] space-y-1 text-muted-foreground">
                <li className="flex justify-between"><span>Critical Breaches:</span> <span className="text-white font-bold">{metrics.criticalThreats}</span></li>
                <li className="flex justify-between"><span>Risky Uplinks:</span> <span className="text-white font-bold">{metrics.riskyConnections}</span></li>
                <li className="flex justify-between"><span>Asset Drift:</span> <span className="text-white font-bold">0.04%</span></li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        <Card className="lg:col-span-6 liquid-glass rim-light overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary" />
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">24H Neural Activity Profile</CardTitle>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black">TEMPORAL SCAN</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 h-[320px] flex flex-col justify-center">
            <div className="space-y-8">
              <div>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Transaction Density Spectrum</p>
                <div className="grid grid-cols-12 gap-2">
                  {heatmapData.map((data, i) => (
                    <TooltipProvider key={i}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: i * 0.02 }}
                            className={cn(
                              "aspect-square rounded-lg transition-all hover:scale-110 cursor-help border border-white/5",
                              data.intensity > 80 ? "bg-primary shadow-[0_0_20px_rgba(153,69,255,0.5)]" : 
                              data.intensity > 50 ? "bg-primary/40" : 
                              data.intensity > 20 ? "bg-primary/10" : "bg-white/[0.03]"
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="liquid-glass-accent p-2 border-white/10">
                          <p className="text-[9px] font-black text-white">{data.hour}</p>
                          <p className="text-[8px] text-muted-foreground uppercase">Intensity: {data.intensity}%</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex gap-4 items-center">
                 <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                    <Activity className="h-4 w-4 text-accent" />
                 </div>
                 <p className="text-[10px] font-medium leading-tight text-muted-foreground/70 italic">
                   Anomaly Detection: Stable activity detected.
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-6 liquid-glass rim-light relative group overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent animate-[shimmer_3s_infinite]" />
          
          <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Fingerprint className="h-4 w-4 text-primary" />
                  <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/40 blur-md"
                  />
                </div>
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Neural Parallel Fingerprinting</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[8px] font-black text-accent uppercase tracking-widest">Live Audit</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="h-[320px] p-0 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
            
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={fingerprintData} 
                margin={{ top: 40, right: 30, left: 30, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[0, 1000]} />
                
                <RechartsTooltip 
                  content={<FingerprintTooltip />}
                  cursor={{ stroke: 'rgba(153, 69, 255, 0.2)', strokeWidth: 20 }}
                />

                <Line 
                  type="monotone" 
                  dataKey="gas" 
                  stroke="url(#lineGradientPrimary)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse' }}
                  animationDuration={1500}
                  isAnimationActive={true}
                />
                <Line 
                  type="monotone" 
                  dataKey="instructions" 
                  stroke="url(#lineGradientAccent)" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: 'hsl(var(--accent))', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 6, fill: 'hsl(var(--accent))', stroke: '#fff', strokeWidth: 2, className: 'animate-pulse' }}
                  animationDuration={1800}
                  isAnimationActive={true}
                />

                <defs>
                  <linearGradient id="lineGradientPrimary" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="lineGradientAccent" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>

            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">Profiling Mode</span>
                  <span className="text-[9px] font-bold text-white/60 uppercase">Cluster Analysis</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">Neural Sync</span>
                  <span className="text-[9px] font-bold text-accent uppercase">High Fidelity</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
                 <TrendingUp className="h-3 w-3 text-primary" />
                 <span className="text-[8px] font-black text-primary uppercase">99.4% Match</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12 liquid-glass rim-light overflow-hidden">
          <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Directed Flow Forensic History</CardTitle>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[8px] font-black">LIVE STREAM</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Capital Outflow Destinations</p>
                {[
                  { name: 'Internal Storage', value: 45, status: 'Safe' },
                  { name: 'Staking Protocol', value: 30, status: 'Audited' },
                  { name: 'Unknown Hot Wallet', value: 15, status: 'Risky' },
                  { name: 'DEX LP', value: 10, status: 'Safe' },
                ].map((dest, i) => (
                  <div key={i} className="group relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className={cn("h-3 w-3", dest.status === 'Risky' ? 'text-destructive' : 'text-accent')} />
                        <span className="text-[10px] font-bold text-white uppercase">{dest.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{dest.value}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${dest.value}%` }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className={cn("h-full rounded-full", dest.status === 'Risky' ? 'bg-destructive' : 'bg-primary')}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-[250px]">
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Multi-Vector Risk Assessment</p>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: 900, textTransform: 'uppercase' }} />
                    <RechartsTooltip content={<NeuralRadarTooltip />} />
                    <Radar 
                      name="Forensics" 
                      dataKey="A" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.15} 
                      strokeWidth={1.5} 
                      dot={{ r: 3, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 1 }} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-12 liquid-glass rim-light overflow-hidden">
           <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Library className="h-4 w-4 text-accent" />
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Vault Asset Forensic Inventory</CardTitle>
                </div>
                <p className="text-[9px] font-bold text-accent uppercase tracking-widest">LIVE HELIUS SYNC</p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 border-r border-white/5">
                   <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Cryptographic SPL Tokens</p>
                   <div className="space-y-3">
                      {topTokens.length > 0 ? topTokens.map((token: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                              <span className="text-[10px] font-black text-primary">{token?.symbol?.[0] || 'T'}</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-white uppercase">{token?.name || 'Unknown Token'}</p>
                              <p className="text-[8px] font-mono text-muted-foreground/50">{(Number(token?.amount) || 0).toFixed(4)} {token?.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-accent">${(Number(token?.usdValue) || 0).toFixed(2)}</p>
                            <p className="text-[8px] font-bold text-muted-foreground/30 uppercase">USD VAL</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="py-10 text-center">
                          <Activity className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3 animate-pulse" />
                          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase">Zero active token signatures found</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="p-6 bg-white/[0.01]">
                   <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Verified NFT Collections</p>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                        <motion.div 
                          key={i}
                          whileHover={{ y: -5 }}
                          className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-white/10 group cursor-pointer"
                        >
                          <img src={data.image} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-3 left-3 right-3">
                            <p className="text-[9px] font-black text-white uppercase truncate drop-shadow-lg">{name}</p>
                            <p className="text-[8px] font-bold text-accent uppercase">x{data.count} ASSETS</p>
                          </div>
                        </motion.div>
                      )) : (
                        <div className="col-span-3 py-10 text-center">
                          <Lock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase">Zero NFT artifacts detected</p>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </CardContent>
        </Card>

        <Card className="lg:col-span-12 liquid-glass rim-light">
           <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4 text-accent" />
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Permission Sunburst Mapping</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-4">
                     <p className="text-[11px] font-medium italic text-muted-foreground/80 leading-relaxed">
                       This forensic layer maps delegated authority across your vault. Programs with unlimited transfer or signing permissions are highlighted in the thermal spectrum.
                     </p>
                     <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
                        <div className="flex items-center gap-2 mb-2">
                           <ShieldAlert className="h-4 w-4 text-destructive" />
                           <span className="text-[10px] font-black text-destructive uppercase">Stale Authorizations</span>
                        </div>
                        <p className="text-[11px] font-bold text-destructive/80">3 programs found with excessive access signatures.</p>
                     </div>
                  </div>
                  <div className="md:col-span-2 h-[200px] flex items-center justify-center gap-4">
                     <div className="flex-1 h-full rounded-[2rem] bg-accent/20 border border-accent/20 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-[8px] font-black text-accent uppercase tracking-widest mb-1">DEX Authorizations</span>
                        <span className="text-[12px] font-black text-white uppercase">Safe Spectrum</span>
                     </div>
                     <div className="w-1/3 h-full rounded-[2rem] bg-primary/20 border border-primary/20 flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest mb-1">Lending Pools</span>
                        <span className="text-[12px] font-black text-white uppercase">Audited</span>
                     </div>
                     <div className="w-1/4 h-full rounded-[2rem] bg-destructive/20 border border-destructive/20 flex flex-col items-center justify-center p-4 text-center animate-pulse">
                        <span className="text-[8px] font-black text-destructive uppercase tracking-widest mb-1">Unverified</span>
                        <span className="text-[12px] font-black text-white uppercase">Critical</span>
                     </div>
                  </div>
               </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}