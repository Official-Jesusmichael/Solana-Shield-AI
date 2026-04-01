'use client';

import { motion } from 'framer-motion';
import {
  Bell,
  LayoutDashboard,
  Link as LinkIcon,
  ShieldCheck,
  Unplug,
  Zap,
} from 'lucide-react';
import type { Feature } from '@/lib/types';

const features: Feature[] = [
  {
    icon: ShieldCheck,
    title: 'AI-Powered Detection',
    description:
      'Utilize proprietary models to scan for suspicious interactions, phishing attempts, and known malicious addresses.',
  },
  {
    icon: LinkIcon,
    title: 'Connection Audit',
    description:
      'Actively monitor dApp connections, flagging those with identified vulnerabilities or malicious behavior.',
  },
  {
    icon: Unplug,
    title: 'Revocation Manager',
    description:
      'A simplified interface to revoke malicious or high-risk dApp approvals and token allowances with one click.',
  },
  {
    icon: LayoutDashboard,
    title: 'Security Dashboard',
    description:
      'Visualize scan results, review threats, and monitor your overall wallet health from one central hub.',
  },
  {
    icon: Bell,
    title: 'Real-time Alerts',
    description:
      'Get instant notifications on newly detected threats or suspicious activities on your wallet.',
  },
  {
    icon: Zap,
    title: 'Smart Auditing',
    description: 'Our AI provides preliminary audits on smart contracts before you interact, highlighting potential risks.',
  }
];

export function Features() {
  return (
    <section id="features" className="relative w-full overflow-hidden py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-block rounded-full bg-accent/10 px-4 py-1.5 font-headline text-sm font-medium text-accent ring-1 ring-accent/20"
          >
            The Shield Arsenal
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Unparalleled Wallet Security
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Our enterprise-grade toolset gives you full control and surgical insight over
            your wallet's security posture.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative h-full neumorphic-card glow-border p-10 overflow-hidden"
            >
              {/* Animated Glow on Hover */}
              <div className="absolute -inset-px rounded-[inherit] bg-gradient-to-br from-primary/20 via-transparent to-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_20px_rgba(153,69,255,0.4)]">
                  <feature.icon className="h-8 w-8" />
                </div>
                <h3 className="mt-8 font-headline text-2xl font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground group-hover:text-foreground/80 transition-colors">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}