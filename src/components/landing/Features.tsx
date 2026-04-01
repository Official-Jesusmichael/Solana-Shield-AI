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
    <section id="features" className="relative w-full overflow-hidden py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mb-3 inline-block rounded-full bg-accent/10 px-4 py-1 font-headline text-[10px] font-black text-accent ring-1 ring-accent/30 shadow-[0_0_10px_rgba(20,241,149,0.2)]"
          >
            The Shield Arsenal
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-headline text-3xl font-black tracking-tight text-foreground sm:text-4xl md:text-5xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
          >
            Tactile Security Control
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-base text-muted-foreground/80 max-w-xl mx-auto font-medium"
          >
            Our suite of tools combines heavy-duty security with a fluid, 
            intelligent interface for total procedural dominance.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="group relative h-full clay-card p-6 md:p-8 interactive-glow cursor-pointer"
            >
              <div className="absolute -inset-1.5 rounded-[inherit] bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-lg" />
              
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-primary-foreground group-hover:primary-glow">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-headline text-xl font-black text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground group-hover:text-foreground/90 transition-colors">
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
