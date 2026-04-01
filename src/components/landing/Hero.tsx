'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export function Hero() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-abstract-art');

  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px] -z-10" />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 font-headline text-sm font-medium text-primary ring-1 ring-primary/20 backdrop-blur-md shadow-[0_0_15px_rgba(153,69,255,0.2)]"
          >
            <ShieldCheck className="h-4 w-4" />
            Enterprise-Grade AI Security
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-headline text-6xl font-extrabold tracking-tight text-foreground sm:text-7xl md:text-8xl bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60"
          >
            Secure Your Solana <br className="hidden md:block" /> Assets with AI
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 text-lg leading-relaxed text-muted-foreground sm:text-xl max-w-3xl mx-auto"
          >
            Solana Shield AI is your proactive defense against on-chain threats.
            Rigorously scan your wallet, detect malicious interactions, and
            revoke risky permissions with surgical precision.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Button asChild size="lg" className="h-14 px-10 font-headline text-lg rounded-2xl bg-primary shadow-[0_10px_25px_-5px_rgba(153,69,255,0.5)] transition-all hover:scale-105 active:scale-95 group">
              <Link href="/scan">
                Scan Wallet
                <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-14 px-10 font-headline text-lg rounded-2xl border border-white/5 hover:bg-white/5 backdrop-blur-sm">
              <Link href="/docs">Learn More</Link>
            </Button>
          </motion.div>
        </div>

        {heroImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="relative mt-20 group mx-auto max-w-5xl"
          >
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-b from-primary/30 to-transparent opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
            <div className="relative h-[300px] sm:h-[500px] w-full rounded-[2.5rem] overflow-hidden neumorphic-card glow-border">
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                fill
                className="object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
            </div>
            {/* Floating UI Elements (Decorative) */}
            <div className="absolute -top-8 -left-8 h-32 w-32 bg-accent/20 rounded-3xl blur-2xl animate-pulse" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 bg-primary/20 rounded-3xl blur-2xl animate-pulse" />
          </motion.div>
        )}
      </div>
    </section>
  );
}