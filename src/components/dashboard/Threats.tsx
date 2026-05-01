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
import { AlertCircle, Shield, ShieldCheck, Zap, Info, Bug, ShieldAlert, Fingerprint } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';

export type ThreatsResult = DetectSuspiciousWalletActivityOutput;

interface ThreatsProps {
  result: ThreatsResult | null;
  isLoading: boolean;
}

const severityConfig = {
  low: {
    icon: Info,
    color: 'bg-blue-500/20 text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
    text: 'Minor Anomaly',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500/20 text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400',
    text: 'Audit Required',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
    text: 'High Risk Profile',
  },
  critical: {
    icon: ShieldAlert,
    color: 'bg-destructive/20 text-destructive',
    border: 'border-destructive/20',
    dot: 'bg-destructive',
    text: 'BREACH DETECTED',
  },
  error: {
    icon: Bug,
    color: 'bg-gray-500/20 text-gray-400',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
    text: 'Engine Failure',
  }
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="liquid-glass p-6 rim-light">
            <div className="flex gap-6">
              <Skeleton className="h-12 w-12 rounded-2xl bg-white/5" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-1/3 rounded-md bg-white/5" />
                <Skeleton className="h-3 w-full rounded-sm bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="liquid-glass flex flex-col items-center justify-center p-16 text-center rim-light">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-20 w-20 rounded-[2rem] bg-accent/10 flex items-center justify-center mb-8 border border-accent/20 shadow-2xl shadow-accent/20"
        >
          <ShieldCheck className="h-10 w-10 text-accent" />
        </motion.div>
        <CardTitle className="font-headline text-2xl font-black uppercase tracking-tighter text-white">
          Security Integrity Optimal
        </CardTitle>
        <CardDescription className="mt-3 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40 max-w-xs leading-relaxed">
          Zero suspicious signatures found. Your digital infrastructure remains under absolute neural protection.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="liquid-glass rim-light relative group">
        {/* Aesthetic Fade Masks */}
        <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-card/40 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/40 to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <CardHeader className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-8 w-8 rounded-xl bg-primary/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(153,69,255,0.2)]">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
              AI Forensic Audit Findings
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] leading-relaxed font-medium italic text-muted-foreground/80">
            {result.summary}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <ScrollArea className="max-h-[600px] w-full pr-4">
            <div className="space-y-4 pb-6">
              {result.threats.map((threat, index) => {
                const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group/card relative flex flex-col md:flex-row items-start gap-5 rounded-[1.75rem] border p-5 transition-all duration-500 hover:bg-white/[0.06] bg-white/[0.02] overflow-hidden",
                      config.border
                    )}
                  >
                    {/* Interior Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                    
                    <div className={cn(
                      "relative mt-1 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center bg-white/[0.03] border border-white/10 transition-transform duration-500 group-hover/card:scale-110 shadow-lg",
                      config.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="relative flex-grow w-full min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-white truncate">
                          {threat.type.replace(/_/g, ' ')}
                        </h3>
                        <div className={cn(
                          'flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 w-fit backdrop-blur-md shadow-sm',
                          config.color,
                          config.border
                        )}>
                          <div className={cn('h-1.5 w-1.5 rounded-full', config.dot, 'animate-pulse')} />
                          {config.text}
                        </div>
                      </div>
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80 pr-4">
                        {threat.description}
                      </p>
                      
                      {threat.details && (
                        <div className="mt-4 relative group/payload">
                          <ScrollArea className="w-full rounded-2xl bg-black/40 border border-white/5 p-4 shadow-inner" orientation="horizontal">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <Fingerprint className="h-3 w-3 text-accent/60" />
                                <span className="text-[8px] font-black text-accent/60 uppercase tracking-widest">Forensic Payload</span>
                              </div>
                              <p className="text-[9px] font-mono text-muted-foreground/40 whitespace-nowrap tracking-wider pr-4">
                                {threat.details}
                              </p>
                            </div>
                            <ScrollBar orientation="horizontal" className="h-2 mt-2" />
                          </ScrollArea>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
