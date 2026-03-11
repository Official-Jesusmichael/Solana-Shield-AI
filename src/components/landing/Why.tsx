import { BrainCircuit, Gauge, ShieldOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Feature } from '@/lib/types';

const whyFeatures: Feature[] = [
  {
    icon: BrainCircuit,
    title: 'Behavioral AI Engine',
    description:
      "We go beyond simple blocklists. Our AI analyzes transaction patterns and smart contract behaviors to detect novel and zero-day threats that others miss.",
    subtitle: "Predictive, Not Just Reactive",
  },
  {
    icon: Zap,
    title: 'Real-Time Analysis',
    description:
      'Our system ingests and processes on-chain data in real-time. Get instant feedback and alerts on suspicious activity as it happens, not after the fact.',
    subtitle: "Instantaneous Threat Intelligence",
  },
  {
    icon: Gauge,
    title: 'Comprehensive Risk Scoring',
    description:
      "We provide a holistic security score by assessing multiple vectors, including transaction history, token allowances, and dApp permissions, giving you a true measure of your risk exposure.",
    subtitle: "A 360-Degree View",
  },
  {
    icon: ShieldOff,
    title: 'Actionable Remediation',
    description:
      "We don't just identify problems; we help you solve them. Our simplified Revocation Manager empowers you to immediately cut ties with malicious dApps and protect your assets.",
    subtitle: "Empowering User Action",
  },
];

export function Why() {
  return (
    <section id="why" className="relative w-full overflow-hidden py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            The Shield Difference
          </div>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Why Solana Shield AI?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            In a world of evolving threats, you need more than a simple scanner. You need an intelligent guardian.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2">
          {whyFeatures.map((feature, i) => (
            <div
              key={i}
              className={cn(
                'group relative transform-gpu overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-sm transition-all duration-500 will-change-transform',
                'hover:scale-[1.02] hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10'
              )}
            >
              <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10" />
              <div className="absolute -inset-[1px] -z-10 rounded-[calc(1.5rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
              
              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-headline text-xl font-bold text-foreground">
                        {feature.title}
                    </h3>
                    {feature.subtitle && (
                        <p className="text-sm font-medium text-primary">{feature.subtitle}</p>
                    )}
                  </div>
                </div>
                <p className="mt-6 text-base leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
