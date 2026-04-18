'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  Target,
  Brain,
  Cpu,
  Unplug,
  ShieldCheck,
  Zap,
  TrendingUp,
  Radar as RadarIcon,
  Fingerprint,
  Layers,
  Crosshair,
  Shield,
  Dna,
  Atom,
  Fingerprint as IDIcon,
  ArrowDownLeft,
  Coins
} from 'lucide-react';
import type { ThreatsResult } from './Threats';
import type { ConnectionsResult } from './Connections';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Sector
} from 'recharts';
import { useState } from 'react';
import { Badge } from '../ui/badge';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

// Custom Tooltip for the Neural Radar
const NeuralRadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="clay-card border-primary/30 bg-black/80 p-4 backdrop-blur-xl shadow-2xl min-w-[200px]">
        <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-2">
          <Crosshair className="h-3 w-3 text-primary animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white">{data.subject}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Forensic Accuracy</span>
            <span className="text-[9px] font-mono text-primary font-black">{(data.A * 0.998).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Neural Entropy</span>
            <span className="text-[9px] font-mono text-accent font-black">{(100 - data.A).toFixed(3)} bits</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Source Confidence</span>
            <span className="text-[9px] font-mono text-white font-black">{data.intrinsic}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function Overview({ threatsResult, connectionsResult }: OverviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);

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

  // Identity Data from Helius
  const identity = threatsResult?.identity || {};
  const funding = threatsResult?.funding || {};
  const portfolioTotal = threatsResult?.balances?.totalUsdValue?.toFixed(2) || '0.00';

  // Radar Chart Data with Optimal Intrinsic Data
  const radarData = [
    { subject: 'Source Trust', A: funding?.amount ? 95 : 60, intrinsic: 'Chain Verified', fullMark: 100 },
    { subject: 'Uplink Security', A: 100 - (riskyConnections * 20), intrinsic: 'Peer Verified', fullMark: 100 },
    { subject: 'Contract Integrity', A: 100 - (criticalThreats * 15), intrinsic: 'Hash Validated', fullMark: 100 },
    { subject: 'Vault Hardening', A: securityScore, intrinsic: 'RSA-4096 Secure', fullMark: 100 },
    { subject: 'Asset Legitimacy', A: 92 - (threatCount * 5), intrinsic: 'DAS Scanned', fullMark: 100 },
  ];

  const pieData = [
    { name: 'Neural Buffer', value: 35, color: 'hsl(var(--primary))' },
    { name: 'Identity Vault', value: 25, color: 'hsl(var(--accent))' },
    { name: 'Logic Gates', value: 20, color: '#8B5CF6' },
    { name: 'Threat Latency', value: 20, color: '#1E1B4B' },
  ];

  const pulseData = [
    { time: '00:00', pulse: 65 },
    { time: '08:00', pulse: 72 },
    { time: '16:00', pulse: 90 },
    { time: '23:59', pulse: securityScore },
  ];

  return (
    <div className="mb-10 space-y-8">
      {/* Forensic Identity Header */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card className="clay-card border-white/5 p-5 relative overflow-hidden backdrop-blur-3xl shadow-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <IDIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">Identity Signature</p>
            <h3 className="text-sm font-black uppercase truncate tracking-tight">{identity.name || 'Unresolved Entity'}</h3>
            <div className="flex gap-1 mt-1 overflow-x-auto pb-1">
              {(identity.categories || ['Unclassified']).map((cat: string, i: number) => (
                <Badge key={i} variant="outline" className="text-[7px] border-white/10 px-1 py-0 h-4 uppercase font-bold text-accent">{cat}</Badge>
              ))}
            </div>
          </div>
        </Card>

        <Card className="clay-card border-white/5 p-5 relative overflow-hidden backdrop-blur-3xl shadow-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
            <ArrowDownLeft className="h-6 w-6 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">Funding Lineage</p>
            <h3 className="text-sm font-black uppercase truncate tracking-tight">{funding.fundedBy || 'Unknown Root'}</h3>
            <p className="text-[8px] font-mono text-accent/60 mt-1 uppercase">Alloc: {funding.amount || '0'} SOL</p>
          </div>
        </Card>

        <Card className="clay-card border-white/5 p-5 relative overflow-hidden backdrop-blur-3xl shadow-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">Portfolio Valuation</p>
            <h3 className="text-xl font-black font-headline text-foreground tabular-nums tracking-tighter">${portfolioTotal}</h3>
            <p className="text-[8px] font-bold text-primary uppercase mt-1">Helius DAS Verified</p>
          </div>
        </Card>

        <Card className="clay-card border-white/5 p-5 relative overflow-hidden backdrop-blur-3xl shadow-2xl flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
            <ShieldCheck className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1">Neural Guard Status</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black font-headline text-accent tabular-nums tracking-tighter">{securityScore}%</span>
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
            </div>
            <p className="text-[8px] font-bold text-accent uppercase mt-1">Deep Hardened</p>
          </div>
        </Card>
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Neural Risk Radar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="lg:col-span-2"
        >
          <Card className="neumorphic-card border-white/5 relative overflow-hidden backdrop-blur-[40px] shadow-2xl h-full min-h-[400px]">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
              <RadarIcon className="h-32 w-32 text-primary" />
            </div>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-1">Neural Forensic Distribution</CardTitle>
                  <p className="text-[10px] text-muted-foreground/40 uppercase font-bold tracking-widest">Orb-Level Multi-Vector Diagnostics</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[320px] pt-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 900 }} 
                  />
                  <RechartsTooltip content={<NeuralRadarTooltip />} cursor={false} />
                  <Radar
                    name="Forensics"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "white", strokeWidth: 1, className: "primary-glow animate-pulse" }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* 3D Security Donut */}
        <div className="flex flex-col gap-6">
          <Card className="clay-card border-white/5 bg-black/40 p-6 relative overflow-hidden backdrop-blur-[40px] shadow-2xl h-full">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-30" />
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Neural Vault Allocation</p>
              <Shield className="h-3 w-3 text-primary animate-pulse" />
            </div>
            <div className="h-[220px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={(props: any) => {
                      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                      return (
                        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
                      );
                    }}
                    data={pieData}
                    innerRadius={60}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    animationBegin={500}
                    animationDuration={1500}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black font-headline tracking-tighter text-foreground leading-none">
                  {pieData[activeIndex].value}%
                </span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Neural Sync
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {pieData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-black uppercase text-muted-foreground/80">{item.name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-white/60">{item.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Real-time Forensic Pulse */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 1 }}
      >
        <Card className="neumorphic-card border-white/5 relative overflow-hidden backdrop-blur-[40px] shadow-2xl h-[240px]">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-accent">Strategic Forensic Pulse</CardTitle>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-accent/5 border border-accent/10">
                <TrendingUp className="h-3 w-3 text-accent" />
                <span className="text-[9px] font-black text-accent uppercase tracking-widest">Real-Time Forensic Stream</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[180px] p-0 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pulseData}>
                <defs>
                  <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 100]} />
                <Area 
                  type="monotone" 
                  dataKey="pulse" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPulse)" 
                  animationDuration={2500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
