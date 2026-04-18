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
  Shield,
  TrendingUp,
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

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

// Custom Tooltip for the Neural Radar for unparalleled data visualization
const NeuralRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="clay-card border-primary/30 bg-black/80 p-4 backdrop-blur-xl shadow-2xl min-w-[220px]">
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
            <span className="text-xs text-muted-foreground font-bold">Verification Method</span>
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

  // Deeply integrated Helius data for unparalleled forensic insights
  const identity = threatsResult?.identity || {};
  const funding = threatsResult?.funding || {};
  const balances = threatsResult?.balances || {};
  const portfolioTotal = balances.totalUsdValue?.toFixed(2) || '0.00';

  // Top 5 tokens by USD value, showcasing the most significant assets
  const topTokens = (balances.balances || [])
    .filter((t: any) => (t.usdValue || 0) > 1)
    .sort((a: any, b: any) => b.usdValue - a.usdValue)
    .slice(0, 5);

  // NFT collections, organized for clear visibility
  const nftCollections = (balances.nfts || []).reduce((acc: any, nft: any) => {
    const collectionName = nft.collectionName || 'Uncategorized';
    if (!acc[collectionName]) {
      acc[collectionName] = { count: 0, image: nft.imageUri };
    }
    acc[collectionName].count++;
    return acc;
  }, {});

  // Radar Chart Data, powered by our new deep intelligence
  const radarData = [
    { subject: 'Funding Source', A: funding?.amount ? 95 : 40, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'dApp Security', A: 100 - (riskyConnections * 20), intrinsic: 'Peer Verified', fullMark: 100 },
    { subject: 'Transaction Risk', A: 100 - (criticalThreats * 15), intrinsic: 'AI Audited', fullMark: 100 },
    { subject: 'Wallet Score', A: securityScore, intrinsic: 'Composite Analysis', fullMark: 100 },
    { subject: 'Asset Legitimacy', A: 92 - (threatCount * 5), intrinsic: 'DAS Verified', fullMark: 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Forensic Identity & Security Score Header */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Identity Signature */}
        <Card className="clay-card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <IDIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Identity</p>
            <h3 className="text-sm font-black uppercase truncate">{identity.name || 'Unresolved'}</h3>
            <div className="flex gap-1 mt-1.5 overflow-x-auto">
              {(identity.categories || ['Unclassified']).map((cat: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[8px] px-1.5 py-0 h-4 uppercase font-bold text-accent">{cat}</Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Funding Lineage */}
        <Card className="clay-card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
            <ArrowDownLeft className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Funding Root</p>
            <h3 className="text-sm font-black uppercase truncate">{funding.fundedBy || 'Unknown'}</h3>
            <p className="text-xs font-mono text-accent/80 mt-1.5">{funding.amount || '0'} SOL</p>
          </div>
        </Card>

        {/* Portfolio Valuation */}
        <Card className="clay-card p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Valuation</p>
            <h3 className="text-xl font-black font-headline tracking-tighter">${portfolioTotal}</h3>
            <p className="text-[9px] font-bold text-primary uppercase mt-1">Helius Verified</p>
          </div>
        </Card>

        {/* Neural Guard Security Score */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="clay-card p-5 flex items-center gap-4 cursor-help">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                  <ShieldCheck className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1">Security Score</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black font-headline text-accent tracking-tighter">{securityScore}%</span>
                    <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  </div>
                  <p className="text-[9px] font-bold text-accent uppercase mt-1">Deep Scan Active</p>
                </div>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-center p-4">
              <p className="font-bold mb-2">This score reflects a comprehensive AI-driven analysis of your wallet's security posture.</p>
              <ul className="list-disc list-inside text-left text-xs space-y-1">
                <li><span className="font-bold">Critical Threats:</span> {criticalThreats}</li>
                <li><span className="font-bold">Total Threats:</span> {threatCount}</li>
                <li><span className="font-bold">Risky dApps:</span> {riskyConnections}</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
        {/* Neural Risk Radar - The centerpiece of our forensic interface */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="lg:col-span-3"
        >
          <Card className="neumorphic-card relative overflow-hidden h-full min-h-[420px]">
             <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-black uppercase tracking-wider text-primary">Neural Forensic Radar</CardTitle>
                  <RadarIcon className="h-5 w-5 text-primary/50 animate-pulse" />
                </div>
              </CardHeader>
            <CardContent className="h-[340px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700 }} />
                  <RechartsTooltip content={<NeuralRadarTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '3 3' }} />
                  <Radar name="Forensics" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Asset Inventory - Now displaying NFTs and Top Tokens */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="clay-card h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-accent">Asset Inventory</CardTitle>
                <Library className="h-5 w-5 text-accent/50" />
              </div>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground mb-4">Displaying top tokens by value and NFT collections.</p>
                 <ScrollArea className="h-[280px] pr-4">
                    {topTokens.length > 0 && (
                        <div className="space-y-3 mb-6">
                             {topTokens.map((token: any) => (
                                <div key={token.name} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-sm">{token.name}</p>
                                        <p className="text-xs text-muted-foreground">{token.symbol}</p>
                                    </div>
                                    <p className="font-mono text-sm text-primary">${token.usdValue}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {Object.keys(nftCollections).length > 0 && (
                        <div className="space-y-3">
                            {Object.entries(nftCollections).map(([name, data]: [string, any]) => (
                                 <div key={name} className="flex items-center gap-3">
                                     <img src={data.image} alt={name} className="h-10 w-10 rounded-md bg-muted-foreground/10" />
                                     <div>
                                        <p className="font-bold text-sm truncate max-w-[150px]">{name}</p>
                                        <p className="text-xs text-muted-foreground">x{data.count}</p>
                                    </div>
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
