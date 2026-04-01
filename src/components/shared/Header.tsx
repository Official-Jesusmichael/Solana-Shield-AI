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
      className="fixed top-6 inset-x-0 z-50 flex justify-center px-4"
    >
      <div className="clay-header flex h-14 w-full max-w-6xl items-center justify-between rounded-2xl px-5 lg:px-8 glow-border">
        <div className="flex items-center">
          <Logo />
        </div>
        
        <nav className="hidden items-center gap-8 text-xs md:flex">
          <Link
            href="/#features"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Features
          </Link>
          <Link
            href="/docs"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Documentation
          </Link>
          <Link
            href="/#faq"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button asChild size="sm" className="clay-btn bg-primary text-primary-foreground hover:bg-primary/90 px-6 primary-glow text-xs font-black">
              <Link href="/scan">Launch App</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}