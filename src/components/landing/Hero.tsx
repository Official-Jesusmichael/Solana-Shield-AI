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
    <section className="relative w-full overflow-hidden pt-32 pb-16 md:pt-48 md:pb-24">
      {/* Dynamic Background Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15]
        }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10" 
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] -z-10" 
      />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="mb-6 inline-flex items-center gap-2.5 rounded-full bg-primary/10 px-5 py-2 font-headline text-xs font-bold text-primary ring-1 ring-primary/30 backdrop-blur-xl shadow-[0_0_20px_rgba(153,69,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.2)]"
          >
            <ShieldCheck className="h-4 w-4 animate-pulse" />
            Neural Shield Protocol v2.0
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-headline text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40 leading-[1.1]"
          >
            Ultimate Solana <br className="hidden md:block" /> Security Engine
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-8 text-lg leading-relaxed text-muted-foreground/80 sm:text-xl max-w-2xl mx-auto font-medium"
          >
            Protect your digital wealth with enterprise-grade AI. 
            Detect stealth threats, audit complex interactions, and 
            secure your wallet with surgical precision.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild size="lg" className="clay-btn h-12 px-10 bg-primary text-primary-foreground text-lg primary-glow group">
                <Link href="/scan">
                  Secure Wallet
                  <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild variant="ghost" size="lg" className="h-12 px-10 text-lg rounded-2xl border border-white/10 hover:bg-white/5 backdrop-blur-sm transition-all">
                <Link href="/docs">View Intelligence</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {heroImage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="relative mt-16 group mx-auto max-w-5xl perspective-1000"
          >
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-b from-primary/40 to-transparent opacity-0 blur-2xl transition-opacity duration-1000 group-hover:opacity-100" />
            <div className="relative h-[300px] sm:h-[500px] w-full clay-card overflow-hidden group glow-border">
              <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                fill
                className="object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-80" />
              
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-6 p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 animate-float">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent animate-ping" />
                  <span className="font-headline font-bold text-sm">AI Core Active</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}