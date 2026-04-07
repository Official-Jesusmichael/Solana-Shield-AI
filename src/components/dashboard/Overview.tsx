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
  Zap,
  Fingerprint,
  ShieldCheck,
  Cpu,
  Unplug
} from 'lucide-react';
import type { ThreatsResult } from './Threats';
import type { ConnectionsResult } from './Connections';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

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

  const stats = [
    {
      label: 'Security Posture',
      value: `${securityScore}%`,
      subLabel: 'Vault Integrity',
      icon: Target,
      color: securityScore > 80 ? 'text-accent' : securityScore > 50 ? 'text-yellow-400' : 'text-destructive',
      glow: securityScore > 80 ? 'bg-accent/20 shadow-accent/30' : securityScore > 50 ? 'bg-yellow-400/20 shadow-yellow-400/30' : 'bg-destructive/20 shadow-destructive/30',
    },
    {
      label: 'Neural Anomalies',
      value: threatCount,
      subLabel: `${criticalThreats} High-Priority`,
      icon: Brain,
      color: 'text-primary',
      glow: 'bg-primary/20 shadow-primary/30',
    },
    {
      label: 'Verified Uplinks',
      value: connectionsResult?.analysisResults?.length ?? 0,
      subLabel: `${riskyConnections} Non-Trusted`,
      icon: Unplug,
      color: 'text-accent',
      glow: 'bg-accent/20 shadow-accent/30',
    },
    {
      label: 'Core Protocol',
      value: 'v2.9.4',
      subLabel: 'Engine Active',
      icon: Cpu,
      color: 'text-blue-400',
      glow: 'bg-blue-400/20 shadow-blue-400/30',
    },
  ];

  return (
    <div className="mb-10">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-8 w-1.5 bg-primary rounded-full shadow-[0_0_15px_rgba(179,25,128,0.6)]" />
        <h2 className="font-headline text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
          Strategic Neural Overview
        </h2>
      </div>
      
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -8, scale: 1.02 }}
          >
            <Card className="neumorphic-card border-white/5 relative overflow-hidden group backdrop-blur-[40px] shadow-2xl">
              {/* Animated Inner Glow Overlay */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-6 px-6">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                  {stat.label}
                </CardTitle>
                <div className={cn("p-2 rounded-xl border border-white/10 shadow-lg transition-all duration-500 group-hover:scale-110", stat.glow)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-2">
                <div className={cn("text-3xl font-black font-headline tracking-tighter drop-shadow-lg", stat.color)}>
                  {stat.value}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/40 mt-2 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="h-3 w-3 animate-pulse" />
                  {stat.subLabel}
                </p>
              </CardContent>
              
              {/* Material Bottom Accent Beam */}
              <div className={cn("absolute bottom-0 left-0 w-full h-1 opacity-40 blur-[1px]", stat.color.replace('text-', 'bg-'))} />
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
