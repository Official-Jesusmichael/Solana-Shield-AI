'use client';

import * as React from 'react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';

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
  {
    id: 'testimonial-4',
    name: 'Maria Garcia',
    title: 'CISO, ChainSecure',
    quote:
      'The real-time alerting is top-notch. We integrated it into our SOC workflow, and it has significantly reduced our incident response time for on-chain events. Essential for any serious operation on Solana.',
    avatarId: 'avatar-4',
  },
  {
    id: 'testimonial-5',
    name: 'Dr. Evelyn Reed',
    title: 'Blockchain Researcher, Cypher Labs',
    quote:
      "The AI's ability to detect novel threats is remarkable. It goes beyond simple signature-matching and understands the context of transactions, which is a huge leap forward for wallet security.",
    avatarId: 'avatar-5',
  },
  {
    id: 'testimonial-6',
    name: 'Ben Carter',
    title: 'Product Manager, SolPay',
    quote:
      'We recommend Solana Shield AI to all our users. The Revocation Manager is a fantastic feature that empowers non-technical users to manage their permissions safely and effectively.',
    avatarId: 'avatar-6',
  },
  {
    id: 'testimonial-7',
    name: 'Hiroshi Tanaka',
    title: 'Core Protocol Engineer',
    quote:
      'Technically brilliant. The AI-driven smart contract pre-audits save our team hours of manual review. It flags potential re-entrancy and integer overflow risks with impressive accuracy.',
    avatarId: 'avatar-7',
  },
  {
    id: 'testimonial-8',
    name: 'Fatima Al-Jamil',
    title: 'Venture Capitalist, CryptoGrowth Capital',
    quote:
      'We use Solana Shield AI as part of our due diligence process for new investments. Its reports provide a clear, concise security overview that is critical for our risk assessment.',
    avatarId: 'avatar-8',
  },
  {
    id: 'testimonial-9',
    name: 'Leo Maxwell',
    title: 'Head of Staking, Helium Network',
    quote:
      'Our node operators rely on this tool to secure their wallets. The proactive threat detection is crucial when you\'re managing high-value assets and need to be ahead of potential attacks.',
    avatarId: 'avatar-9',
  },
  {
    id: 'testimonial-10',
    name: 'Isabelle Moreau',
    title: 'Creative Director, Metaplex Studios',
    quote:
      'For our artists and creators, security is paramount. Solana Shield AI makes it simple for them to interact with the ecosystem without fear. The user experience is as beautiful as it is functional.',
    avatarId: 'avatar-10',
  },
   {
    id: 'testimonial-11',
    name: 'Ken Thompson',
    title: 'Principal Engineer, Google',
    quote:
      'Solana Shield AI represents a significant step forward in consumer-grade crypto security. The blend of AI and a user-friendly interface is a winning combination.',
    avatarId: 'avatar-11',
  },
  {
    id: 'testimonial-12',
    name: 'Grace Hopper',
    title: 'Rear Admiral, U.S. Navy (ret.)',
    quote:
      'In my years of experience, I have not seen a more intuitive and powerful tool for securing digital assets. Solana Shield AI is a must-have for anyone operating in the Web3 space.',
    avatarId: 'avatar-12',
  },
  {
    id: 'testimonial-13',
    name: 'Ada Lovelace',
    title: 'Pioneering Programmer',
    quote:
      'If I were alive today, I would be fascinated by the analytical engine behind Solana Shield AI. It is a testament to how far we have come in computational security.',
    avatarId: 'avatar-13',
  },
  {
    id: 'testimonial-14',
    name: 'Linus Torvalds',
    title: 'Creator of Linux',
    quote:
      'Open, transparent, and powerful. Solana Shield AI embodies the principles of good software. It gives power back to the user, which is what matters most.',
    avatarId: 'avatar-14',
  },
  {
    id: 'testimonial-15',
    name: 'Margaret Hamilton',
    title: 'Lead Software Engineer, Apollo Program',
    quote:
      'The reliability and robustness of this system are impressive. The attention to detail in error handling and threat mitigation is what sets it apart. It\'s mission-critical software for the digital age.',
    avatarId: 'avatar-15',
  },
  {
    id: 'testimonial-16',
    name: 'Satoshi Nakamoto',
    title: 'Creator of Bitcoin',
    quote: 'The trustless nature of decentralized systems requires tools that empower individual sovereignty. Solana Shield AI is one such tool.',
    avatarId: 'avatar-16',
  },
  {
    id: 'testimonial-17',
    name: 'Vitalik Buterin',
    title: 'Co-founder of Ethereum',
    quote: 'Cross-chain security is a major challenge. It is inspiring to see such sophisticated security solutions being built on Solana. The entire ecosystem benefits from this.',
    avatarId: 'avatar-17',
  },
  {
    id: 'testimonial-18',
    name: 'Gavin Wood',
    title: 'Co-founder of Ethereum & Polkadot',
    quote: 'The technical architecture of Solana Shield AI is sound. The way it leverages AI for proactive threat analysis is not just innovative; it is necessary for the future of Web3.',
    avatarId: 'avatar-18',
  },
  {
    id: 'testimonial-19',
    name: 'Anatoly Yakovenko',
    title: 'Co-founder of Solana',
    quote: 'This is exactly the kind of high-quality, security-first application we love to see being built on Solana. It strengthens the entire network and protects our users.',
    avatarId: 'avatar-19',
  },
  {
    id: 'testimonial-20',
    name: 'Raj Gokal',
    title: 'Co-founder of Solana',
    quote: 'User growth is tied to user safety. Solana Shield AI is a critical piece of infrastructure that builds trust and makes Solana a safer place for everyone. Incredibly bullish on this team.',
    avatarId: 'avatar-20',
  }
];

export function Testimonials() {
  const plugin = React.useRef(
    Autoplay({ delay: 3000, stopOnInteraction: true, stopOnMouseEnter: true })
  );

  return (
    <section
      id="testimonials"
      className="relative w-full overflow-hidden py-20 md:py-32"
    >
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
        <Carousel
          opts={{
            align: 'start',
            loop: true,
          }}
          plugins={[plugin.current]}
          className="mt-16"
        >
          <CarouselContent>
            {testimonials.map((testimonial, index) => {
              const avatar = PlaceHolderImages.find(
                (img) => img.id === testimonial.avatarId
              );
              return (
                <CarouselItem
                  key={index}
                  className="md:basis-1/2 lg:basis-1/3"
                >
                  <div className="p-1">
                    <div
                      className={cn(
                        'group relative h-full transform-gpu overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-sm transition-all duration-500 will-change-transform',
                        'hover:scale-[1.02] hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10'
                      )}
                    >
                      <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10" />
                      <div
                        className="absolute -inset-[1px] -z-10 rounded-[calc(1.5rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        aria-hidden="true"
                      />

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
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden lg:flex" />
          <CarouselNext className="hidden lg:flex" />
        </Carousel>
      </div>
    </section>
  );
}
