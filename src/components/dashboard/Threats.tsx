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
  ChevronRight,
  Copy
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

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
    text: 'MINOR ANOMALY',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500/20 text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400',
    text: 'NEURAL AUDIT REQ',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
    text: 'HIGH RISK PROFILE',
  },
  critical: {
    icon: ShieldAlert,
    color: 'bg-destructive/20 text-destructive',
    border: 'border-destructive/30',
    dot: 'bg-destructive',
    text: 'SYSTEM BREACH',
  },
  error: {
    icon: Bug,
    color: 'bg-gray-500/20 text-gray-400',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
    text: 'ENGINE FAILURE',
  }
};

const CopyableText = ({ text, label }: { text: string; label?: string }) => {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Evidence Copied",
      description: "Technical forensic string matched to clipboard.",
      className: 'liquid-glass-pro border-primary/20 text-primary rim-light-pro shadow-2xl',
    });
  };

  return (
    <div 
      onClick={handleCopy}
      className="group flex items-center justify-between gap-4 bg-black/40 px-6 py-4 rounded-2xl border border-white/5 hover:border-primary/30 hover:bg-white/[0.04] transition-all cursor-pointer w-full"
    >
      <p className="text-[12px] font-body text-white/70 break-words leading-loose line-clamp-2 pr-6">
        {text}
      </p>
      <Copy className="h-4 w-4 text-white/10 group-hover:text-primary transition-colors shrink-0" />
    </div>
  );
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-10">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="liquid-glass-pro p-10 border-white/5">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-3xl bg-white/5" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-10 w-3/4 rounded-lg bg-white/5" />
                  <Skeleton className="h-4 w-1/4 rounded-md bg-white/5" />
                </div>
              </div>
              <Skeleton className="h-32 w-full rounded-[2rem] bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="liquid-glass-pro flex flex-col items-center justify-center p-24 text-center rim-light-pro border-secondary/20">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="h-32 w-32 rounded-[3.5rem] bg-secondary/10 flex items-center justify-center mb-12 border border-secondary/30 shadow-[0_0_60px_rgba(20,241,149,0.2)]"
        >
          <ShieldCheck className="h-16 w-16 text-secondary" />
        </motion.div>
        <CardTitle className="font-headline text-4xl font-black uppercase tracking-tighter text-white mb-6">
          Integrity Optimal
        </CardTitle>
        <CardDescription className="text-[13px] font-bold uppercase tracking-[0.5em] text-muted-foreground/30 max-w-md leading-loose">
          Neural protocols confirm zero suspicious signatures. Your vault remains under absolute system protection.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-12 w-full max-w-full overflow-hidden pb-20">
      <div className="px-6 md:px-0">
        <div className="flex items-center gap-6 mb-6">
          <div className="h-14 w-14 rounded-3xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-2xl shadow-primary/20">
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
                "group/card relative flex flex-col items-stretch rounded-[3.5rem] border transition-all duration-700 bg-white/[0.02] shrink-0 snap-center",
                "w-[90vw] md:w-full max-w-full p-10 md:p-14",
                "liquid-glass-pro rim-light-pro shadow-3xl",
                config.border
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent opacity-60 pointer-events-none rounded-[3.5rem]" />
              
              <div className="relative z-10 flex flex-col gap-12">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
                  <div className="flex items-center gap-8">
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
                        'mt-5 flex items-center gap-3 px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] border w-fit backdrop-blur-3xl shadow-xl',
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
                  <div className="mt-8 space-y-10">
                    <div className="flex items-center justify-between border-b border-white/10 pb-6">
                      <div className="flex items-center gap-4">
                         <div className="h-11 w-11 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/30 shadow-lg">
                           <Fingerprint className="h-5 w-5 text-secondary animate-neural-pulse" />
                         </div>
                         <span className="text-[11px] font-black text-white/70 uppercase tracking-[0.4em]">Neural Signature Interrogation</span>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                        <Activity className="h-4 w-4 text-secondary" />
                        <span className="text-[10px] font-black text-secondary uppercase tracking-[0.3em]">Active Forensic Audit</span>
                      </div>
                    </div>
                    
                    <CopyableText text={threat.details} />
                    
                    <div className="mt-6 flex items-center gap-6 opacity-30">
                       <div className="h-px flex-1 bg-white/20" />
                       <span className="text-[9px] font-body text-white uppercase tracking-[0.6em] font-black">Forensic Evidence Layer • DM Sans</span>
                       <div className="h-px flex-1 bg-white/20" />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {/* MOBILE SCROLL HINT */}
      <div className="md:hidden flex justify-center mt-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="liquid-glass-pro px-8 py-5 flex items-center gap-6 border-white/20 rim-light-pro shadow-2xl bg-white/[0.05]"
        >
          <div className="flex items-center gap-2">
            <motion.div animate={{ x: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <ChevronLeft className="h-4 w-4 text-secondary/50" />
            </motion.div>
            <div className="relative">
              <MoveHorizontal className="h-5 w-5 text-secondary" />
              <motion.div animate={{ scale: [1, 1.8, 1], opacity: [0, 0.5, 0] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute inset-0 bg-secondary rounded-full blur-xl" />
            </div>
            <motion.div animate={{ x: [4, -4, 4] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
              <ChevronRight className="h-4 w-4 text-secondary/50" />
            </motion.div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white leading-none">
            Swipe Findings
          </span>
        </motion.div>
      </div>
    </div>
  );
}
