'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DetectSuspiciousWalletActivityOutput } from '@/ai/flows/detect-suspicious-wallet-activity';
import { AlertCircle, Shield, ShieldCheck, ShieldQuestion, Zap, Info, Bug, ShieldAlert } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type ThreatsResult = DetectSuspiciousWalletActivityOutput;

interface ThreatsProps {
  result: ThreatsResult | null;
  isLoading: boolean;
}

const severityConfig = {
  low: {
    icon: Info,
    color: 'bg-blue-500',
    borderColor: 'border-blue-400/20',
    bg: 'bg-blue-500/5',
    textColor: 'text-blue-400',
    text: 'Minor Anomaly',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-400/20',
    bg: 'bg-yellow-500/5',
    textColor: 'text-yellow-400',
    text: 'Audit Required',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500',
    borderColor: 'border-orange-400/20',
    bg: 'bg-orange-500/5',
    textColor: 'text-orange-400',
    text: 'High-Risk Profile',
  },
  critical: {
    icon: ShieldAlert,
    color: 'bg-destructive',
    borderColor: 'border-destructive/30',
    bg: 'bg-destructive/10',
    textColor: 'text-destructive',
    text: 'BREACH DETECTED',
    glow: 'shadow-[0_0_20px_rgba(255,0,0,0.3)]',
  },
  error: {
    icon: Bug,
    color: 'bg-gray-500',
    borderColor: 'border-gray-500/20',
    bg: 'bg-gray-500/5',
    textColor: 'text-gray-500',
    text: 'Engine Failure',
  }
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="clay-card border-white/5 p-8 backdrop-blur-2xl">
            <div className="flex gap-6">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-1/3 rounded-md" />
                <Skeleton className="h-4 w-full rounded-sm" />
                <Skeleton className="h-4 w-3/4 rounded-sm" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-20 text-center clay-card border-white/5 bg-black/20 backdrop-blur-3xl shadow-2xl">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-24 w-24 rounded-[2rem] bg-accent/10 flex items-center justify-center mb-10 border border-accent/20 shadow-[inset_0_2px_20px_rgba(20,241,149,0.15)]"
        >
          <ShieldCheck className="h-12 w-12 text-accent" />
        </motion.div>
        <CardTitle className="font-headline text-3xl font-black uppercase tracking-tighter">
          Security Integrity Optimal
        </CardTitle>
        <CardDescription className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground/40 max-w-sm leading-relaxed">
          Zero suspicious signatures found. Your digital infrastructure remains under absolute neural protection.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="clay-card border-white/5 overflow-hidden backdrop-blur-[40px] shadow-2xl">
        <CardHeader className="p-8 bg-white/[0.03] border-b border-white/5">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="font-headline text-base font-black uppercase tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
              AI Forensic Analysis
            </CardTitle>
          </div>
          <CardDescription className="text-xs leading-relaxed font-medium italic text-muted-foreground/80">
            {result.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {result.threats.map((threat, index) => {
            const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
            const Icon = config.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.15, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                className={cn(
                  "group relative flex items-start gap-6 rounded-[1.5rem] border p-6 transition-all duration-500 hover:bg-white/[0.04] hover:scale-[1.01] shadow-lg",
                  config.borderColor,
                  config.bg,
                  (threat.severity === 'critical' || threat.severity === 'high') && "border-l-[6px]"
                )}
              >
                <div className={cn(
                  "mt-1 h-12 w-12 shrink-0 rounded-[1.1rem] flex items-center justify-center bg-black/40 border border-white/10 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:rotate-12",
                  config.textColor
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">
                      {threat.type.replace(/_/g, ' ')}
                    </h3>
                    <Badge className={cn(
                      'text-[10px] font-black uppercase tracking-widest rounded-lg px-3 py-1.5 border-none text-white shadow-xl', 
                      config.color,
                      config.glow
                    )}>
                      {config.text}
                    </Badge>
                  </div>
                  <p className="text-[12px] font-medium leading-relaxed text-muted-foreground/80 pr-4">
                    {threat.description}
                  </p>
                  {threat.details && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 p-4 rounded-xl bg-black/60 border border-white/5 shadow-inner"
                    >
                      <p className="text-[10px] font-mono text-muted-foreground/60 break-all leading-tight">
                        <span className="text-accent mr-3 font-black uppercase tracking-[0.2em] bg-accent/5 px-2 py-0.5 rounded border border-accent/10">Payload_SIG:</span>
                        {threat.details}
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
