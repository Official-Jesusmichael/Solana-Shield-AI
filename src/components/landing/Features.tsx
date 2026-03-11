import {
  Bell,
  LayoutDashboard,
  Link,
  ShieldCheck,
  Unplug,
} from 'lucide-react';

import type { Feature } from '@/lib/types';

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: 'AI-Powered Threat Detection',
    description:
      'Utilize our AI to scan for suspicious interactions, phishing attempts, and known malicious addresses.',
  },
  {
    icon: Link,
    title: 'Malicious Connection Audit',
    description:
      'Actively monitor dApp connections, flagging those with identified vulnerabilities or malicious behavior.',
  },
  {
    icon: Unplug,
    title: 'Revocation Manager',
    description:
      'A simplified interface to revoke malicious or high-risk dApp approvals and token allowances.',
  },
  {
    icon: LayoutDashboard,
    title: 'Interactive Security Dashboard',
    description:
      'Visualize scan results, review threats, and monitor your overall wallet health from one central hub.',
  },
  {
    icon: Bell,
    title: 'Real-time Threat Alerts',
    description:
      'Get instant notifications on newly detected threats or suspicious activities on your wallet.',
  },
  {
    icon: ShieldCheck, // Re-using for 6th item
    title: 'Smart Contract Auditing',
    description: 'Our AI provides preliminary audits on smart contracts before you interact with them, highlighting potential risks.',
  }
];

export function Features() {
  return (
    <section
      id="features"
      className="relative w-full overflow-hidden bg-background py-20 md:py-32"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 10% 90%, hsl(var(--primary)/0.08), transparent 35%), radial-gradient(circle at 90% 10%, hsl(var(--accent)/0.08), transparent 40%)',
        }}
      />
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            Our Arsenal
          </div>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Unparalleled Wallet Security
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our enterprise-grade toolset gives you full control and insight over
            your wallet's security.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
             <div
              key={i}
              className="group relative transform-gpu overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-sm transition-all duration-500 will-change-transform hover:scale-[1.02] hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10"
            >
              <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10" />
              <div className="absolute -inset-[1px] -z-10 rounded-[calc(1.5rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />

              <div className="relative">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="pt-2 font-headline text-xl font-bold text-foreground">
                    {feature.title}
                  </h3>
                </div>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
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
