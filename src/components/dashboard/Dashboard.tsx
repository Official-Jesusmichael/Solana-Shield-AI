'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Overview } from './Overview';
import { Threats, type ThreatsResult } from './Threats';
import { Connections, type ConnectionsResult } from './Connections';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Loader2, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  runDappConnectionAnalysis,
  runWalletActivityScan,
} from '@/lib/actions';
import { MOCK_WALLET_ADDRESS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

export function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threatsResult, setThreatsResult] = useState<ThreatsResult | null>(
    null
  );
  const [connectionsResult, setConnectionsResult] =
    useState<ConnectionsResult | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsLoading(true);
    await handleScan();
    setIsConnected(true);
    setIsLoading(false);
  };

  const handleScan = async () => {
    toast({
      title: '🔍 Scanning Wallet...',
      description: 'Our AI is analyzing your wallet. This may take a moment.',
    });
    try {
      const [threats, connections] = await Promise.all([
        runWalletActivityScan(MOCK_WALLET_ADDRESS),
        runDappConnectionAnalysis(MOCK_WALLET_ADDRESS),
      ]);
      setThreatsResult(threats);
      setConnectionsResult(connections);

      const highRiskThreats =
        threats.threats.filter(
          (t) => t.severity === 'high' || t.severity === 'critical'
        ).length > 0;
      if (highRiskThreats) {
        toast({
          variant: 'destructive',
          title: '🚨 High-Risk Threats Detected!',
          description:
            'Review the threats tab immediately to take action.',
        });
      } else {
        toast({
          title: '✅ Scan Complete',
          description: "No high-risk threats found. Your wallet looks secure.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '️Scan Failed',
        description: 'An error occurred during the scan. Please try again.',
      });
      console.error(error);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex h-full min-h-[calc(100vh-10rem)] w-full items-center justify-center">
        <Card className="w-full max-w-md text-center shadow-clay-light">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">
              Connect Your Wallet
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-muted-foreground">
              Connect your Solana wallet to begin your comprehensive security
              scan.
            </p>
            <Button
              size="lg"
              className="w-full font-headline text-lg"
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-5 w-5" />
                  Connect Wallet
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Overview
        threatsResult={threatsResult}
        connectionsResult={connectionsResult}
      />
      <Tabs defaultValue="threats">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="connections">dApp Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="threats">
          <Threats result={threatsResult} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="connections">
          <Connections result={connectionsResult} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
