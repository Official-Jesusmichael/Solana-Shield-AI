import { Wallet, FileScan, ShieldAlert, Unplug } from 'lucide-react';
import type { Feature } from '@/lib/types';
import { cn } from '@/lib/utils';

const steps: (Feature & { step: number })[] = [
  {
    step: 1,
    icon: Wallet,
    title: 'Connect Your Wallet',
    description:
      'Securely connect your Solana wallet in one click. We only request read-only access, ensuring your assets are always safe and under your control.',
  },
  {
    step: 2,
    icon: FileScan,
    title: 'AI-Powered Scan',
    description:
      'Our AI engine performs a deep analysis of your transaction history, token approvals, and active dApp connections, cross-referencing against our real-time threat database.',
  },
  {
    step: 3,
    icon: ShieldAlert,
    title: 'Review Your Report',
    description:
      'Receive a comprehensive security report with a clear risk score, detailed threat explanations, and actionable recommendations categorized by severity.',
  },
  {
    step: 4,
    icon: Unplug,
    title: 'Revoke & Secure',
    description:
      'Use our intuitive Revocation Manager to immediately sever ties with any identified malicious dApps or contracts, securing your wallet from potential exploits.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative w-full overflow-hidden py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            Streamlined Security
          </div>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A simple, four-step process to secure your digital assets on Solana.
          </p>
        </div>
        <div className="relative mt-16">
          <div className="absolute left-1/2 top-0 -ml-[1.5px] h-full w-[3px] bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" aria-hidden="true" />
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:gap-16">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'group relative flex items-start gap-6',
                  i % 2 !== 0 && 'md:flex-row-reverse md:text-right'
                )}
              >
                <div className={cn(
                  'relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-card shadow-lg ring-4 ring-background',
                  'group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300'
                )}>
                  <step.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 pt-2">
                   <p className="mb-1 font-headline text-lg font-bold text-primary">Step {step.step}</p>
                   <h3 className="font-headline text-2xl font-semibold text-foreground">
                     {step.title}
                   </h3>
                   <p className="mt-2 text-muted-foreground">
                     {step.description}
                   </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
