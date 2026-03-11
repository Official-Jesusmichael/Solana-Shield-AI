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
import { AlertCircle, CheckCircle2, Shield, Unplug } from 'lucide-react';
import type { AnalyzeMaliciousDappConnectionsOutput } from '@/ai/flows/analyze-malicious-dapp-connections-flow';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export type ConnectionsResult = AnalyzeMaliciousDappConnectionsOutput;

interface ConnectionsProps {
  result: ConnectionsResult | null;
  isLoading: boolean;
}

const riskConfig = {
  none: {
    icon: CheckCircle2,
    textColor: 'text-green-500',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    text: 'None',
  },
  low: {
    icon: Shield,
    textColor: 'text-blue-500',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    text: 'Low',
  },
  medium: {
    icon: Shield,
    textColor: 'text-yellow-500',
    badgeColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    text: 'Medium',
  },
  high: {
    icon: AlertCircle,
    textColor: 'text-orange-500',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
    text: 'High',
  },
  critical: {
    icon: AlertCircle,
    textColor: 'text-red-500',
    badgeColor: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    text: 'Critical',
  },
};

export function Connections({ result, isLoading }: ConnectionsProps) {
  const [revoked, setRevoked] = useState<string[]>([]);
  const { toast } = useToast();

  const handleRevoke = (dappAddress: string) => {
    setRevoked((prev) => [...prev, dappAddress]);
    toast({
      title: '✅ Permission Revoked',
      description: `Successfully simulated revoking permissions for ${dappAddress.substring(
        0,
        10
      )}...`,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>dApp</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-24" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result || result.analysisResults.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
        <CardTitle className="font-headline text-2xl">
          No Connections Found
        </CardTitle>
        <CardDescription className="mt-2">
          There are no active dApp connections to analyze.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">
          dApp Connection Analysis
        </CardTitle>
        <CardDescription>{result.overallSummary}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>dApp</TableHead>
                <TableHead className="hidden md:table-cell">
                  Risk Level
                </TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.analysisResults.map((conn) => {
                const config = riskConfig[conn.riskLevel];
                const isRevoked = revoked.includes(conn.dappAddress);
                return (
                  <TableRow key={conn.dappAddress}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <config.icon
                          className={cn('h-5 w-5 shrink-0', config.textColor)}
                        />
                        <div>
                          {conn.dappName || 'Unknown dApp'}
                          <div className="font-mono text-xs text-muted-foreground md:hidden">
                            <Badge variant="outline" className={cn('mt-1 border-none', config.badgeColor)}>{config.text} Risk</Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn('border-none', config.badgeColor)}>
                        {config.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {conn.identifiedVulnerabilities[0] || 'No specific issues'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={
                          conn.riskLevel === 'critical' || conn.riskLevel === 'high'
                            ? 'destructive'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => handleRevoke(conn.dappAddress)}
                        disabled={isRevoked}
                        className="font-headline"
                      >
                        <Unplug className="mr-1.5 h-4 w-4" />
                        {isRevoked ? 'Revoked' : 'Revoke'}
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
