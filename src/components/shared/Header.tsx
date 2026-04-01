'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';
import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-3rem)] max-w-7xl px-4"
    >
      <div className="clay-header flex h-16 items-center rounded-3xl px-6 lg:px-10">
        <div className="mr-auto">
          <Logo />
        </div>
        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link
            href="/#features"
            className="font-headline font-medium text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Features
          </Link>
          <Link
            href="/docs"
            className="font-headline font-medium text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            Documentation
          </Link>
          <Link
            href="/#faq"
            className="font-headline font-medium text-muted-foreground transition-all hover:text-primary hover:scale-105"
          >
            FAQ
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button asChild className="clay-btn bg-primary text-primary-foreground hover:bg-primary/90 px-6">
            <Link href="/scan">Launch App</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
