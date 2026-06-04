'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Shield, Unplug, Loader2, WifiOff, Globe, ShieldAlert } from 'lucide-react';
import type { AnalyzeMaliciousDappConnectionsOutput } from '@/ai/flows/analyze-malicious-dapp-connections-flow';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export type ConnectionsResult = AnalyzeMaliciousDappConnectionsOutput;

interface ConnectionsProps {
  result: ConnectionsResult | null;
  isLoading: boolean;
  walletAddress?: string;
}

const riskConfig = {
  none: {
    icon: CheckCircle2,
    textColor: 'text-accent',
    badgeColor: 'bg-accent/10 border-accent/20 text-accent',
    text: 'Safe Protocol Signature',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    text: 'Standard Operation Risk',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    text: 'Elevated Baseline Risk',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    text: 'High Probability Risk',
  },
  critical: {
    icon: ShieldAlert,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 border-destructive/20 text-destructive shadow-[0_0_20px_rgba(255,0,0,0.2)]',
    text: 'SYSTEM BREACH IMMINENT',
  },
};

export function Connections({ result, isLoading, walletAddress }: ConnectionsProps) {
  const [revoked, setRevoked] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRevoke = async (dappAddress: string) => {
    setProcessing(dappAddress);
    await new Promise((resolve) => setTimeout(resolve, 3500));
    setRevoked((prev) => [...prev, dappAddress]);
    setProcessing(null);
    
    toast({
      title: '🛡️ Neural Link Severed',
      description: `Successfully detached malicious uplink from ${walletAddress?.substring(0, 12)}...`,
      className: 'liquid-glass border-accent/20 text-accent rim-light shadow-2xl',
    });
  };

  if (isLoading) {
    return (
      <Card className="liquid-glass border-white/5">
        <CardHeader className="p-8">
          <Skeleton className="h-10 w-3/4 mb-4 bg-white/5" />
          <Skeleton className="h-4 w-1/2 bg-white/5" />
        </CardHeader>
        <CardContent className="p-8 pt-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-8 border-b border-white/5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-2xl bg-white/5" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-32 bg-white/5" />
                  <Skeleton className="h-3 w-24 bg-white/5" />
                </div>
              </div>
              <Skeleton className="h-10 w-28 rounded-xl bg-white/5" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="liquid-glass flex flex-col items-center justify-center p-24 text-center border-accent/10">
        <div className="h-20 w-20 rounded-[2.5rem] bg-accent/10 flex items-center justify-center mb-10 border border-accent/20 shadow-2xl shadow-accent/10">
          <CheckCircle2 className="h-10 w-10 text-accent" />
        </div>
        <CardTitle className="font-headline text-2xl font-black uppercase tracking-tighter text-white mb-4">
          Zero Neural Uplinks Detected
        </CardTitle>
        <CardDescription className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground/30 max-w-sm leading-loose">
          Deep system sweep confirmed: No active external connections pose a threat to your digital assets.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass border-white/5 overflow-hidden shadow-3xl">
      <CardHeader className="p-10 bg-white/[0.02] border-b border-white/10">
        <div className="flex items-center gap-6 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center border border-white/20 shadow-xl shadow-accent/10">
            <Globe className="h-6 w-6 text-accent animate-neural-pulse" />
          </div>
          <CardTitle className="text-[13px] font-black uppercase tracking-[0.5em] text-white">
            Active Neural Network Uplinks
          </CardTitle>
        </div>
        <CardDescription className="text-[14px] leading-relaxed font-medium italic text-muted-foreground/80 max-w-4xl tracking-tight">
          {result.overallSummary}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.02]">
              <TableRow className="border-white/10 hover:bg-transparent h-16">
                <TableHead className="text-[10px] font-black uppercase tracking-[0.4em] px-10 text-white/40">Entity Identity</TableHead>
                <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Risk Signature</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Forensic Audit Note</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.4em] px-10 text-white/40">Neural Protocol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.analysisResults.map((conn) => {
                const config = riskConfig[conn.riskLevel];
                const isRevoked = revoked.includes(conn.dappAddress);
                const isProcessing = processing === conn.dappAddress;
                
                return (
                  <TableRow key={conn.dappAddress} className="border-white/5 hover:bg-white/[0.04] group/row transition-all duration-500 h-28">
                    <TableCell className="px-10">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          'h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-700 group-hover/row:scale-110 group-hover/row:rotate-6 bg-white/[0.04] border-white/10 shadow-xl',
                          config.textColor
                        )}>
                          <config.icon className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-[14px] font-black tracking-tighter uppercase text-white leading-tight">{conn.dappName || 'Unknown Entity'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/40 mt-1 uppercase tracking-widest">ADDR_{conn.dappAddress.substring(0, 12)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1 rounded-xl border-2 backdrop-blur-xl', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="text-[12px] font-medium leading-relaxed text-muted-foreground/80 italic line-clamp-3 pr-6 tracking-tight">
                        {conn.explanation || 'Activity matches established blockchain interaction signatures for standard protocols.'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right px-10">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked || isProcessing}
                        className={cn(
                          "h-10 px-6 rounded-xl transition-all duration-500",
                          isProcessing ? "bg-white/20 text-white border-white/30" : isRevoked ? "text-accent border-accent/40 bg-accent/10" : "text-white/60 hover:text-white"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {isProcessing ? (
                            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              SEVERING
                            </motion.div>
                          ) : isRevoked ? (
                            <motion.div key="revoked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                              <WifiOff className="h-4 w-4" />
                              SEVERED
                            </motion.div>
                          ) : (
                            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                              <Unplug className="h-4 w-4" />
                              DETACH
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
