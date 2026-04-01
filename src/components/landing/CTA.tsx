'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck } from 'lucide-react';

export function CTA() {
  return (
    <section className="relative w-full overflow-hidden py-32">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[160px] -z-10" />

      <div className="container relative mx-auto max-w-5xl px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="neumorphic-card glow-border p-16 md:p-24 text-center overflow-hidden relative"
        >
          {/* Subtle Patterns */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-accent/10 text-accent mb-10 shadow-inner">
              <ShieldCheck className="h-10 w-10" />
            </div>
            <h2 className="font-headline text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Ready to Secure <br /> Your Assets?
            </h2>
            <p className="mt-8 text-xl leading-relaxed text-muted-foreground max-w-2xl mx-auto">
              Don't wait for a threat to become a reality. Join thousands of users 
              who trust Solana Shield AI for their daily security audits.
            </p>
            <div className="mt-12 flex items-center justify-center">
              <Button asChild size="lg" className="h-16 px-12 font-headline text-xl rounded-2xl bg-primary shadow-[0_15px_30px_-5px_rgba(153,69,255,0.4)] transition-all hover:scale-105 active:scale-95 primary-glow">
                <Link href="/scan">
                  <Rocket className="mr-3 h-6 w-6" />
                  Launch Free Scan
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}