import {
  Bell,
  LayoutDashboard,
  Link,
  ShieldCheck,
  Unplug,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Feature } from '@/lib/types';
import { cn } from '@/lib/utils';

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: 'AI-Powered Threat Detection',
    description:
      'Utilize our AI to scan for suspicious interactions, phishing attempts, and known malicious addresses.',
    iconColor: 'text-blue-500',
  },
  {
    icon: Link,
    title: 'Malicious Connection Audit',
    description:
      'Actively monitor dApp connections, flagging those with identified vulnerabilities or malicious behavior.',
    iconColor: 'text-purple-500',
  },
  {
    icon: Unplug,
    title: 'Revocation Manager',
    description:
      'A simplified interface to revoke malicious or high-risk dApp approvals and token allowances.',
    iconColor: 'text-pink-500',
  },
  {
    icon: LayoutDashboard,
    title: 'Interactive Security Dashboard',
    description:
      'Visualize scan results, review threats, and monitor your overall wallet health from one central hub.',
    iconColor: 'text-sky-500',
  },
  {
    icon: Bell,
    title: 'Real-time Threat Alerts',
    description:
      'Get instant notifications on newly detected threats or suspicious activities on your wallet.',
    iconColor: 'text-teal-500',
  },
  {
    icon: ShieldCheck, // Re-using for 6th item
    title: 'Smart Contract Auditing',
    description: 'Our AI provides preliminary audits on smart contracts before you interact with them, highlighting potential risks.',
    iconColor: 'text-amber-500'
  }
];

export function Features() {
  return (
    <section
      id="features"
      className="w-full bg-background py-20 md:py-32"
    >
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
            <Card
              key={i}
              className="group transform-gpu border-transparent bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:-translate-y-1"
            >
              <CardHeader className="flex flex-row items-start gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10`}
                >
                  <feature.icon className={cn("h-6 w-6 text-primary", feature.iconColor)} />
                </div>
                <CardTitle className="font-headline text-xl pt-1">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent className='pt-0'>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
