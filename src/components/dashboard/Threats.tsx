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
import { AlertCircle, Shield, ShieldCheck, ShieldQuestion, Zap, Info } from 'lucide-react';
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
    text: 'Verification Required',
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
    icon: AlertCircle,
    color: 'bg-destructive',
    borderColor: 'border-destructive/20',
    bg: 'bg-destructive/5',
    textColor: 'text-destructive',
    text: 'Critical Breach Vector',
  },
  error: {
    icon: AlertCircle,
    color: 'bg-gray-500',
    borderColor: 'border-gray-500/20',
    bg: 'bg-gray-500/5',
    textColor: 'text-gray-500',
    text: 'System Error',
  }
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="clay-card border-white/5 p-6">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center clay-card border-white/5">
        <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
          <ShieldCheck className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="font-headline text-xl font-black uppercase tracking-tight">
          Perfection Achieved
        </CardTitle>
        <CardDescription className="mt-2 text-xs font-medium max-w-[280px]">
          Neural auditing found no suspicious activity. Your digital wealth remains under absolute security protocol.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="clay-card border-white/5 overflow-hidden">
        <CardHeader className="p-6 bg-white/[0.02] border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Zap className="h-4 w-4 text-primary" />
            <CardTitle className="font-headline text-sm font-black uppercase tracking-widest">
              Neural Threat Analysis
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] leading-relaxed font-medium">
            {result.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {result.threats.map((threat, index) => {
            const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
            const Icon = config.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-start gap-5 rounded-2xl border p-5 transition-all hover:bg-white/[0.02]",
                  config.borderColor,
                  config.bg
                )}
              >
                <div className={cn("mt-1 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/5 shadow-inner", config.textColor)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-grow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                      {threat.type.replace(/_/g, ' ')}
                    </h3>
                    <Badge className={cn('text-[9px] font-black uppercase tracking-widest rounded-md px-2 py-0.5 border-none text-white', config.color)}>
                      {config.text}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80">
                    {threat.description}
                  </p>
                  {threat.details && (
                    <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-[9px] font-mono text-muted-foreground break-all leading-tight">
                        <span className="text-accent mr-2 font-black uppercase tracking-widest">Hex_ID:</span>
                        {threat.details}
                      </p>
                    </div>
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
