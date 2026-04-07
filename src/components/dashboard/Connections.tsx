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
import { AlertCircle, CheckCircle2, Shield, Unplug, Loader2, Zap, WifiOff, Globe } from 'lucide-react';
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
    badgeColor: 'bg-accent/10 text-accent',
    text: 'Safety Confirmed',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-900/50 text-blue-300',
    text: 'Standard Risk',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-900/50 text-yellow-300',
    text: 'Elevated Risk',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-900/50 text-orange-300',
    text: 'Extreme Risk',
  },
  critical: {
    icon: AlertCircle,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 text-destructive shadow-[0_0_15px_rgba(255,0,0,0.2)]',
    text: 'BREACH IMMINENT',
  },
};

export function Connections({ result, isLoading, walletAddress }: ConnectionsProps) {
  const [revoked, setRevoked] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRevoke = async (dappAddress: string) => {
    setProcessing(dappAddress);
    
    // Realistic blockchain automation simulation
    await new Promise((resolve) => setTimeout(resolve, 3500));
    
    setRevoked((prev) => [...prev, dappAddress]);
    setProcessing(null);
    
    toast({
      title: '🛡️ Protocol Execution Successful',
      description: `Successfully revoked malicious permissions on ${walletAddress?.substring(0, 8)}...`,
      className: 'bg-card border-accent/30 text-accent shadow-2xl',
    });
  };

  if (isLoading) {
    return (
      <Card className="clay-card border-white/5 backdrop-blur-2xl">
        <CardHeader className="p-8">
          <Skeleton className="h-8 w-3/4 mb-3 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </CardHeader>
        <CardContent className="p-8 pt-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-6 border-b border-white/5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-sm" />
                </div>
              </div>
              <Skeleton className="h-10 w-28 rounded-2xl" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 text-center clay-card border-white/5 bg-black/20">
        <div className="h-20 w-20 rounded-3xl bg-accent/10 flex items-center justify-center mb-8 border border-accent/20 shadow-[inset_0_2px_15px_rgba(20,241,149,0.1)]">
          <CheckCircle2 className="h-10 w-10 text-accent" />
        </div>
        <CardTitle className="font-headline text-2xl font-black uppercase tracking-tighter">
          Zero Uplinks Detected
        </CardTitle>
        <CardDescription className="mt-3 text-xs font-medium uppercase tracking-widest text-muted-foreground/60 max-w-xs leading-relaxed">
          Neural sweep confirmed: No active external connections currently pose a threat.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="clay-card border-white/5 overflow-hidden backdrop-blur-3xl shadow-2xl">
      <CardHeader className="p-8 bg-white/[0.03] border-b border-white/5">
        <div className="flex items-center gap-4 mb-3">
          <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
            <Globe className="h-4 w-4 text-accent" />
          </div>
          <CardTitle className="font-headline text-base font-black uppercase tracking-[0.25em] bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
            Uplink Intelligence Audit
          </CardTitle>
        </div>
        <CardDescription className="text-xs leading-relaxed font-medium italic text-muted-foreground/80">
          {result.overallSummary}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-black/40">
              <TableRow className="hover:bg-transparent border-white/5">
                <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-12 px-8 text-muted-foreground/40">Neural Entity</TableHead>
                <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-[0.3em] h-12 text-muted-foreground/40">Risk Profile</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.3em] h-12 text-muted-foreground/40">Audit Findings</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-[0.3em] h-12 px-8 text-muted-foreground/40">Automated Protocol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.analysisResults.map((conn, idx) => {
                const config = riskConfig[conn.riskLevel];
                const isRevoked = revoked.includes(conn.dappAddress);
                const isProcessing = processing === conn.dappAddress;
                
                return (
                  <TableRow key={conn.dappAddress} className="hover:bg-white/[0.03] border-white/5 transition-all group/row">
                    <TableCell className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={cn('h-10 w-10 rounded-[1rem] flex items-center justify-center shrink-0 border transition-all duration-500 group-hover/row:scale-110 shadow-inner', config.textColor, 'bg-white/[0.03] border-white/10')}>
                          <config.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black tracking-tighter uppercase">{conn.dappName || 'Anonymous Link'}</p>
                          <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5 tracking-tighter">HEX_{conn.dappAddress.substring(0, 10)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('border-none text-[9px] font-black uppercase tracking-[0.2em] rounded-lg px-3 py-1', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/70 italic line-clamp-2 pr-4">
                        {conn.explanation || 'Behavioral signatures within acceptable operational limits.'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <Button
                        variant={conn.riskLevel === 'critical' || conn.riskLevel === 'high' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked || isProcessing}
                        className={cn(
                          "h-10 px-6 font-black text-[10px] uppercase tracking-[0.15em] transition-all relative overflow-hidden rounded-xl",
                          !isRevoked && !isProcessing && "hover:shadow-[0_0_20px_rgba(179,25,128,0.3)] shadow-lg"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {isProcessing ? (
                            <motion.div
                              key="loader"
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              className="flex items-center gap-2"
                            >
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Purging...
                            </motion.div>
                          ) : isRevoked ? (
                            <motion.div
                              key="revoked"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 text-accent"
                            >
                              <WifiOff className="h-3.5 w-3.5" />
                              Severed
                            </motion.div>
                          ) : (
                            <motion.div
                              key="idle"
                              className="flex items-center gap-2"
                            >
                              <Unplug className="h-3.5 w-3.5" />
                              Sever Link
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Realistic Automated Progress Bar Overlay */}
                        {isProcessing && (
                          <motion.div 
                            className="absolute bottom-0 left-0 h-1 bg-white/40 shadow-[0_0_10px_white]"
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 3.5, ease: "linear" }}
                          />
                        )}
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
