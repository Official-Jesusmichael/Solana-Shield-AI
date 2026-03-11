import {
  Bell,
  LayoutDashboard,
  Link,
  ShieldCheck,
  Unplug,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Feature } from '@/lib/types';

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: 'AI-Powered Threat Detection',
    description:
      'Utilize our AI to scan for suspicious interactions, phishing attempts, and known malicious addresses.',
    bgColor: 'bg-pink-100/50 dark:bg-pink-900/20',
  },
  {
    icon: Link,
    title: 'Malicious Connection Audit',
    description:
      'Actively monitor dApp connections, flagging those with identified vulnerabilities or malicious behavior.',
    bgColor: 'bg-purple-100/50 dark:bg-purple-900/20',
  },
  {
    icon: Unplug,
    title: 'Revocation Manager',
    description:
      'A simplified interface to revoke malicious or high-risk dApp approvals and token allowances.',
    bgColor: 'bg-indigo-100/50 dark:bg-indigo-900/20',
  },
  {
    icon: LayoutDashboard,
    title: 'Interactive Security Dashboard',
    description:
      'Visualize scan results, review threats, and monitor your overall wallet health from one central hub.',
    bgColor: 'bg-sky-100/50 dark:bg-sky-900/20',
  },
  {
    icon: Bell,
    title: 'Real-time Threat Alerts',
    description:
      'Get instant notifications on newly detected threats or suspicious activities on your wallet.',
    bgColor: 'bg-teal-100/50 dark:bg-teal-900/20',
  },
];

export function Features() {
  return (
    <section
      id="features"
      className="w-full bg-muted/50 py-20 md:py-32"
    >
      <div className="container mx-auto px-4">
        <div className="text-center">
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
              className="transform-gpu transition-transform duration-300 hover:-translate-y-2"
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.bgColor}`}
                >
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="font-headline text-xl">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
