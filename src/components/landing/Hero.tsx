import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function Hero() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero-abstract-art');

  return (
    <section className="relative w-full overflow-hidden py-20 md:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="opacity-0 mb-4 inline-block animate-fade-in-down rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary [animation-delay:0.4s]">
            Enterprise-Grade AI Security
          </div>
          <h1 className="opacity-0 animate-fade-in-down font-headline text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
            Secure Your Solana Assets with AI
          </h1>
          <p className="opacity-0 mt-6 animate-fade-in-down text-lg leading-8 text-muted-foreground [animation-delay:0.2s] sm:text-xl">
            Solana Shield AI is your proactive defense against threats.
            Rigorously scan your wallet, detect malicious interactions, and
            revoke risky permissions with confidence.
          </p>
          <div className="opacity-0 mt-10 flex animate-fade-in-down items-center justify-center gap-x-6 [animation-delay:0.4s]">
            <Button asChild size="lg" className="font-headline text-lg shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5">
              <Link href="/dashboard">Launch App & Scan Wallet</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="font-headline text-lg group">
              <Link href="/docs">Learn More <span className="transition-transform group-hover:translate-x-1">&rarr;</span></Link>
            </Button>
          </div>
        </div>
        {heroImage && (
          <div className="opacity-0 group relative mt-16 animate-fade-in-up [animation-delay:0.6s] sm:mt-24">
            <div className="absolute -inset-2.5 rounded-3xl bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
            <div className="relative h-80 w-full sm:h-96">
                <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                data-ai-hint={heroImage.imageHint}
                fill
                className="rounded-2xl object-cover shadow-2xl shadow-primary/10"
                priority
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-foreground/10" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}
      </div>
    </section>
  );
}
