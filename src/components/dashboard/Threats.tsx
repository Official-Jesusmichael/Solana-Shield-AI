'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
      <div className="space-y-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="liquid-glass p-8 rim-light">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-2xl bg-white/5" />
                <Skeleton className="h-6 w-1/2 rounded-md bg-white/5" />
              </div>
              <Skeleton className="h-20 w-full rounded-xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="liquid-glass flex flex-col items-center justify-center p-20 text-center rim-light">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-24 w-24 rounded-[2.5rem] bg-accent/10 flex items-center justify-center mb-10 border border-accent/20 shadow-2xl shadow-accent/20"
        >
          <ShieldCheck className="h-12 w-12 text-accent" />
        </motion.div>
        <CardTitle className="font-headline text-3xl font-black uppercase tracking-tighter text-white">
          Integrity Optimal
        </CardTitle>
        <CardDescription className="mt-4 text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground/40 max-w-sm leading-relaxed">
          Zero suspicious signatures identified. Your digital infrastructure remains under absolute neural protection.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden">
      {/* Container header for the list */}
      <div className="px-4 md:px-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-10 w-10 rounded-[1.25rem] bg-primary/20 flex items-center justify-center border border-white/10 shadow-lg shadow-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-white">Forensic Audit Summary</h2>
            <p className="text-[11px] font-medium italic text-muted-foreground/60 mt-1">{result.summary}</p>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex md:flex-col gap-8 pb-16 px-4 md:px-0",
        "flex-row overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory"
      )}>
        {result.threats.map((threat, index) => {
          const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
          const Icon = config.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className={cn(
                "group/card relative flex flex-col items-stretch rounded-[3rem] border transition-all duration-700 hover:bg-white/[0.04] bg-white/[0.02] shrink-0 snap-center",
                "w-[90vw] md:w-full max-w-full p-8 md:p-10",
                "liquid-glass rim-light",
                config.border
              )}
            >
              {/* Refractive Glow Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-50 pointer-events-none rounded-[3rem]" />
              
              <div className="relative z-10 flex flex-col gap-8">
                {/* Header Module */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "h-14 w-14 shrink-0 rounded-[1.75rem] flex items-center justify-center bg-white/[0.03] border border-white/10 shadow-2xl transition-transform duration-700 group-hover/card:scale-110 group-hover/card:rotate-3",
                      config.color
                    )}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-[18px] md:text-[22px] font-black uppercase tracking-tighter text-white leading-tight">
                        {threat.type.replace(/_/g, ' ')}
                      </h3>
                      <div className={cn(
                        'mt-2 flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border w-fit backdrop-blur-xl',
                        config.color,
                        config.border
                      )}>
                        <div className={cn('h-1.5 w-1.5 rounded-full', config.dot, 'animate-pulse')} />
                        {config.text}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Module */}
                <div className="space-y-4">
                   <p className="text-[15px] md:text-[17px] font-medium leading-relaxed text-muted-foreground/90 max-w-3xl">
                    {threat.description}
                  </p>
                </div>
                
                {/* Documentation Terminal Module */}
                {threat.details && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                       <Fingerprint className="h-4 w-4 text-accent animate-pulse" />
                       <span className="text-[11px] font-black text-accent uppercase tracking-[0.3em]">Interrogation Tray</span>
                    </div>
                    
                    <div className="relative group/terminal overflow-hidden rounded-[2rem] border border-white/10 bg-black/60 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_2px_10px_rgba(0,0,0,0.8)] backdrop-blur-3xl">
                      <ScrollArea className="w-full" orientation="horizontal" type="always">
                        <div className="p-7 flex items-center relative min-w-full">
                            <p className="text-[14px] md:text-[16px] font-mono text-white/100 whitespace-nowrap tracking-tight pr-12 leading-none font-bold">
                              {threat.details}
                            </p>
                        </div>
                        <ScrollBar 
                          orientation="horizontal" 
                          className="h-3 bg-white/5 opacity-100 rounded-full mb-1 mx-4" 
                        />
                      </ScrollArea>
                      {/* Terminal edge fade */}
                      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* Visual Navigation Accent */}
      <div className="hidden md:flex justify-center pt-4 pb-12 opacity-10">
         <div className="h-0.5 w-32 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
      </div>
    </div>
  );
}
