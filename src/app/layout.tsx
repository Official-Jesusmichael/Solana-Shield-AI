import type { Metadata } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
// CORRECTED: Import the DEFAULT export and name it correctly.
import WalletContextProvider from "@/components/WalletProvider";
import { InteractiveGradient } from '@/components/shared/InteractiveGradient';

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
        {/* CORRECTED: Use the correctly imported component name. */}
        <WalletContextProvider>
          <InteractiveGradient />
          {children}
          <Toaster />
        </WalletContextProvider>
      </body>
    </html>
  );
}
