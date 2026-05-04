import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import WalletProvider from "@/components/WalletProvider";
import "@solana/wallet-adapter-react-ui/styles.css";
import { InteractiveGradient } from '@/components/shared/InteractiveGradient';
import { SnowAnimation } from '@/components/shared/SnowAnimation';
import { TurnstileGuard } from '@/components/shared/TurnstileGuard';
import { TelemetryManager } from '@/components/shared/TelemetryManager';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Solana Shield AI',
  description:
    'Solana Shield AI is an elite, hyper-realistic security terminal that synthesizes real-time blockchain forensics with advanced neural intelligence to provide preemptive threat detection and authoritative asset protection across the Solana ecosystem.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-body antialiased',
          'font-body'
        )}
      >
        <WalletProvider>
          <TurnstileGuard>
            <InteractiveGradient />
            <SnowAnimation />
            <Suspense fallback={null}>
              <TelemetryManager />
            </Suspense>
            {children}
            <Toaster />
          </TurnstileGuard>
        </WalletProvider>
      </body>
    </html>
  );
}
