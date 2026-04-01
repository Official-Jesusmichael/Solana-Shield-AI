'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { motion } from 'framer-motion';

/**
 * @fileOverview A floating, neumorphic footer dock.
 * Redesigned to mirror the high-end aesthetics of the header.
 */

export function Footer() {
  return (
    <motion.footer
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4"
    >
      <div className="clay-header flex h-16 w-full max-w-7xl items-center justify-between rounded-3xl px-6 lg:px-10 glow-border">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="hidden h-6 w-px bg-white/10 sm:block mx-2" />
          <span className="hidden text-xs font-medium text-muted-foreground/60 sm:block tracking-tight">
            © {new Date().getFullYear()} Solana Shield AI™
          </span>
        </div>

        <nav className="flex items-center gap-8 text-sm font-bold font-headline">
          <Link
            href="/terms"
            className="text-muted-foreground transition-all hover:text-primary hover:scale-110"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground transition-all hover:text-primary hover:scale-110"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </motion.footer>
  );
}
