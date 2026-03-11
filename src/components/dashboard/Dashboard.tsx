'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Overview } from './Overview';
import { Threats, type ThreatsResult } from './Threats';
import { Connections, type ConnectionsResult } from './Connections';
import {
  Loader2,
  Wallet,
  ShieldCheck,
  Server,
  FileScan,
  ShieldQuestion,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  runDappConnectionAnalysis,
  runWalletActivityScan,
} from '@/lib/actions';
import { MOCK_WALLET_ADDRESS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

const scanningSteps = [
  { text: 'Initializing security protocols...', icon: Server },
  { text: 'Compiling on-chain transaction data...', icon: FileScan },
  { text: 'Analyzing wallet interaction patterns...', icon: ShieldQuestion },
  { text: 'Auditing dApp permissions and connections...', icon: ShieldCheck },
  { text: 'Finalizing threat report...', icon: Loader2 },
];

function ScanningAnimation() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < scanningSteps.length - 1) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  const CurrentIcon = scanningSteps[currentStep].icon;

  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] w-full items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse"></div>
          <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse [animation-delay:200ms]"></div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.3 }}
            >
              <CurrentIcon className="h-12 w-12 text-primary" />
            </motion.div>
          </AnimatePresence>
        </div>
        <h1 className="mt-8 font-headline text-3xl font-bold text-foreground">
          Scanning in Progress...
        </h1>
        <p className="mt-4 text-muted-foreground h-6">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStep}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="block"
            >
              {scanningSteps[currentStep].text}
            </motion.span>
          </AnimatePresence>
        </p>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [threatsResult, setThreatsResult] = useState<ThreatsResult | null>(
    null
  );
  const [connectionsResult, setConnectionsResult] =
    useState<ConnectionsResult | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsLoading(true);
    setIsScanning(true);
    await handleScan();
    // Add a small delay for the animation to feel complete
    setTimeout(() => {
      setIsConnected(true);
      setIsScanning(false);
      setIsLoading(false);
    }, 1000);
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

  if (isScanning) {
    return <ScanningAnimation />;
  }

  if (!isConnected) {
    return (
      <div className="flex h-full min-h-[calc(100vh-10rem)] w-full items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-card p-8 text-center shadow-lg transition-all">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mt-6 font-headline text-3xl font-bold text-foreground">
            Secure Your Digital Assets
          </h1>
          <p className="mt-4 text-muted-foreground">
            Connect your Solana wallet to perform a comprehensive, AI-powered
            security audit. Identify threats, review risky permissions, and
            protect your funds.
          </p>
          <Button
            size="lg"
            className="mt-8 w-full font-headline text-lg"
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
                Connect & Scan Wallet
              </>
            )}
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            We only request read-only access. Your keys are always safe.
          </p>
        </div>
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
