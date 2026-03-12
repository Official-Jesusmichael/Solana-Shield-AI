import {
  Aperture,
  Briefcase,
  Feather,
  GitFork,
  Layers,
  Repeat,
  Scaling,
  Wind,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const companies = [
  { name: 'Solana Ventures', icon: Wind },
  { name: 'a16z Crypto', icon: Scaling },
  { name: 'Paradigm', icon: Layers },
  { name: 'Coinbase', icon: Repeat },
  { name: 'Circle', icon: Aperture },
  { name: 'Metaplex', icon: Briefcase },
  { name: 'Phantom', icon: Feather },
  { name: 'Backpack', icon: Briefcase },
  { name: 'Jupiter', icon: GitFork },
];

export function SupportedBy() {
  const allCompanies = [...companies, ...companies]; // Duplicate for seamless loop

  return (
    <section className="w-full py-12 md:py-16">
      <div className="container mx-auto">
        <p className="text-center font-headline text-sm font-medium text-muted-foreground">
          Trusted and Utilized by Industry Leaders
        </p>
        <div
          className="group relative mt-6 flex overflow-x-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, hsl(0 0% 0% / 0), hsl(0 0% 0% / 1) 10%, hsl(0 0% 0% / 1) 90%, hsl(0 0% 0% / 0))',
          }}
        >
          <div className="flex shrink-0 animate-marquee items-center group-hover:[animation-play-state:paused]">
            {allCompanies.map((company, index) => (
              <div key={index} className="mx-6 flex items-center gap-3">
                <company.icon className="h-6 w-6 text-muted-foreground" />
                <span className="text-lg font-bold text-muted-foreground">
                  {company.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
