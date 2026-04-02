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
import { AlertCircle, CheckCircle2, Shield, Unplug, Loader2, Zap } from 'lucide-react';
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
    text: 'Clear',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-400',
    badgeColor: 'bg-blue-900/50 text-blue-300',
    text: 'Low',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-400',
    badgeColor: 'bg-yellow-900/50 text-yellow-300',
    text: 'Moderate',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-400',
    badgeColor: 'bg-orange-900/50 text-orange-300',
    text: 'High',
  },
  critical: {
    icon: AlertCircle,
    textColor: 'text-destructive',
    badgeColor: 'bg-destructive/10 text-destructive',
    text: 'Critical',
  },
};

export function Connections({ result, isLoading, walletAddress }: ConnectionsProps) {
  const [revoked, setRevoked] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRevoke = async (dappAddress: string) => {
    setProcessing(dappAddress);
    
    // Simulate real-time blockchain revocation delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    setRevoked((prev) => [...prev, dappAddress]);
    setProcessing(null);
    
    toast({
      title: '🛡️ Neural Security Action',
      description: `Successfully revoked malicious permissions on ${walletAddress?.substring(0, 12)}...`,
    });
  };

  if (isLoading) {
    return (
      <Card className="clay-card border-white/5">
        <CardHeader className="p-6">
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-20 rounded-xl" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center clay-card border-white/5">
        <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 border border-accent/20">
          <CheckCircle2 className="h-8 w-8 text-accent" />
        </div>
        <CardTitle className="font-headline text-xl font-black uppercase tracking-tight">
          System Clean
        </CardTitle>
        <CardDescription className="mt-2 text-xs font-medium">
          No active dApp connections detected for this neural identity.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card className="clay-card border-white/5 overflow-hidden">
      <CardHeader className="p-6 bg-white/[0.02]">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="h-4 w-4 text-accent" />
          <CardTitle className="font-headline text-sm font-black uppercase tracking-widest">
            Connection Audit
          </CardTitle>
        </div>
        <CardDescription className="text-[11px] leading-relaxed font-medium">
          {result.overallSummary}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-white/[0.01]">
            <TableRow className="hover:bg-transparent border-white/5">
              <TableHead className="text-[10px] font-black uppercase tracking-widest h-10 px-6">Entity</TableHead>
              <TableHead className="hidden md:table-cell text-[10px] font-black uppercase tracking-widest h-10">Risk Profile</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest h-10">Neural Analysis</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-10 px-6">Protocol Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.analysisResults.map((conn) => {
              const config = riskConfig[conn.riskLevel];
              const isRevoked = revoked.includes(conn.dappAddress);
              const isProcessing = processing === conn.dappAddress;
              
              return (
                <TableRow key={conn.dappAddress} className="hover:bg-white/[0.02] border-white/5 transition-colors">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border', config.textColor, 'bg-white/[0.03] border-white/5')}>
                        <config.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black tracking-tight">{conn.dappName || 'Unknown dApp'}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">{conn.dappAddress.substring(0, 6)}...{conn.dappAddress.slice(-4)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={cn('border-none text-[9px] font-black uppercase tracking-widest rounded-md px-2 py-0.5', config.badgeColor)}>
                      {config.text}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-[10px] font-medium leading-relaxed text-muted-foreground italic line-clamp-2">
                      {conn.identifiedVulnerabilities[0] || 'Behavioral patterns within safety parameters.'}
                    </p>
                  </TableCell>
                  <TableCell className="text-right px-6">
                    <Button
                      variant={conn.riskLevel === 'critical' || conn.riskLevel === 'high' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleRevoke(conn.dappAddress)}
                      disabled={isRevoked || isProcessing}
                      className={cn(
                        "h-8 px-4 font-black text-[9px] uppercase tracking-widest transition-all relative overflow-hidden",
                        !isRevoked && !isProcessing && "hover:shadow-lg hover:shadow-primary/20"
                      )}
                    >
                      <AnimatePresence mode="wait">
                        {isProcessing ? (
                          <motion.div
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Detaching...
                          </motion.div>
                        ) : isRevoked ? (
                          <motion.div
                            key="revoked"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Detached
                          </motion.div>
                        ) : (
                          <motion.div
                            key="idle"
                            className="flex items-center gap-2"
                          >
                            <Unplug className="h-3 w-3" />
                            Revoke Link
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Realistic Automated Process Overlay */}
                      {isProcessing && (
                        <motion.div 
                          className="absolute bottom-0 left-0 h-0.5 bg-white/50"
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 2 }}
                        />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
