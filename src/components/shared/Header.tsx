import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-auto md:mr-4">
          <Logo />
        </div>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          <Link
            href="/#features"
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="/docs"
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Documentation
          </Link>
          <Link
            href="/#faq"
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            FAQ
          </Link>
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button asChild className="font-headline shadow-sm shadow-primary/20">
            <Link href="/dashboard">Launch App</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
