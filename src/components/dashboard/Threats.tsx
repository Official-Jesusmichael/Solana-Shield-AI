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
    <div className="space-y-6 overflow-hidden md:px-0 px-2">
      <Card className="liquid-glass rim-light relative group border-white/10 overflow-hidden">
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
        <CardContent className="p-0">
          <div className={cn(
            "flex md:flex-col p-6 gap-6 pb-12",
            "flex-row overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory"
          )}>
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
                    "group/card relative flex flex-col md:flex-row items-start gap-6 rounded-[2rem] border p-7 transition-all duration-500 hover:bg-white/[0.06] bg-white/[0.03] shrink-0 snap-center shadow-xl",
                    "w-[85vw] md:w-full max-w-full",
                    config.border
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
                  
                  <div className={cn(
                    "relative mt-1 h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/10 transition-transform duration-500 group-hover/card:scale-110 shadow-2xl",
                    config.color
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="relative flex-grow w-full min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white truncate">
                        {threat.type.replace(/_/g, ' ')}
                      </h3>
                      <div className={cn(
                        'flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shrink-0 w-fit backdrop-blur-md shadow-sm',
                        config.color,
                        config.border
                      )}>
                        <div className={cn('h-1.5 w-1.5 rounded-full', config.dot, 'animate-pulse')} />
                        {config.text}
                      </div>
                    </div>
                    <p className="text-[12px] md:text-sm font-medium leading-relaxed text-muted-foreground/80 pr-4">
                      {threat.description}
                    </p>
                    
                    {threat.details && (
                      <div className="mt-6 relative group/payload">
                        <div className="flex items-center gap-2 mb-3">
                           <Fingerprint className="h-3.5 w-3.5 text-accent animate-pulse" />
                           <span className="text-[9px] font-black text-accent uppercase tracking-[0.2em]">Interrogate Payload</span>
                        </div>
                        
                        <ScrollArea className="w-full rounded-2xl bg-black/80 border border-white/10 p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]" orientation="horizontal" type="always">
                          <div className="flex items-center relative min-w-full">
                              <p className="text-[13px] md:text-sm font-mono text-white/90 whitespace-nowrap tracking-tight pr-12 leading-none">
                                {threat.details}
                              </p>
                              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-black/90 to-transparent pointer-events-none" />
                          </div>
                          <ScrollBar 
                            orientation="horizontal" 
                            className="h-2.5 bg-white/5 opacity-100 rounded-full mt-2" 
                          />
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Visual Indicator for Desktop Navigation */}
      <div className="hidden md:flex justify-center py-4 opacity-20 hover:opacity-50 transition-opacity">
         <div className="h-1 w-24 rounded-full bg-white/20" />
      </div>
    </div>
  );
}
