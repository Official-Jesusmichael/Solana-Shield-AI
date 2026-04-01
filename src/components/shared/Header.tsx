'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { motion } from 'framer-motion';

/**
 * @fileOverview A refined, floating neumorphic header dock with optimized scaling.
 */

export function Header() {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-4 inset-x-0 z-50 flex justify-center px-4"
    >
      <div className="clay-header flex h-12 w-full max-w-5xl items-center justify-between rounded-xl px-4 lg:px-6 glow-border">
        <div className="flex items-center scale-90 origin-left">
          <Logo />
        </div>
        
        <nav className="hidden items-center gap-6 text-[10px] md:flex">
          <Link
            href="/#features"
            className="font-headline font-bold text-muted-foreground/80 transition-all hover:text-primary hover:scale-105"
          >
            Features
          </Link>
          <Link
            href="/docs"
            className="font-headline font-bold text-muted-foreground/80 transition-all hover:text-primary hover:scale-105"
          >
            Intelligence
          </Link>
          <Link
            href="/#faq"
            className="font-headline font-bold text-muted-foreground/80 transition-all hover:text-primary hover:scale-105"
          >
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button asChild size="sm" className="clay-btn bg-primary text-primary-foreground hover:bg-primary/90 px-4 primary-glow text-[10px] font-black h-8">
              <Link href="/scan">Launch App</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
