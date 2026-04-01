'use client';

import Link from 'next/link';
import { Logo } from './Logo';

/**
 * @fileOverview A professional footer with refined sizing for better document integration.
 */

export function Footer() {
  return (
    <footer className="container mx-auto max-w-5xl px-4 pb-8 pt-4">
      <div className="clay-header flex flex-col md:flex-row h-auto md:h-12 w-full items-center justify-between rounded-xl px-5 py-3 md:py-0 glow-border">
        <div className="flex flex-col md:flex-row items-center gap-2">
          <div className="scale-75 origin-left">
            <Logo />
          </div>
          <div className="hidden h-3 w-px bg-white/10 sm:block mx-1" />
          <span className="text-[8px] font-medium text-muted-foreground/50 tracking-tight">
            © {new Date().getFullYear()} Solana Shield AI™
          </span>
        </div>

        <nav className="mt-3 md:mt-0 flex items-center gap-4 text-[9px] font-bold font-headline">
          <Link
            href="/terms"
            className="text-muted-foreground/70 transition-all hover:text-primary"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-muted-foreground/70 transition-all hover:text-primary"
          >
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
