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
  Link as LinkIcon,
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
      <h2 className="mb-3 font-headline text-sm font-bold uppercase tracking-widest text-muted-foreground/60">
        Wallet Overview
      </h2>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Score
            </CardTitle>
            <HeartPulse className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div
              className={`text-xl font-black font-headline ${
                securityScore > 80
                  ? 'text-accent'
                  : securityScore > 50
                  ? 'text-yellow-400'
                  : 'text-destructive'
              }`}
            >
              {securityScore}/100
            </div>
            <p className="text-[8px] text-muted-foreground mt-0.5">
              Overall health
            </p>
          </CardContent>
        </Card>
        
        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Threats
            </CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-headline text-foreground">{threatCount}</div>
            <p className="text-[8px] text-muted-foreground mt-0.5">
              {criticalThreats} critical
            </p>
          </CardContent>
        </Card>

        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Links
            </CardTitle>
            <LinkIcon className="h-3.5 w-3.5 text-accent" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-headline text-foreground">{riskyConnections}</div>
            <p className="text-[8px] text-muted-foreground mt-0.5">
              Risky dApps
            </p>
          </CardContent>
        </Card>

        <Card className="neumorphic-card border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
            <CardTitle className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </CardTitle>
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="text-xl font-black font-headline text-primary">Active</div>
            <p className="text-[8px] text-muted-foreground mt-0.5">
              Neural monitoring
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
