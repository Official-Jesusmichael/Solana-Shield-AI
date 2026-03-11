import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

export function Hero() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-abstract-art');

  return (
    <section className="relative w-full overflow-hidden bg-background py-20 md:py-32">
      <div className="absolute top-0 left-0 -z-10 h-full w-full bg-gradient-to-br from-primary/10 via-transparent to-transparent"></div>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            Enterprise-Grade AI Security
          </div>
          <h1 className="font-headline text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Secure Your Solana Assets with AI
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            Solana Shield AI is your proactive defense against threats.
            Rigorously scan your wallet, detect malicious interactions, and
            revoke risky permissions with confidence.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg" className="font-headline text-lg shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5">
              <Link href="/dashboard">Launch App & Scan Wallet</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="font-headline text-lg group">
              <Link href="#features">Learn More <span className="transition-transform group-hover:translate-x-1">&rarr;</span></Link>
            </Button>
          </div>
        </div>
        {heroImage && (
          <div className="relative mt-16 h-80 w-full sm:h-96 lg:mt-24">
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent"></div>
             <Image
              src={heroImage.imageUrl}
              alt={heroImage.description}
              data-ai-hint={heroImage.imageHint}
              fill
              className="rounded-2xl object-cover shadow-2xl shadow-primary/10"
              priority
            />
          </div>
        )}
      </div>
    </section>
  );
}
