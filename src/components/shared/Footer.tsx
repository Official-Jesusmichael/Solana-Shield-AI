'use client';

import Link from 'next/link';
import { Logo } from './Logo';

/**
 * @fileOverview A professional footer integrated into the page flow.
 * Maintains the claymorphic aesthetic while sitting at the end of the content.
 */

export function Footer() {
  return (
    <footer className="container mx-auto max-w-7xl px-4 pb-12 pt-8">
      <div className="clay-header flex flex-col md:flex-row h-auto md:h-20 w-full items-center justify-between rounded-3xl px-8 py-6 md:py-0 glow-border">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <Logo />
          <div className="hidden h-6 w-px bg-white/10 sm:block mx-2" />
          <span className="text-xs font-medium text-muted-foreground/60 tracking-tight">
            © {new Date().getFullYear()} Solana Shield AI™
          </span>
        </div>

        <nav className="mt-6 md:mt-0 flex items-center gap-8 text-sm font-bold font-headline">
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
    </footer>
  );
}
