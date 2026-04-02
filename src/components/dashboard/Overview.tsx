'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  HeartPulse,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
  Activity,
  Target,
  Brain
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
    100 - criticalThreats * 20 - (threatCount - criticalThreats) * 5 - riskyConnections * 15
  );

  const stats = [
    {
      label: 'Security Score',
      value: `${securityScore}/100`,
      subLabel: 'Neural Integrity',
      icon: Target,
      color: securityScore > 80 ? 'text-accent' : securityScore > 50 ? 'text-yellow-400' : 'text-destructive',
      glow: securityScore > 80 ? 'shadow-accent/20' : securityScore > 50 ? 'shadow-yellow-400/20' : 'shadow-destructive/20',
    },
    {
      label: 'Neural Threats',
      value: threatCount,
      subLabel: `${criticalThreats} Critical Findings`,
      icon: Brain,
      color: 'text-primary',
      glow: 'shadow-primary/20',
    },
    {
      label: 'Network Links',
      value: connectionsResult?.analysisResults?.length ?? 0,
      subLabel: `${riskyConnections} High-Risk dApps`,
      icon: LinkIcon,
      color: 'text-accent',
      glow: 'shadow-accent/20',
    },
    {
      label: 'Engine Status',
      value: 'Operational',
      subLabel: 'v2.8 Deep Scan',
      icon: Activity,
      color: 'text-accent',
      glow: 'shadow-accent/20',
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-6 w-1 bg-primary rounded-full" />
        <h2 className="font-headline text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
          Strategic Asset Overview
        </h2>
      </div>
      
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
          >
            <Card className="neumorphic-card border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-5">
                <CardTitle className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                  {stat.label}
                </CardTitle>
                <div className={cn("p-1.5 rounded-lg bg-white/[0.03] border border-white/5", stat.color)}>
                  <stat.icon className="h-3.5 w-3.5" />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className={cn("text-2xl font-black font-headline tracking-tighter", stat.color)}>
                  {stat.value}
                </div>
                <p className="text-[9px] font-medium text-muted-foreground/60 mt-1 uppercase tracking-wider">
                  {stat.subLabel}
                </p>
              </CardContent>
              {/* Material Glow Base */}
              <div className={cn("absolute bottom-0 left-0 w-full h-0.5 opacity-30", stat.color.replace('text-', 'bg-'))} />
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
