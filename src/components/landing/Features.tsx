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
    title: 'AI Detection',
    description:
      'Utilize proprietary models to scan for stealth interactions and zero-day exploits.',
  },
  {
    icon: LinkIcon,
    title: 'Audit Engine',
    description:
      'Actively monitor dApp links, flagging those with hidden vulnerabilities.',
  },
  {
    icon: Unplug,
    title: 'Rapid Revoke',
    description:
      'A tactile interface to sever ties with high-risk dApp approvals instantly.',
  },
  {
    icon: LayoutDashboard,
    title: 'Security Hub',
    description:
      'Visualize scan results and monitor your overall wallet health from one dock.',
  },
  {
    icon: Bell,
    title: 'Neural Alerts',
    description:
      'Get instant push notifications on newly detected threats to your assets.',
  },
  {
    icon: Zap,
    title: 'Smart Pre-Audit',
    description: 'Our AI audits smart contracts before you sign, highlighting risks.',
  }
];

export function Features() {
  return (
    <section id="features" className="relative w-full overflow-hidden py-24 md:py-32">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-4 inline-block rounded-full bg-accent/10 px-5 py-1.5 font-headline text-xs font-black text-accent ring-1 ring-accent/30 shadow-[0_0_15px_rgba(20,241,149,0.2)]"
          >
            The Shield Arsenal
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-headline text-4xl font-black tracking-tight text-foreground sm:text-5xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
          >
            Tactile Security Control
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-lg text-muted-foreground/80 max-w-2xl mx-auto font-medium"
          >
            Our suite of tools combines heavy-duty security with a fluid, 
            intelligent interface for total procedural dominance.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="group relative h-full clay-card p-8 md:p-10 interactive-glow cursor-pointer"
            >
              <div className="absolute -inset-2 rounded-[inherit] bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl" />
              
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:primary-glow">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-8 font-headline text-2xl font-black text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground group-hover:text-foreground/90 transition-colors">
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