import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const testimonials = [
  {
    id: 'testimonial-1',
    name: 'Alex Rivera',
    title: 'Lead Solana Developer, DeFi Wizards',
    quote:
      "Solana Shield AI is a game-changer. It caught a critical vulnerability in a dApp connection that could have been disastrous. It's now a mandatory part of our pre-deployment security checklist.",
    avatarId: 'avatar-1',
  },
  {
    id: 'testimonial-2',
    name: 'Samantha Chen',
    title: 'Founder, NFTY-Verse',
    quote:
      "The peace of mind this tool provides is invaluable. The UI is incredibly intuitive, and the AI-powered analysis gives us confidence that our community's assets are protected from common threats.",
    avatarId: 'avatar-2',
  },
  {
    id: 'testimonial-3',
    name: 'David Lee',
    title: 'Independent Security Auditor',
    quote:
      "I'm impressed by the depth of analysis Solana Shield AI provides. It automates much of the initial reconnaissance work, allowing me to focus on more complex, smart contract-level auditing. A powerful tool for any dev.",
    avatarId: 'avatar-3',
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative w-full overflow-hidden bg-background py-20 md:py-32">
       <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 5% 15%, hsl(var(--primary)/0.08), transparent 30%), radial-gradient(circle at 95% 85%, hsl(var(--accent)/0.08), transparent 30%)',
        }}
      />
      <div className="container mx-auto px-4">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            Social Proof
          </div>
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Trusted by Builders & Auditors
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See what developers and security experts are saying about us.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => {
            const avatar = PlaceHolderImages.find(
              (img) => img.id === testimonial.avatarId
            );
            return (
              <div
                key={testimonial.id}
                className={cn(
                  'group relative transform-gpu overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-sm transition-all duration-500 will-change-transform',
                  'hover:scale-[1.02] hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10'
                )}
              >
                <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10" />
                <div className="absolute -inset-[1px] -z-10 rounded-[calc(1.5rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true" />
                
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center gap-4">
                    {avatar && (
                      <Image
                        src={avatar.imageUrl}
                        alt={avatar.description}
                        data-ai-hint={avatar.imageHint}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-headline font-bold text-foreground">
                        {testimonial.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {testimonial.title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <blockquote className="mt-6 flex-1 text-base leading-relaxed text-muted-foreground before:content-['“'] after:content-['”']">
                    {testimonial.quote}
                  </blockquote>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
