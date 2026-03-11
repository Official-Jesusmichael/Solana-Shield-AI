import { ShieldHalf } from 'lucide-react';
import Link from 'next/link';

export function Logo() {
  return (
    <Link href="/" className="flex items-center space-x-2">
      <ShieldHalf className="h-8 w-8 text-primary" />
      <span className="font-headline text-xl font-bold text-foreground">
        Solana Shield AI
      </span>
    </Link>
  );
}
