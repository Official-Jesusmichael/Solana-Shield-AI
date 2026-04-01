'use client';

import Link from 'next/link';
import { Logo } from './Logo';

/**
 * @fileOverview A professional footer with refined sizing for better document integration.
 */

export function Footer() {
  return (
    <footer className="container mx-auto max-w-6xl px-4 pb-10 pt-6">
      <div className="clay-header flex flex-col md:flex-row h-auto md:h-16 w-full items-center justify-between rounded-2xl px-6 py-4 md:py-0 glow-border">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <Logo />
          <div className="hidden h-4 w-px bg-white/10 sm:block mx-2" />
          <span className="text-[10px] font-medium text-muted-foreground/60 tracking-tight">
            © {new Date().getFullYear()} Solana Shield AI™
          </span>
        </div>

        <nav className="mt-4 md:mt-0 flex items-center gap-6 text-xs font-bold font-headline">
          <Link
            href="/terms"
            className="text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
