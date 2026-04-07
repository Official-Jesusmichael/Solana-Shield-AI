import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import WalletProvider from "@/components/WalletProvider";
import "@solana/wallet-adapter-react-ui/styles.css";
import { InteractiveGradient } from '@/components/shared/InteractiveGradient';
import { SnowAnimation } from '@/components/shared/SnowAnimation';
import { TurnstileGuard } from '@/components/shared/TurnstileGuard';

export const metadata: Metadata = {
  title: 'Solana Shield AI',
  description:
    'Enterprise-grade AI security auditing for the Solana blockchain. Detect and revoke malicious connections to keep your wallet safe.',
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
            {children}
            <Toaster />
          </TurnstileGuard>
        </WalletProvider>
      </body>
    </html>
  );
}
