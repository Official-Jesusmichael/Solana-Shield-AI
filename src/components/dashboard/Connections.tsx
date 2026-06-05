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
    text: 'VERIFIED',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    text: 'LOW',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    text: 'ELEVATED',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    text: 'HIGH',
  },
  critical: {
    icon: ShieldAlert,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 border-destructive/20 text-destructive',
    text: 'CRITICAL',
  },
};

const CopyableAddress = ({ address }: { address: string }) => {
  const { toast } = useToast();
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Uplink Copied",
      description: `Signature matched.`,
      className: 'liquid-glass-pro border-secondary/20 text-secondary rim-light-pro shadow-2xl',
    });
  };

  return (
    <div 
      onClick={handleCopy}
      className="group flex items-center gap-1.5 mt-1 opacity-40 hover:opacity-100 transition-all cursor-pointer"
    >
      <span className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">{address.substring(0, 8)}...</span>
      <Copy className="h-2.5 w-2.5 text-white/20 group-hover:text-secondary transition-colors" />
    </div>
  );
};

export function Connections({ result, isLoading, walletAddress }: ConnectionsProps) {
  const [revoked, setRevoked] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRevoke = async (dappAddress: string) => {
    setProcessing(dappAddress);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setRevoked((prev) => [...prev, dappAddress]);
    setProcessing(null);
    
    toast({
      title: '🛡️ Detached',
      description: `Disconnected from ${walletAddress?.substring(0, 8)}...`,
      className: 'liquid-glass-pro border-secondary/20 text-secondary rim-light-pro shadow-2xl',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="liquid-glass-pro rim-light-pro flex flex-col items-center justify-center p-16 text-center">
        <CheckCircle2 className="h-8 w-8 text-secondary mb-4" />
        <CardTitle className="text-sm font-black uppercase tracking-tighter text-white">
          Zero Uplinks
        </CardTitle>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass-pro rim-light-pro border-white/5 overflow-hidden shadow-xl">
      <CardHeader className="p-6 bg-white/[0.01] border-b border-white/10">
        <div className="flex items-center gap-4 mb-1">
          <Globe className="h-4 w-4 text-secondary" />
          <CardTitle className="text-[10px] font-black uppercase tracking-[0.4em] text-white">
            Network Uplinks
          </CardTitle>
        </div>
        <CardDescription className="text-[11px] leading-tight font-medium italic text-muted-foreground/60 max-w-4xl">
          {result.overallSummary.substring(0, 120)}...
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-white/[0.01]">
              <TableRow className="border-white/10 hover:bg-transparent h-12">
                <TableHead className="text-[8px] font-black uppercase tracking-[0.3em] px-6 text-white/40">Entity</TableHead>
                <TableHead className="hidden md:table-cell text-[8px] font-black uppercase tracking-[0.3em] text-white/40">Risk</TableHead>
                <TableHead className="text-[8px] font-black uppercase tracking-[0.3em] text-white/40">Audit</TableHead>
                <TableHead className="text-right text-[8px] font-black uppercase tracking-[0.3em] px-6 text-white/40">Protocol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.analysisResults.map((conn) => {
                const config = riskConfig[conn.riskLevel];
                const isRevoked = revoked.includes(conn.dappAddress);
                const isProcessing = processing === conn.dappAddress;
                
                return (
                  <TableRow key={conn.dappAddress} className="border-white/5 hover:bg-white/[0.02] h-16">
                    <TableCell className="px-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'h-9 w-9 rounded-xl flex items-center justify-center border transition-all duration-300 bg-white/[0.03] border-white/10',
                          config.textColor
                        )}>
                          <config.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[11px] font-black tracking-tighter uppercase text-white leading-tight">{conn.dappName || 'Unknown'}</p>
                          <CopyableAddress address={conn.dappAddress} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('text-[7px] font-black uppercase px-2 py-0.5 rounded-lg border-2', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-[10px] font-medium leading-tight text-muted-foreground/60 italic line-clamp-2 pr-4">
                        {conn.explanation}
                      </p>
                    </TableCell>
                    <TableCell className="text-right px-6">
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked || isProcessing}
                        className={cn(
                          "h-8 px-4 rounded-xl transition-all font-black text-[8px]",
                          isProcessing ? "bg-white/10" : isRevoked ? "text-secondary border-secondary/20" : "text-white/40 hover:text-white"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {isProcessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isRevoked ? (
                            <WifiOff className="h-3 w-3" />
                          ) : (
                            <Unplug className="h-3 w-3" />
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
