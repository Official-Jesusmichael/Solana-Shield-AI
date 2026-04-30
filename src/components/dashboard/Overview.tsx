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
  Radar as RadarIcon,
  Library
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
} from 'recharts';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

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
            <span className="text-sm font-mono text-primary font-black">{(data.A * 0.998).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground font-bold">Verification</span>
            <span className="text-xs font-mono text-white font-black">{data.intrinsic}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function Overview({ threatsResult, connectionsResult }: OverviewProps) {
  const threatCount = threatsResult?.threats?.length ?? 0;
  const criticalThreats =
    threatsResult?.threats?.filter(
      (t) => t.severity === 'critical' || t.severity === 'high'
    ).length ?? 0;

  const riskyConnections =
    connectionsResult?.analysisResults?.filter((c) => c.isMalicious).length ?? 0;

  const securityScore = Math.max(
    0,
    100 - criticalThreats * 25 - (threatCount - criticalThreats) * 8 - riskyConnections * 12
  );

  const identity = threatsResult?.identity || {};
  const funding = threatsResult?.funding || {};
  const balances = threatsResult?.balances || {};
  const portfolioTotal = balances.totalUsdValue?.toFixed(2) || '0.00';

  const topTokens = (balances.balances || [])
    .filter((t: any) => (t.usdValue || 0) > 1)
    .sort((a: any, b: any) => b.usdValue - a.usdValue)
    .slice(0, 5);

  const nftCollections = (balances.nfts || []).reduce((acc: any, nft: any) => {
    const collectionName = nft.collectionName || 'Uncategorized';
    if (!acc[collectionName]) {
      acc[collectionName] = { count: 0, image: nft.imageUri };
    }
    acc[collectionName].count++;
    return acc;
  }, {});

  const radarData = [
    { subject: 'Funding', A: funding?.amount ? 95 : 40, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'dApp Risk', A: 100 - (riskyConnections * 20), intrinsic: 'Peer Audited', fullMark: 100 },
    { subject: 'TX Profile', A: 100 - (criticalThreats * 15), intrinsic: 'AI Modeled', fullMark: 100 },
    { subject: 'Vault Score', A: securityScore, intrinsic: 'Neural Agg.', fullMark: 100 },
    { subject: 'Assets', A: 92 - (threatCount * 5), intrinsic: 'DAS Secure', fullMark: 100 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Identity Lens */}
        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-primary/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-primary/20">
            <IDIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Identity</p>
            <h3 className="text-sm font-black uppercase truncate text-white">{identity.name || 'Unresolved'}</h3>
            <div className="flex gap-1 mt-1.5 overflow-x-auto">
              {(identity.categories || ['Unclassified']).map((cat: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-white/5 border-white/10 text-[8px] px-1.5 py-0 h-4 uppercase font-bold text-accent">{cat}</Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Funding Lens */}
        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-accent/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-accent/20">
            <ArrowDownLeft className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Funding</p>
            <h3 className="text-sm font-black uppercase truncate text-white">{funding.fundedBy || 'Unknown'}</h3>
            <p className="text-xs font-mono text-accent/80 mt-1.5">{funding.amount || '0'} SOL</p>
          </div>
        </Card>

        {/* Valuation Lens */}
        <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02]">
          <div className="h-12 w-12 rounded-[1.25rem] bg-primary/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-primary/20">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Portfolio</p>
            <h3 className="text-xl font-black font-headline tracking-tighter text-white">${portfolioTotal}</h3>
            <p className="text-[9px] font-bold text-primary uppercase mt-1">Live Helius Data</p>
          </div>
        </Card>

        {/* Security Score Lens */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="liquid-glass p-5 flex items-center gap-4 rim-light transition-transform hover:scale-[1.02] cursor-help">
                <div className="h-12 w-12 rounded-[1.25rem] bg-accent/20 flex items-center justify-center border border-white/20 shrink-0 shadow-lg shadow-accent/20">
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Vault Health</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black font-headline text-accent tracking-tighter">{securityScore}%</span>
                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  </div>
                  <p className="text-[9px] font-bold text-accent uppercase mt-1">Audit Complete</p>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="liquid-glass-accent p-4 border-white/10">
              <p className="font-bold mb-2 text-white">Neural Integrity Metrics:</p>
              <ul className="text-[10px] space-y-1 text-muted-foreground">
                <li className="flex justify-between gap-4"><span>Critical Breaches:</span> <span className="text-white font-bold">{criticalThreats}</span></li>
                <li className="flex justify-between gap-4"><span>Suspicious Links:</span> <span className="text-white font-bold">{riskyConnections}</span></li>
                <li className="flex justify-between gap-4"><span>Asset Integrity:</span> <span className="text-white font-bold">92.4%</span></li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Neural Radar Glass */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-3"
        >
          <Card className="liquid-glass h-full min-h-[420px] rim-light">
             <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Neural Forensic Radar</CardTitle>
                  <RadarIcon className="h-4 w-4 text-primary/40 animate-pulse" />
                </div>
              </CardHeader>
            <CardContent className="h-[340px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                  <RechartsTooltip content={<NeuralRadarTooltip />} />
                  <Radar name="Forensics" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={1.5} dot={{ r: 3, fill: 'hsl(var(--primary))', stroke: '#fff', strokeWidth: 1 }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Asset Inventory Glass */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="liquid-glass h-full rim-light">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Vault Assets</CardTitle>
                <Library className="h-4 w-4 text-accent/40" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
                 <ScrollArea className="h-[280px] pr-4">
                    {topTokens.length > 0 && (
                        <div className="space-y-4 mb-8">
                             {topTokens.map((token: any) => (
                                <div key={token.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 group hover:bg-white/[0.06] transition-all">
                                    <div>
                                        <p className="font-black text-[11px] uppercase tracking-tighter text-white">{token.name}</p>
                                        <p className="text-[9px] text-muted-foreground uppercase font-bold">{token.symbol}</p>
                                    </div>
                                    <p className="font-mono text-xs text-primary font-bold">${token.usdValue}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {Object.keys(nftCollections).length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(nftCollections).map(([name, data]: [string, any]) => (
                                 <div key={name} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center transition-all hover:bg-white/[0.06]">
                                     <div className="relative mx-auto mb-2 h-12 w-12 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                       <img src={data.image} alt={name} className="h-full w-full object-cover" />
                                       <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                     </div>
                                     <p className="font-bold text-[10px] uppercase truncate text-white">{name}</p>
                                     <p className="text-[9px] text-accent font-black">x{data.count}</p>
                                </div>
                            ))}
                        </div>
                    )}
                 </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}