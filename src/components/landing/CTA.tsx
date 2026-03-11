import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export function CTA() {
  return (
    <section className="relative w-full overflow-hidden bg-background py-20 md:py-32">
      <div className="container relative mx-auto max-w-4xl px-4">
        <div
          aria-hidden="true"
          className="absolute -inset-x-10 -inset-y-20 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 50% 50% at 15% 25%, hsl(var(--primary)/0.25), transparent 70%), radial-gradient(ellipse 50% 50% at 85% 75%, hsl(var(--accent)/0.2), transparent 70%)',
          }}
        />
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ready to Secure Your Assets?
          </h2>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Don't wait for a threat to become a reality. Launch Solana Shield AI
            and perform your first comprehensive security scan in seconds.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button asChild size="lg" className="font-headline text-lg shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5">
              <Link href="/dashboard">
                <Rocket className="mr-2 h-5 w-5" />
                Launch Free Scan
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
