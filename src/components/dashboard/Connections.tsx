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
import { AlertCircle, CheckCircle2, Shield, Unplug, Loader2, WifiOff, Globe, ShieldAlert, Copy } from 'lucide-react';
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
    textColor: 'text-secondary',
    badgeColor: 'bg-secondary/10 border-secondary/20 text-secondary',
    text: 'VERIFIED PROTOCOL',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    text: 'STANDARD RISK',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    text: 'ELEVATED RISK',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    text: 'HIGH PROBABILITY',
  },
  critical: {
    icon: ShieldAlert,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 border-destructive/20 text-destructive',
    text: 'BREACH IMMINENT',
  },
};

const CopyableAddress = ({ address }: { address: string }) => {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Uplink Copied",
      description: `Signature matched to clipboard.`,
      className: 'liquid-glass-pro border-secondary/20 text-secondary rim-light-pro shadow-2xl',
    });
  };

  return (
    <div 
      onClick={handleCopy}
      className="group flex items-center gap-2 mt-1.5 opacity-40 hover:opacity-100 transition-all cursor-pointer"
    >
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">ADDR_{address.substring(0, 12)}...</span>
      <Copy className="h-3 w-3 text-white/20 group-hover:text-secondary transition-colors" />
    </div>
  );
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
      className: 'liquid-glass-pro border-secondary/20 text-secondary rim-light-pro shadow-2xl',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[2.5rem] bg-white/5" />
        ))}
      </div>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="liquid-glass-pro flex flex-col items-center justify-center p-24 text-center border-secondary/10">
        <div className="h-20 w-20 rounded-[2.5rem] bg-secondary/10 flex items-center justify-center mb-10 border border-secondary/20 shadow-2xl">
          <CheckCircle2 className="h-10 w-10 text-secondary" />
        </div>
        <CardTitle className="font-headline text-2xl font-black uppercase tracking-tighter text-white mb-4">
          Zero Neural Uplinks
        </CardTitle>
        <CardDescription className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground/30 max-w-sm leading-loose">
          Deep system sweep confirmed: No active external connections pose a threat to your digital vault.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass-pro border-white/5 overflow-hidden shadow-3xl">
      <CardHeader className="p-10 bg-white/[0.02] border-b border-white/10">
        <div className="flex items-center gap-6 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-secondary/20 flex items-center justify-center border border-white/20 shadow-xl">
            <Globe className="h-6 w-6 text-secondary animate-neural-pulse" />
          </div>
          <CardTitle className="text-[13px] font-black uppercase tracking-[0.5em] text-white">
            Active Network Uplinks
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
                          'h-14 w-14 rounded-2xl flex items-center justify-center border transition-all duration-700 group-hover/row:scale-110 group-hover/row:rotate-6 bg-white/[0.04] border-white/10',
                          config.textColor
                        )}>
                          <config.icon className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-[14px] font-black tracking-tighter uppercase text-white leading-tight">{conn.dappName || 'Unknown Entity'}</p>
                          <CopyableAddress address={conn.dappAddress} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-xl border-2 backdrop-blur-3xl', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="text-[12px] font-medium leading-relaxed text-muted-foreground/80 italic line-clamp-3 pr-6 tracking-tight">
                        {conn.explanation || 'Activity matches established signatures for standard protocols.'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right px-10">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked || isProcessing}
                        className={cn(
                          "h-11 px-8 rounded-2xl transition-all duration-500 font-black tracking-widest",
                          isProcessing ? "bg-white/20 text-white" : isRevoked ? "text-secondary border-secondary/40 bg-secondary/10" : "text-white/60 hover:text-white"
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
