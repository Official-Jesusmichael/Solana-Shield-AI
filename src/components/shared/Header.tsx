'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { motion } from 'framer-motion';

/**
 * @fileOverview A floating, neumorphic header dock.
 * Uses robust centering and interactive claymorphic styling.
 */

export function Header() {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-6 inset-x-0 z-50 flex justify-center px-4"
    >
      <div className="clay-header flex h-16 w-full max-w-7xl items-center justify-between rounded-3xl px-6 lg:px-10 glow-border">
        <div className="flex items-center">
          <Logo />
        </div>
        
        <nav className="hidden items-center gap-10 text-sm md:flex">
          <Link
            href="/#features"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-110"
          >
            Features
          </Link>
          <Link
            href="/docs"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-110"
          >
            Documentation
          </Link>
          <Link
            href="/#faq"
            className="font-headline font-bold text-muted-foreground transition-all hover:text-primary hover:scale-110"
          >
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button asChild className="clay-btn bg-primary text-primary-foreground hover:bg-primary/90 px-8 primary-glow">
              <Link href="/scan">Launch App</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
