'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { DetectSuspiciousWalletActivityOutput } from '@/ai/flows/detect-suspicious-wallet-activity';
import { 
  AlertCircle, 
  Shield, 
  ShieldCheck, 
  Zap, 
  Info, 
  Bug, 
  ShieldAlert, 
  Fingerprint, 
  Activity,
  MoveHorizontal,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
    text: 'Minor Anomaly Detected',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500/20 text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400',
    text: 'Neural Audit Required',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
    text: 'High Risk Profile Identified',
  },
  critical: {
    icon: ShieldAlert,
    color: 'bg-destructive/20 text-destructive',
    border: 'border-destructive/30',
    dot: 'bg-destructive',
    text: 'SYSTEM BREACH DETECTED',
  },
  error: {
    icon: Bug,
    color: 'bg-gray-500/20 text-gray-400',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
    text: 'AI Forensic Engine Failure',
  }
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-10">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="liquid-glass p-10 border-white/5">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <Skeleton className="h-16 w-16 rounded-[1.5rem] bg-white/5" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-8 w-3/4 rounded-lg bg-white/5" />
                  <Skeleton className="h-4 w-1/4 rounded-md bg-white/5" />
                </div>
              </div>
              <Skeleton className="h-32 w-full rounded-3xl bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="liquid-glass flex flex-col items-center justify-center p-24 text-center rim-light border-accent/20">
        <motion.div 
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="h-32 w-32 rounded-[3.5rem] bg-accent/10 flex items-center justify-center mb-12 border border-accent/30 shadow-[0_0_50px_rgba(20,241,149,0.2)]"
        >
          <ShieldCheck className="h-16 w-16 text-accent" />
        </motion.div>
        <CardTitle className="font-headline text-4xl font-black uppercase tracking-tighter text-white mb-6">
          System Integrity Optimal
        </CardTitle>
        <CardDescription className="text-[12px] font-bold uppercase tracking-[0.5em] text-muted-foreground/30 max-w-md leading-loose">
          Neural protocols confirm zero suspicious signatures. Your digital infrastructure remains under absolute protection.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-12 w-full max-w-full overflow-hidden pb-20">
      <div className="px-6 md:px-0">
        <div className="flex items-center gap-6 mb-6">
          <div className="h-14 w-14 rounded-[1.75rem] bg-primary/20 flex items-center justify-center border border-primary/30 shadow-2xl shadow-primary/20">
            <Zap className="h-7 w-7 text-primary animate-neural-pulse" />
          </div>
          <div>
            <h2 className="text-[14px] font-black uppercase tracking-[0.5em] text-white">Forensic Audit Summary</h2>
            <p className="text-[13px] font-medium italic text-muted-foreground/70 mt-2 tracking-tight">{result.summary}</p>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex md:flex-col gap-10 px-6 md:px-0",
        "flex-row overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory"
      )}>
        {result.threats.map((threat, index) => {
          const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
          const Icon = config.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.98, y: 30 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ delay: index * 0.1, duration: 1, ease: [0.23, 1, 0.32, 1] }}
              className={cn(
                "group/card relative flex flex-col items-stretch rounded-[3.5rem] border transition-all duration-700 hover:bg-white/[0.05] bg-white/[0.02] shrink-0 snap-center",
                "w-[90vw] md:w-full max-w-full p-10 md:p-14",
                "liquid-glass rim-light shadow-3xl",
                config.border
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-60 pointer-events-none rounded-[3.5rem]" />
              
              <div className="relative z-10 flex flex-col gap-10">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
                  <div className="flex items-center gap-7">
                    <div className={cn(
                      "h-20 w-20 shrink-0 rounded-[2.25rem] flex items-center justify-center bg-white/[0.03] border border-white/10 shadow-2xl transition-all duration-700 group-hover/card:scale-110 group-hover/card:rotate-6",
                      config.color
                    )}>
                      <Icon className="h-10 w-10" />
                    </div>
                    <div>
                      <h3 className="text-[28px] md:text-[36px] font-black uppercase tracking-tighter text-white leading-[1.1]">
                        {threat.type.replace(/_/g, ' ')}
                      </h3>
                      <div className={cn(
                        'mt-4 flex items-center gap-3 px-5 py-1.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.25em] border w-fit backdrop-blur-3xl shadow-lg',
                        config.color,
                        config.border
                      )}>
                        <div className={cn('h-2 w-2 rounded-full', config.dot, 'animate-neural-pulse')} />
                        {config.text}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                   <p className="text-[18px] md:text-[22px] font-medium leading-relaxed text-white/90 max-w-5xl tracking-tight">
                    {threat.description}
                  </p>
                </div>
                
                {threat.details && (
                  <div className="mt-10 space-y-8">
                    <div className="flex items-center justify-between border-b border-white/10 pb-6">
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/30 shadow-lg shadow-accent/10">
                           <Fingerprint className="h-5 w-5 text-accent animate-neural-pulse" />
                         </div>
                         <span className="text-[11px] font-black text-white/70 uppercase tracking-[0.4em]">Neural Signature Deep Interrogation</span>
                      </div>
                      <div className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-white/5 border border-white/10 shadow-inner">
                        <Activity className="h-4 w-4 text-accent" />
                        <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Active Forensic Audit</span>
                      </div>
                    </div>
                    
                    <div className="relative group/tray overflow-hidden rounded-[3rem] border border-white/10 bg-black/50 backdrop-blur-3xl p-10 shadow-[inset_0_2px_20px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-all duration-700">
                        <div className="absolute left-8 top-10 bottom-10 w-px bg-gradient-to-b from-accent/50 via-accent/10 to-transparent" />
                        
                        <div className="pl-12 space-y-4">
                           <p className="text-[14px] font-body text-white/80 break-words leading-loose font-normal tracking-tight selection:bg-accent/30">
                            {threat.details}
                          </p>
                        </div>

                        <div className="absolute top-0 right-0 p-6 opacity-30">
                           <div className="h-2 w-2 rounded-full bg-accent animate-ping" />
                        </div>
                        
                        <div className="mt-10 flex items-center gap-6 opacity-30">
                           <div className="h-px flex-1 bg-white/20" />
                           <span className="text-[9px] font-body text-white uppercase tracking-[0.6em] font-black">Forensic Evidence Layer • DM Sans Core</span>
                           <div className="h-px flex-1 bg-white/20" />
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      <div className="md:hidden flex justify-center mt-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="liquid-glass-accent px-8 py-5 flex items-center gap-6 border-white/20 rim-light shadow-2xl shadow-accent/5 bg-white/[0.05]"
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ x: [-4, 4, -4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronLeft className="h-4 w-4 text-accent/50" />
            </motion.div>
            <div className="relative">
              <MoveHorizontal className="h-5 w-5 text-accent" />
              <motion.div 
                animate={{ scale: [1, 1.8, 1], opacity: [0, 0.5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute inset-0 bg-accent rounded-full blur-xl"
              />
            </div>
            <motion.div
              animate={{ x: [4, -4, 4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronRight className="h-4 w-4 text-accent/50" />
            </motion.div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white leading-none">
            Swipe Neural Dossiers
          </span>
        </motion.div>
      </div>

      <div className="hidden md:flex justify-center pt-12 pb-16 opacity-5">
         <div className="h-px w-96 rounded-full bg-gradient-to-r from-transparent via-white to-transparent" />
      </div>
    </div>
  );
}
