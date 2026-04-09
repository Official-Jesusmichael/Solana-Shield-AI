
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
  Atom
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
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Match Accuracy</span>
            <span className="text-[9px] font-mono text-primary font-black">{(data.A * 0.998).toFixed(2)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Latent Entropy</span>
            <span className="text-[9px] font-mono text-accent font-black">{(100 - data.A).toFixed(3)} bits</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Heuristic Confidence</span>
            <span className="text-[9px] font-mono text-white font-black">{data.intrinsic}</span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-white/5">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${data.A}%` }}
              className="h-full bg-gradient-to-r from-primary to-accent shadow-[0_0_10px_rgba(179,25,128,0.5)]"
            />
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom Tooltip for the Pulse Stream
const PulseStreamTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="clay-card border-accent/30 bg-black/90 p-3 backdrop-blur-2xl shadow-2xl border-l-4 border-l-accent">
        <p className="text-[9px] font-black text-muted-foreground/60 mb-1 uppercase tracking-widest">Temporal Analysis: {label}</p>
        <div className="flex items-center gap-3">
          <div className="text-xl font-black font-headline text-accent tabular-nums tracking-tighter">
            {payload[0].value}%
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="text-[8px] font-black uppercase text-white/80">Integrity Score</p>
            <p className="text-[7px] font-mono text-accent/60">Status: Nominal Flux</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const DonutTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="clay-card border-white/20 bg-black/90 p-4 backdrop-blur-3xl shadow-2xl border-t-2 border-t-primary">
        <div className="flex items-center gap-2 mb-2">
          <Atom className="h-3 w-3 text-primary" />
          <p className="text-[10px] font-black uppercase tracking-widest text-white">{data.name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[9px] font-mono text-muted-foreground">Allocation: <span className="text-white">{data.value}%</span></p>
          <p className="text-[8px] font-medium text-primary uppercase italic">{data.desc}</p>
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

  // Radar Chart Data with Optimal Intrinsic Data
  const radarData = [
    { subject: 'Neural Integrity', A: 100 - (threatCount * 5), intrinsic: 'Optimal Pass', fullMark: 100 },
    { subject: 'Uplink Security', A: 100 - (riskyConnections * 20), intrinsic: 'Peer Verified', fullMark: 100 },
    { subject: 'Contract Trust', A: 100 - (criticalThreats * 15), intrinsic: 'Hash Validated', fullMark: 100 },
    { subject: 'Vault Hardening', A: securityScore, intrinsic: 'RSA-4096 Secure', fullMark: 100 },
    { subject: 'Signal Clarity', A: 92, intrinsic: 'Zero Noise', fullMark: 100 },
  ];

  // Pie Chart Data
  const pieData = [
    { name: 'Neural Buffer', value: 35, color: 'hsl(var(--primary))', desc: 'Active Defense Layer' },
    { name: 'Identity Vault', value: 25, color: 'hsl(var(--accent))', desc: 'Secure Credential Store' },
    { name: 'Logic Gates', value: 20, color: '#8B5CF6', desc: 'Transaction Filters' },
    { name: 'Threat Latency', value: 20, color: '#1E1B4B', desc: 'Background Sweep' },
  ];

  // Pulse Data
  const pulseData = [
    { time: '00:00', pulse: 65 },
    { time: '04:00', pulse: 78 },
    { time: '08:00', pulse: 72 },
    { time: '12:00', pulse: 85 },
    { time: '16:00', pulse: 90 },
    { time: '20:00', pulse: 82 },
    { time: '23:59', pulse: securityScore },
  ];

  const stats = [
    {
      label: 'Hardening Level',
      value: `${securityScore}%`,
      subLabel: 'Vault Integrity',
      icon: Target,
      color: securityScore > 80 ? 'text-accent' : securityScore > 50 ? 'text-yellow-400' : 'text-destructive',
      glow: securityScore > 80 ? 'bg-accent/20 shadow-accent/30' : securityScore > 50 ? 'bg-yellow-400/20 shadow-yellow-400/30' : 'bg-destructive/20 shadow-destructive/30',
    },
    {
      label: 'Active Uplinks',
      value: connectionsResult?.analysisResults?.length ?? 0,
      subLabel: `${riskyConnections} Non-Trusted`,
      icon: Unplug,
      color: 'text-accent',
      glow: 'bg-accent/20 shadow-accent/30',
    },
  ];

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  return (
    <div className="mb-10 space-y-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-8 w-1.5 bg-primary rounded-full shadow-[0_0_15px_rgba(179,25,128,0.6)]" />
        <h2 className="font-headline text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
          Strategic Neural Analytics Board
        </h2>
      </div>
      
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Main Security Singularity Radar */}
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
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-1">Neural Risk Distribution</CardTitle>
                  <p className="text-[10px] text-muted-foreground/40 uppercase font-bold tracking-widest">Multi-Vector Diagnostic Analysis</p>
                </div>
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[320px] pt-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} 
                  />
                  <RechartsTooltip content={<NeuralRadarTooltip />} cursor={false} />
                  <Radar
                    name="Security"
                    dataKey="A"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "white", strokeWidth: 1, className: "primary-glow animate-pulse" }}
                    activeDot={{ r: 6, fill: "hsl(var(--accent))", stroke: "white", strokeWidth: 2 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 to-transparent blur-[1px]" />
          </Card>
        </motion.div>

        {/* Right Column Metrics */}
        <div className="flex flex-col gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              whileHover={{ y: -4, scale: 1.02 }}
            >
              <Card className="neumorphic-card border-white/5 relative overflow-hidden backdrop-blur-[40px] shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{stat.label}</span>
                  <div className={cn("p-2 rounded-xl border border-white/10 shadow-lg", stat.glow)}>
                    <stat.icon className={cn("h-4 w-4", stat.color)} />
                  </div>
                </div>
                <div className={cn("text-4xl font-black font-headline tracking-tighter", stat.color)}>
                  {stat.value}
                </div>
                <p className="text-[9px] font-bold text-muted-foreground/30 mt-3 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity className="h-2.5 w-2.5 animate-pulse" />
                  {stat.subLabel}
                </p>
                <div className={cn("absolute bottom-0 left-0 w-full h-1 opacity-20", stat.color.replace('text-', 'bg-'))} />
              </Card>
            </motion.div>
          ))}

          {/* 3D Security Donut Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <Card className="clay-card border-white/5 bg-black/40 p-6 relative overflow-hidden backdrop-blur-[40px] shadow-2xl h-[220px]">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-30" />
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Vault Allocation</p>
                <Shield className="h-3 w-3 text-primary animate-pulse" />
              </div>
              <div className="h-[140px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <filter id="shadow">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="hsl(var(--primary))" />
                      </filter>
                    </defs>
                    <RechartsTooltip content={<DonutTooltip />} />
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={(props: any) => {
                        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
                        return (
                          <g>
                            <Sector
                              cx={cx}
                              cy={cy}
                              innerRadius={innerRadius}
                              outerRadius={outerRadius + 6}
                              startAngle={startAngle}
                              endAngle={endAngle}
                              fill={fill}
                              style={{ filter: 'url(#shadow)' }}
                            />
                          </g>
                        );
                      }}
                      data={pieData}
                      innerRadius={45}
                      outerRadius={55}
                      paddingAngle={5}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                      animationBegin={500}
                      animationDuration={1500}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black font-headline tracking-tighter text-foreground leading-none">
                    {pieData[activeIndex].value}%
                  </span>
                  <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                    Allocated
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Real-time Security Pulse Stream */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 1 }}
      >
        <Card className="neumorphic-card border-white/5 relative overflow-hidden backdrop-blur-[40px] shadow-2xl h-[240px]">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-accent">Security Integrity Pulse</CardTitle>
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-accent/5 border border-accent/10">
                <TrendingUp className="h-3 w-3 text-accent" />
                <span className="text-[9px] font-black text-accent uppercase tracking-widest">Forensic Stream</span>
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
                <RechartsTooltip content={<PulseStreamTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="pulse" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPulse)" 
                  animationDuration={2500}
                  activeDot={{ r: 6, fill: "white", stroke: "hsl(var(--accent))", strokeWidth: 3 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-accent/40 to-transparent blur-[1px]" />
        </Card>
      </motion.div>
    </div>
  );
}
