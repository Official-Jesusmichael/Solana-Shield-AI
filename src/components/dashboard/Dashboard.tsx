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
  SearchCode,
  Network,
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
  { text: 'Auditing smart contract interactions...', icon: SearchCode },
  { text: 'Analyzing wallet interaction patterns...', icon: ShieldQuestion },
  { text: 'Cross-referencing known threat databases...', icon: Network },
  { text: 'Finalizing comprehensive threat report...', icon: ShieldCheck },
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

  return (
    <div className="flex h-full min-h-[calc(100vh-10rem)] w-full items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto flex h-48 w-48 items-center justify-center"
          style={{ perspective: '1000px' }}
        >
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse"></div>
          <div className="absolute inset-4 rounded-full bg-primary/20 animate-pulse [animation-delay:200ms]"></div>

          <motion.div
            className="absolute h-full w-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: currentStep * -60 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            {scanningSteps.map((step, index) => {
              const angle = index * 60;
              return (
                <motion.div
                  key={index}
                  className="absolute flex h-full w-full items-center justify-center"
                  style={{
                    transform: `rotateY(${angle}deg) translateZ(150px)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-card/80 backdrop-blur-sm">
                    <step.icon className="h-12 w-12 text-primary" />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        <h1 className="mt-12 font-headline text-3xl font-bold text-foreground">
          Scanning in Progress...
        </h1>
        <div className="mt-4 text-muted-foreground h-6">
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
        </div>
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
    // Animation is longer now
    setTimeout(() => {
      setIsConnected(true);
      setIsScanning(false);
      setIsLoading(false);
    }, 1000 * scanningSteps.length);
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
        <motion.div 
          className="w-full max-w-lg rounded-3xl bg-card/60 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 opacity-50 blur-lg"></div>
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-card">
              <ShieldCheck className="h-12 w-12 text-primary" />
            </div>
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
            className="mt-8 w-full font-headline text-lg shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5"
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
        </motion.div>
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
