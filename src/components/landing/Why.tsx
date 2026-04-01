import { BrainCircuit, Gauge, ShieldOff, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Feature } from '@/lib/types';

const whyFeatures: Feature[] = [
  {
    icon: BrainCircuit,
    title: 'Behavioral AI Engine',
    description:
      "We go beyond simple blocklists. Our AI analyzes patterns to detect novel threats that others miss.",
    subtitle: "Predictive Intelligence",
  },
  {
    icon: Zap,
    title: 'Real-Time Analysis',
    description:
      'Get instant feedback and alerts on suspicious activity as it happens on the blockchain.',
    subtitle: "Instant Awareness",
  },
  {
    icon: Gauge,
    title: 'Risk Scoring',
    description:
      "We provide a holistic security score by assessing multiple on-chain vectors.",
    subtitle: "Holistic Health",
  },
  {
    icon: ShieldOff,
    title: 'Remediation',
    description:
      "Our simplified Revocation Manager empowers you to immediately cut ties with malicious dApps.",
    subtitle: "Immediate Action",
  },
];

export function Why() {
  return (
    <section id="why" className="relative w-full overflow-hidden py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 font-headline text-[10px] font-medium text-primary">
            The Shield Difference
          </div>
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Why Solana Shield AI?
          </h2>
          <p className="mt-3 text-base text-muted-foreground/80">
            In a world of evolving threats, you need an intelligent guardian.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {whyFeatures.map((feature, i) => (
            <div
              key={i}
              className={cn(
                'group relative transform-gpu overflow-hidden rounded-2xl border bg-card/40 p-6 shadow-sm transition-all duration-500 will-change-transform',
                'hover:scale-[1.01] hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5'
              )}
            >
              <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10" />
              <div className="absolute -inset-[1px] -z-10 rounded-[calc(1rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
              
              <div className="relative">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-headline text-lg font-bold text-foreground">
                        {feature.title}
                    </h3>
                    {feature.subtitle && (
                        <p className="text-[10px] font-medium text-primary uppercase tracking-wider">{feature.subtitle}</p>
                    )}
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
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
