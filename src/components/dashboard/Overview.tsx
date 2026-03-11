'use client';

import {
  Card,
  CardContent,
  CardDescription,
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
      <h2 className="mb-4 font-headline text-2xl font-bold">
        Wallet Overview
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Security Score
            </CardTitle>
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                securityScore > 80
                  ? 'text-green-500'
                  : securityScore > 50
                  ? 'text-yellow-500'
                  : 'text-red-500'
              }`}
            >
              {securityScore}/100
            </div>
            <p className="text-xs text-muted-foreground">
              Overall wallet health rating
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Detected Threats
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{threatCount}</div>
            <p className="text-xs text-muted-foreground">
              {criticalThreats} critical/high severity
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Risky Connections
            </CardTitle>
            <Link className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskyConnections}</div>
            <p className="text-xs text-muted-foreground">
              Malicious dApps connected
            </p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Status</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Protected</div>
            <p className="text-xs text-muted-foreground">
              Actively monitored by AI
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
