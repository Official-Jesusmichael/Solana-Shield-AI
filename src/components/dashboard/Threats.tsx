'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DetectSuspiciousWalletActivityOutput } from '@/ai/flows/detect-suspicious-wallet-activity';
import { AlertCircle, Shield, ShieldCheck, Zap, Info, Bug, ShieldAlert, Fingerprint, Activity } from 'lucide-react';
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
    <div className="space-y-8 w-full max-w-full overflow-hidden pb-12">
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
        "flex md:flex-col gap-8 px-4 md:px-0",
        "flex-row overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory"
      )}>
        {result.threats.map((threat, index) => {
          const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
          const Icon = config.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
              className={cn(
                "group/card relative flex flex-col items-stretch rounded-[3rem] border transition-all duration-700 hover:bg-white/[0.04] bg-white/[0.02] shrink-0 snap-center",
                "w-[90vw] md:w-full max-w-full p-8 md:p-12",
                "liquid-glass rim-light",
                config.border
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent opacity-50 pointer-events-none rounded-[3rem]" />
              
              <div className="relative z-10 flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "h-14 w-14 shrink-0 rounded-[1.75rem] flex items-center justify-center bg-white/[0.03] border border-white/10 shadow-2xl transition-transform duration-700 group-hover/card:scale-110 group-hover/card:rotate-3",
                      config.color
                    )}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-[20px] md:text-[26px] font-black uppercase tracking-tighter text-white leading-tight">
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

                <div className="space-y-4">
                   <p className="text-[16px] md:text-[18px] font-medium leading-relaxed text-muted-foreground/90 max-w-4xl">
                    {threat.description}
                  </p>
                </div>
                
                {threat.details && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                           <Fingerprint className="h-4 w-4 text-accent animate-pulse" />
                         </div>
                         <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Interrogation Tray</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                        <Activity className="h-3 w-3 text-accent" />
                        <span className="text-[8px] font-black text-accent uppercase tracking-widest">Neural Signature</span>
                      </div>
                    </div>
                    
                    <div className="relative group/tray overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/60 backdrop-blur-3xl p-8 shadow-inner ring-1 ring-white/5 transition-all duration-500">
                        <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-accent/40 via-accent/5 to-transparent" />
                        
                        <div className="pl-8 space-y-2">
                           <p className="text-[14px] md:text-[15px] font-mono text-white/70 break-words leading-loose font-normal tracking-tight">
                            {threat.details}
                          </p>
                        </div>

                        <div className="absolute top-0 right-0 p-4 opacity-20">
                           <div className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                        </div>
                        
                        <div className="mt-8 flex items-center gap-4 opacity-40">
                           <div className="h-px flex-1 bg-white/10" />
                           <span className="text-[8px] font-mono text-white uppercase tracking-[0.5em]">Forensic Evidence Layer</span>
                           <div className="h-px flex-1 bg-white/10" />
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      <div className="hidden md:flex justify-center pt-8 pb-12 opacity-10">
         <div className="h-0.5 w-64 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
      </div>
    </div>
  );
}
