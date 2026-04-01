'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  HeartPulse,
  Link,
  ShieldCheck,
} from 'lucide-react';
import type { ThreatsResult } from './Threats';
import type { ConnectionsResult } from './Connections';

interface OverviewProps {
  threatsResult: ThreatsResult | null;
  connectionsResult: ConnectionsResult | null;
}

export function Overview({ threatsResult, connectionsResult }: OverviewProps) {
  const threatCount = threatsResult?.threats?.length ?? 0;
  const criticalThreats =
    threatsResult?.threats?.filter(
      (t) => t.severity === 'critical' || t.severity === 'high'
    ).length ?? 0;

  const riskyConnections =
    connectionsResult?.analysisResults?.filter((c) => c.isMalicious).length ?? 0;

  const securityScore = Math.max(
    0,
    100 - criticalThreats * 20 - (threatCount - criticalThreats) * 5 - riskyConnections * 15
  );

  return (
    <div>
      <h2 className="mb-4 font-headline text-lg font-bold">
        Wallet Overview
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Security Score
            </CardTitle>
            <HeartPulse className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-black font-headline ${
                securityScore > 80
                  ? 'text-accent'
                  : securityScore > 50
                  ? 'text-yellow-400'
                  : 'text-destructive'
              }`}
            >
              {securityScore}/100
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Overall health rating
            </p>
          </CardContent>
        </Card>
        
        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Threats
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-headline text-foreground">{threatCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {criticalThreats} critical findings
            </p>
          </CardContent>
        </Card>

        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              dApp Links
            </CardTitle>
            <Link className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-headline text-foreground">{riskyConnections}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Risky permissions active
            </p>
          </CardContent>
        </Card>

        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-headline text-primary">Protected</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Real-time AI monitoring
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
