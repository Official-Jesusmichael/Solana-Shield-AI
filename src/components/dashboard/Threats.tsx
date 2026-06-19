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
  Copy,
  ExternalLink
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

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
    text: 'MINOR',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500/20 text-yellow-400',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-400',
    text: 'RE-AUDIT',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20',
    dot: 'bg-orange-400',
    text: 'HIGH RISK',
  },
  critical: {
    icon: ShieldAlert,
    color: 'bg-destructive/20 text-destructive',
    border: 'border-destructive/30',
    dot: 'bg-destructive',
    text: 'BREACH',
  },
  error: {
    icon: Bug,
    color: 'bg-gray-500/20 text-gray-400',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
    text: 'FAILURE',
  }
};

const CopyableText = ({ text }: { text: string }) => {
  const { toast } = useToast();
  const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text.trim());

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast({
      title: "Evidence Copied",
      description: "Technical forensic string matched.",
      className: 'liquid-glass-pro border-primary/20 text-primary rim-light-pro shadow-2xl',
    });
  };

  return (
    <div className="flex items-center gap-1 group w-full">
      <div className={cn(
        "flex items-center justify-between gap-3 bg-black/40 px-4 py-3 rounded-l-xl border border-white/5 border-r-0 hover:border-primary/30 transition-all flex-1",
        isAddress && "cursor-pointer"
      )}>
        {isAddress ? (
          <a 
            href={`https://solscan.io/account/${text}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full group/link"
          >
            <p className="text-[10px] font-body text-white/70 break-words leading-relaxed line-clamp-1 pr-4">
              {text}
            </p>
            <ExternalLink className="h-3 w-3 text-white/10 group-hover/link:text-primary transition-colors shrink-0" />
          </a>
        ) : (
          <p className="text-[10px] font-body text-white/70 break-words leading-relaxed line-clamp-1 pr-4">
            {text}
          </p>
        )}
      </div>
      <button 
        onClick={handleCopy}
        className="flex items-center justify-center bg-black/40 px-4 py-3 rounded-r-xl border border-white/5 hover:border-primary/30 transition-all h-[43px]"
        title="Copy Evidence"
      >
        <Copy className="h-3 w-3 text-white/10 group-hover:text-primary transition-colors shrink-0" />
      </button>
    </div>
  );
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="liquid-glass-pro p-6 border-white/5 rim-light-pro">
            <Skeleton className="h-20 w-full rounded-2xl bg-white/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="liquid-glass-pro rim-light-pro flex flex-col items-center justify-center p-12 text-center border-secondary/20">
        <div className="h-20 w-20 rounded-[2rem] bg-secondary/10 flex items-center justify-center mb-6 border border-secondary/30 shadow-[0_0_30px_rgba(20,241,149,0.1)]">
          <ShieldCheck className="h-10 w-10 text-secondary" />
        </div>
        <CardTitle className="font-headline text-lg font-black uppercase tracking-tighter text-white mb-2">
          Integrity Optimal
        </CardTitle>
        <CardDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/30 max-w-[240px]">
          Neural protocols confirm zero suspicious signatures.
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-full overflow-hidden pb-12">
      <div className="px-6 md:px-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/20">
            <Zap className="h-5 w-5 text-primary animate-neural-pulse" />
          </div>
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-white">Forensic Summary</h2>
            <p className="text-[10px] font-medium italic text-muted-foreground/70 mt-1">{result.summary.substring(0, 100)}...</p>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex md:flex-col gap-6 px-6 md:px-0",
        "flex-row overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory"
      )}>
        {result.threats.map((threat, index) => {
          const config = severityConfig[threat.severity as keyof typeof severityConfig] || severityConfig.error;
          const Icon = config.icon;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.6 }}
              className={cn(
                "group/card relative flex flex-col items-stretch rounded-[2.5rem] border transition-all duration-500 bg-white/[0.02] shrink-0 snap-center",
                "w-[85vw] md:w-full max-w-full p-6 md:p-8",
                "liquid-glass-pro rim-light-pro shadow-xl",
                config.border
              )}
            >
              <div className="relative z-10 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/10 shadow-lg",
                      config.color
                    )}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-[18px] md:text-[22px] font-black uppercase tracking-tighter text-white leading-tight">
                        {threat.type.replace(/_/g, ' ')}
                      </h3>
                      <div className={cn(
                        'mt-2 flex items-center gap-2 px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-[0.2em] border w-fit backdrop-blur-3xl shadow-md',
                        config.color,
                        config.border
                      )}>
                        <div className={cn('h-1.5 w-1.5 rounded-full', config.dot, 'animate-neural-pulse')} />
                        {config.text}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[13px] md:text-[15px] font-medium leading-relaxed text-white/80 max-w-4xl tracking-tight">
                  {threat.description}
                </p>
                
                {threat.details && (
                  <div className="mt-2 space-y-4">
                    <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-3">
                       <Fingerprint className="h-3.5 w-3.5 text-secondary" />
                       <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em]">Interrogation</span>
                    </div>
                    <CopyableText text={threat.details} />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      
      <div className="md:hidden flex justify-center mt-6 px-6">
        <div className="liquid-glass-pro rim-light-pro px-6 py-3 flex items-center gap-4 border-white/20 shadow-xl bg-white/[0.03]">
          <div className="flex items-center gap-2">
            <ChevronLeft className="h-3 w-3 text-secondary/40" />
            <MoveHorizontal className="h-4 w-4 text-secondary" />
            <ChevronRight className="h-3 w-3 text-secondary/40" />
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">Slide</span>
        </div>
      </div>
    </div>
  );
}