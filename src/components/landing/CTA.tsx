'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck } from 'lucide-react';

export function CTA() {
  return (
    <section className="relative w-full overflow-hidden py-40">
      {/* Immersive Background Auras */}
      <motion.div 
        animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[180px] -z-10" 
      />

      <div className="container relative mx-auto max-w-6xl px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="clay-card p-20 md:p-32 text-center overflow-hidden relative interactive-glow primary-glow"
        >
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '60px 60px' }} />

          <div className="relative z-10">
            <motion.div 
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="inline-flex h-24 w-24 items-center justify-center rounded-[3rem] bg-accent/20 text-accent mb-12 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4)] border border-accent/20"
            >
              <ShieldCheck className="h-12 w-12" />
            </motion.div>
            <h2 className="font-headline text-6xl font-black tracking-tight text-foreground sm:text-8xl leading-none bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Fortify Your <br className="hidden md:block" /> Digital Vault
            </h2>
            <p className="mt-10 text-2xl leading-relaxed text-muted-foreground/80 max-w-3xl mx-auto font-medium">
              Join the elite circle of users who trust our neural protocol for 
              uncompromising, daily security audits.
            </p>
            <div className="mt-16 flex items-center justify-center">
              <Button asChild size="lg" className="clay-btn h-20 px-16 text-2xl bg-primary text-primary-foreground primary-glow group">
                <Link href="/scan">
                  <Rocket className="mr-4 h-8 w-8 transition-transform group-hover:-translate-y-1" />
                  Launch Secure Scan
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}