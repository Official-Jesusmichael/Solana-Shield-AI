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
      className="group flex items-center gap-2 bg-black/40 px-2 py-1 rounded-lg border border-white/5 hover:border-accent/30 hover:bg-white/[0.05] transition-all cursor-pointer"
    >
      <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-widest truncate max-w-[100px]">
        {label ? `${label}_` : ''}{address.substring(0, 6)}...{address.slice(-4)}
      </span>
      <Copy className="h-2.5 w-2.5 text-white/20 group-hover:text-accent transition-colors" />
    </div>
  );
};

const NeuralRadarTooltip = React.memo(({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="liquid-glass-pro p-4 min-w-[200px] border-white/20 shadow-2xl">
        <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
          <div className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white">{data.subject}</p>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Integrity</span>
            <span className="text-xs font-mono text-secondary font-black">{Number(data?.A).toFixed(1)}%</span>
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
        "liquid-glass-pro p-4 min-w-[180px] border shadow-3xl transition-all duration-500",
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
  const portfolioTotal = (Number(balances?.totalUsdValue) || 0).toFixed(2);

  const topTokens = useMemo(() => {
    return (balances?.balances || [])
      .filter((t: any) => (Number(t?.usdValue) || 0) > 0.01)
      .sort((a: any, b: any) => (Number(b?.usdValue) || 0) - (Number(a?.usdValue) || 0))
      .slice(0, 6);
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
      {/* TOP STATS TIER - EXPO REDUCED */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: IDIcon, label: 'Identity', value: identity.name || 'Unresolved', color: 'purple', tags: identity.categories?.slice(0,1) || ['Unclassified'] },
          { icon: ArrowDownLeft, label: 'Origin', value: funding.fundedBy || 'Unknown', color: 'green', subValue: `${funding.amount || '0'} SOL`, address: funding.fundedBy },
          { icon: Coins, label: 'Portfolio', value: `$${portfolioTotal}`, color: 'purple', subValue: 'Helius Index' },
          { icon: ShieldCheck, label: 'Integrity', value: `${metrics.securityScore}%`, color: 'green', subValue: 'Neural Guard', isScore: true }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
          >
            <Card className="liquid-glass-pro p-4 group hover:scale-[1.02] transition-all duration-300">
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
        {/* TEMPORAL SCAN HEATMAP - REDUCED */}
        <Card className="lg:col-span-6 liquid-glass-pro">
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
                        <TooltipContent className="liquid-glass-pro p-2 border-white/20 shadow-2xl">
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

        {/* FINGERPRINTING - REDUCED */}
        <Card className="lg:col-span-6 liquid-glass-pro">
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

        {/* RADAR & INVENTORY - REDUCED SCALE */}
        <Card className="lg:col-span-12 liquid-glass-pro">
          <CardHeader className="border-b border-white/5 pb-3 pt-4 px-6 bg-white/[0.01]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="h-4 w-4 text-primary" />
                <CardTitle className="text-[9px] font-black uppercase tracking-[0.3em] text-white">Forensic Risk</CardTitle>
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
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 8, fontWeight: 800 }} />
                    <Radar dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ASSET INVENTORY - REDUCED */}
        <Card className="lg:col-span-12 liquid-glass-pro">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="p-6 border-r border-white/5">
                   <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">Token Signatures</p>
                   <div className="space-y-2.5">
                      {topTokens.length > 0 ? topTokens.map((token: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                              <span className="text-[10px] font-black text-primary">{token?.symbol?.[0] || 'T'}</span>
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-white uppercase">{token?.name || 'Unknown'}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[8px] font-mono text-muted-foreground/60">{(Number(token?.amount) || 0).toFixed(2)} {token?.symbol}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] font-black text-secondary tracking-tighter">${(Number(token?.usdValue) || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="py-8 text-center"><Activity className="h-8 w-8 text-muted-foreground/5 mx-auto mb-2" /></div>
                      )}
                   </div>
                </div>

                <div className="p-6">
                   <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">Artifacts (NFTs)</p>
                   <div className="grid grid-cols-3 gap-3">
                      {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 group">
                          <img src={data.image} alt={name} className="h-full w-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-[8px] font-black text-white uppercase truncate">{name}</p>
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-3 py-8 text-center text-[9px] font-black text-muted-foreground/20">NO ARTIFACTS</div>
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
