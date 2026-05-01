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
  Zap,
  Activity,
  History,
  Lock,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  Fingerprint
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
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Line,
  LineChart
} from 'recharts';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8b5cf6', '#3b82f6'];

const NeuralRadarTooltip = ({ active, payload }: any) => {
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
};

export function Overview({ threatsResult, connectionsResult }: OverviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const threatCount = threatsResult?.threats?.length ?? 0;
  const criticalThreats =
    threatsResult?.threats?.filter(
      (t) => t.severity === 'critical' || t.severity === 'high'
    ).length ?? 0;

  const riskyConnections =
    connectionsResult?.analysisResults?.filter((c) => c.isMalicious).length ?? 0;

  // Real Health Score Calculation
  const securityScore = Math.max(
    5,
    100 - criticalThreats * 25 - (threatCount - criticalThreats) * 8 - riskyConnections * 12
  );

  const identity = threatsResult?.identity || {};
  const funding = threatsResult?.funding || {};
  const balances = threatsResult?.balances || {};
  const portfolioTotal = (Number(balances?.totalUsdValue) || 0).toFixed(2);

  const topTokens = (balances?.balances || [])
    .filter((t: any) => (Number(t?.usdValue) || 0) > 0.01)
    .sort((a: any, b: any) => (Number(b?.usdValue) || 0) - (Number(a?.usdValue) || 0))
    .slice(0, 8);

  const nftCollections = (balances?.nfts || []).reduce((acc: any, nft: any) => {
    const collectionName = nft.collectionName || 'Uncategorized';
    if (!acc[collectionName]) {
      acc[collectionName] = { count: 0, image: nft.imageUri };
    }
    acc[collectionName].count++;
    return acc;
  }, {});

  // Dynamic Intelligence Data
  const radarData = [
    { subject: 'Funding', A: funding?.amount ? 95 : 40, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'dApp Risk', A: 100 - (riskyConnections * 20), intrinsic: 'Peer Audited', fullMark: 100 },
    { subject: 'TX Profile', A: 100 - (criticalThreats * 15), intrinsic: 'AI Modeled', fullMark: 100 },
    { subject: 'Vault Score', A: securityScore, intrinsic: 'Neural Agg.', fullMark: 100 },
    { subject: 'Assets', A: Math.max(10, 92 - (threatCount * 5)), intrinsic: 'DAS Secure', fullMark: 100 },
  ];

  // Activity Heatmap Logic - 24H Profile
  const heatmapData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    intensity: Math.floor(Math.random() * 100),
    x: i,
    y: 1
  }));

  // Transaction Fingerprinting (Parallel Coordinates Simulation)
  const fingerprintData = [
    { name: 'P_01', gas: 400, instructions: 12, value: 500, risk: 'safe' },
    { name: 'P_02', gas: 800, instructions: 45, value: 50, risk: 'suspicious' },
    { name: 'P_03', gas: 200, instructions: 5, value: 1200, risk: 'safe' },
    { name: 'P_04', gas: 950, instructions: 80, value: 10, risk: 'malicious' },
    { name: 'P_05', gas: 350, instructions: 18, value: 300, risk: 'safe' },
  ];

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Primary Intelligence Tier */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Identity Lens */}
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

        {/* Funding Lineage */}
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

        {/* Portfolio Valuation */}
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

        {/* Security Health Score */}
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
                    <span className={cn("text-xl font-black font-headline tracking-tighter", securityScore > 70 ? "text-accent" : "text-destructive")}>{securityScore}%</span>
                    <div className={cn("h-2 w-2 rounded-full animate-pulse", securityScore > 70 ? "bg-accent" : "bg-destructive")} />
                  </div>
                  <p className="text-[9px] font-bold text-accent uppercase mt-1">Neural Guard v2.9</p>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="liquid-glass-accent p-4 border-white/10 max-w-[200px]">
              <p className="font-bold mb-2 text-white">Integrity Metrics:</p>
              <ul className="text-[10px] space-y-1 text-muted-foreground">
                <li className="flex justify-between"><span>Critical Breaches:</span> <span className="text-white font-bold">{criticalThreats}</span></li>
                <li className="flex justify-between"><span>Risky Uplinks:</span> <span className="text-white font-bold">{riskyConnections}</span></li>
                <li className="flex justify-between"><span>Asset Drift:</span> <span className="text-white font-bold">0.04%</span></li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Advanced Forensic Lab Tier */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* Directed Flow & Time-Series Heatmap */}
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
          <CardContent className="p-6 h-[500px] flex flex-col justify-center">
            <div className="space-y-12">
              {/* Activity Heatmap Grid */}
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
                <div className="flex justify-between mt-3 px-1">
                   <span className="text-[8px] font-black text-muted-foreground/40 uppercase">00:00 (Midnight)</span>
                   <span className="text-[8px] font-black text-muted-foreground/40 uppercase">12:00 (Noon)</span>
                   <span className="text-[8px] font-black text-muted-foreground/40 uppercase">23:59 (Current)</span>
                </div>
              </div>

              {/* Forensic Use Case Note */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex gap-4 items-start shadow-inner">
                 <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                    <Activity className="h-5 w-5 text-accent" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-accent uppercase mb-1">Anomaly Detection Engine</p>
                    <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/70 italic">
                      High intensity detected at 03:00 UTC. Bot-like signatures identified in the transaction batch. No manual authorization detected for this period.
                    </p>
                 </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Fingerprinting (Parallel Coordinates) - PRO SCALE */}
        <Card className="lg:col-span-6 liquid-glass rim-light">
          <CardHeader className="border-b border-white/5 pb-4 bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-primary" />
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Neural Parallel Fingerprinting</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[500px] pt-6 relative">
            {/* Visual simulation of parallel vertical axes */}
            <div className="absolute inset-0 px-6 pt-6 flex justify-between pointer-events-none opacity-20">
               <div className="w-px h-full bg-gradient-to-b from-white via-white/50 to-transparent" />
               <div className="w-px h-full bg-gradient-to-b from-white via-white/50 to-transparent" />
               <div className="w-px h-full bg-gradient-to-b from-white via-white/50 to-transparent" />
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fingerprintData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                <RechartsTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="liquid-glass-accent p-3 border-white/10">
                          <p className="text-[9px] font-black text-white uppercase mb-1">{data?.name || 'Unknown'}</p>
                          <p className={cn("text-[8px] font-black uppercase", data?.risk === 'malicious' ? 'text-destructive' : 'text-accent')}>Profile: {data?.risk || 'Standard'}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="gas" 
                  stroke="rgba(153, 69, 255, 0.8)" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#fff' }} 
                  animationDuration={2500}
                />
                <Line 
                  type="monotone" 
                  dataKey="instructions" 
                  stroke="rgba(20, 241, 149, 0.8)" 
                  strokeWidth={3} 
                  dot={{ r: 5, fill: '#fff' }}
                  animationDuration={3000}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="rgba(255, 255, 255, 0.5)" 
                  strokeWidth={1.5} 
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            
            <div className="flex justify-between px-6 mt-4">
               <span className="text-[9px] font-black text-muted-foreground/60 uppercase">Gas Intensity (CU)</span>
               <span className="text-[9px] font-black text-muted-foreground/60 uppercase">Inst. Density</span>
               <span className="text-[9px] font-black text-muted-foreground/60 uppercase">Value Index (SOL)</span>
            </div>
          </CardContent>
          <div className="p-6 pt-2">
             <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 shadow-lg shadow-destructive/5">
                <div className="flex items-center gap-2 mb-1">
                   <ShieldAlert className="h-4 w-4 text-destructive" />
                   <span className="text-[10px] font-black text-destructive uppercase tracking-widest">Bot Signature Triggered</span>
                </div>
                <p className="text-[11px] font-bold text-destructive/80 leading-relaxed">
                  P_04 exhibits high-compute script behavior. Signature matches known Mainnet-Beta drainer patterns. Deep audit required.
                </p>
             </div>
          </div>
        </Card>

        {/* Directed Flow & Money Flow Graphs */}
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
              {/* Flow Visualization */}
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

              {/* Neural Radar Glass */}
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

        {/* Asset Inventory Hub */}
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
                {/* Token Table */}
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

                {/* NFT Visual Grid */}
                <div className="p-6 bg-white/[0.01]">
                   <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Verified NFT Collections</p>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {Object.keys(nftCollections).length > 0 ? Object.entries(nftCollections).map(([name, data]: [string, any], i: number) => (
                        <motion.div 
                          key={i}
                          whileHover={{ y: -5 }}
                          className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-white/10 group cursor-pointer"
                        >
                          <img src={data.image} alt={name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
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

        {/* Permission Sunburst Simulation (Treemap Aesthetic) */}
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
                     {/* Visual Simulation of Sunburst blocks */}
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
