'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { DetectSuspiciousWalletActivityOutput } from '@/ai/flows/detect-suspicious-wallet-activity';
import { AlertCircle, Shield, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

export type ThreatsResult = DetectSuspiciousWalletActivityOutput;

interface ThreatsProps {
  result: ThreatsResult | null;
  isLoading: boolean;
}

const severityConfig = {
  low: {
    icon: ShieldQuestion,
    color: 'bg-blue-500',
    borderColor: 'border-blue-400/20',
    textColor: 'text-blue-400',
    text: 'Low',
  },
  medium: {
    icon: Shield,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-400/20',
    textColor: 'text-yellow-400',
    text: 'Medium',
  },
  high: {
    icon: AlertCircle,
    color: 'bg-orange-500',
    borderColor: 'border-orange-400/20',
    textColor: 'text-orange-400',
    text: 'High',
  },
  critical: {
    icon: AlertCircle,
    color: 'bg-destructive',
    borderColor: 'border-destructive/20',
    textColor: 'text-destructive',
    text: 'Critical',
  },
  error: {
    icon: AlertCircle,
    color: 'bg-gray-500',
    borderColor: 'border-gray-500/20',
    textColor: 'text-gray-500',
    text: 'Error',
  }
};

export function Threats({ result, isLoading }: ThreatsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result || result.threats.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldCheck className="mb-4 h-16 w-16 text-green-500" />
        <CardTitle className="font-headline text-2xl">
          No Threats Found
        </CardTitle>
        <CardDescription className="mt-2">
          Our AI scan didn't find any suspicious activity on your wallet.
        </CardDescription>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Threat Analysis</CardTitle>
        <CardDescription>{result.summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.threats.map((threat, index) => {
          const config = severityConfig[threat.severity];
          const Icon = config.icon;
          return (
            <div
              key={index}
              className={cn("flex items-start gap-4 rounded-lg border p-4", config.borderColor)}
            >
              <Icon className={cn('mt-1 h-6 w-6 shrink-0', config.textColor)} />
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold capitalize">
                    {threat.type.replace(/_/g, ' ')}
                  </h3>
                  <Badge
                    className={cn(
                      'text-white',
                      config.color
                    )}
                  >
                    {config.text}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {threat.description}
                </p>
                {threat.details && (
                  <p className="mt-2 text-xs text-muted-foreground font-mono bg-muted p-2 rounded-md">
                    {threat.details}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
