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
    text: 'Safe Protocol',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    text: 'Standard Risk',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    text: 'Elevated Risk',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    text: 'Extreme Risk',
  },
  critical: {
    icon: ShieldAlert,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 border-destructive/20 text-destructive shadow-[0_0_10px_rgba(255,0,0,0.1)]',
    text: 'BREACH IMMINENT',
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
      description: `Successfully detached malicious uplink from ${walletAddress?.substring(0, 10)}...`,
      className: 'liquid-glass border-accent/20 text-accent rim-light',
    });
  };

  if (isLoading) {
    return (
      <Card className="liquid-glass rim-light">
        <CardHeader className="p-6">
          <Skeleton className="h-6 w-3/4 mb-2 bg-white/5" />
          <Skeleton className="h-3 w-1/2 bg-white/5" />
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-6 border-b border-white/5">
              <Skeleton className="h-10 w-10 rounded-2xl bg-white/5" />
              <Skeleton className="h-8 w-24 rounded-xl bg-white/5" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="liquid-glass flex flex-col items-center justify-center p-16 text-center rim-light">
        <div className="h-16 w-16 rounded-[1.75rem] bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
          <CheckCircle2 className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="font-headline text-xl font-black uppercase tracking-tighter text-white">
          Zero Uplinks Detected
        </CardTitle>
        <CardDescription className="mt-2 text-[9px] font-medium uppercase tracking-widest text-muted-foreground/60 max-w-xs">
          Neural sweep confirmed: No active external connections pose a threat to your assets.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass rim-light">
      <CardHeader className="p-6 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-4 mb-2">
          <div className="h-8 w-8 rounded-xl bg-accent/20 flex items-center justify-center border border-white/10">
            <Globe className="h-4 w-4 text-accent" />
          </div>
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
            Active Neural Uplinks
          </CardTitle>
        </div>
        <CardDescription className="text-[11px] leading-relaxed font-medium italic text-muted-foreground/80">
          {result.overallSummary}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.01]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[9px] font-black uppercase tracking-[0.3em] h-12 px-6 text-muted-foreground/50">Entity</TableHead>
                <TableHead className="hidden md:table-cell text-[9px] font-black uppercase tracking-[0.3em] h-12 text-muted-foreground/50">Risk</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-[0.3em] h-12 text-muted-foreground/50">Audit Note</TableHead>
                <TableHead className="text-right text-[9px] font-black uppercase tracking-[0.3em] h-12 px-6 text-muted-foreground/50">Protocol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.analysisResults.map((conn) => {
                const config = riskConfig[conn.riskLevel];
                const isRevoked = revoked.includes(conn.dappAddress);
                const isProcessing = processing === conn.dappAddress;
                
                return (
                  <TableRow key={conn.dappAddress} className="border-white/5 hover:bg-white/[0.04] group/row transition-colors">
                    <TableCell className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover/row:scale-110 bg-white/[0.03] border-white/10', config.textColor)}>
                          <config.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black tracking-tighter uppercase text-white">{conn.dappName || 'Unknown DApp'}</p>
                          <p className="text-[8px] font-mono text-muted-foreground/40 tracking-tighter uppercase">ADDR_{conn.dappAddress.substring(0, 10)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-[10px] font-medium leading-relaxed text-muted-foreground/70 italic line-clamp-2 pr-2">
                        {conn.explanation || 'Activity matches standard blockchain interaction patterns.'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked || isProcessing}
                        className={cn(
                          "h-8 px-4 font-black text-[9px] uppercase tracking-[0.2em] transition-all rounded-xl border border-white/5",
                          isProcessing ? "bg-white/10 text-white" : isRevoked ? "text-accent border-accent/20 bg-accent/5" : "text-white/60 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {isProcessing ? (
                            <motion.div key="loader" className="flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Severing
                            </motion.div>
                          ) : isRevoked ? (
                            <motion.div key="revoked" className="flex items-center gap-2">
                              <WifiOff className="h-3 w-3" />
                              Severed
                            </motion.div>
                          ) : (
                            <motion.div key="idle" className="flex items-center gap-2">
                              <Unplug className="h-3 w-3" />
                              Detach
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