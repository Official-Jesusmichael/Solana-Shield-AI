'use client';
import { useEffect, useState } from 'react';
import { DatabaseZap, ShieldCheck, Share2, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

// Data for the sections
const privacySections = [
  {
    icon: DatabaseZap,
    title: 'Information We Collect',
    content:
      'We collect your public Solana wallet address when you connect it. We may also collect anonymous usage data like your IP address and browser type to improve our service. We do not collect or store your private keys.',
  },
  {
    icon: ShieldCheck,
    title: 'Use of Your Information',
    content:
      'We use your information to provide our core service of scanning your wallet for threats, to improve our application, to monitor usage trends, and to ensure the security and integrity of our platform.',
  },
  {
    icon: Share2,
    title: 'Disclosure of Your Information',
    content:
      'We do not share your personal information with third parties except as described. We may share data with trusted service providers who need access to it to carry out work on our behalf, under strict confidentiality.',
  },
  {
    icon: Lock,
    title: 'Security of Your Information',
    content:
      'We use administrative, technical, and physical security measures to help protect your information. While we take reasonable steps to secure your data, no security measures are perfect or impenetrable.',
  },
  {
    icon: Mail,
    title: 'Contact Us',
    content: (
      <>
        If you have questions or comments about this Privacy Policy, please contact us at:{' '}
        <a
          href="https://forms.gle/wyfAutiJc7qf22Fg6"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-black"
        >
          our official form
        </a>
        . We are committed to addressing your concerns and protecting your privacy.
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  const [date, setDate] = useState('');
  useEffect(() => {
    // This will only run on the client, after hydration
    setDate(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  return (
    <div className="relative isolate overflow-hidden py-24 sm:py-32">
      <div className="container mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Privacy Policy
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Our commitment to protecting your data and respecting your privacy.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {date || '...'}
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {privacySections.map((section, index) => (
            <div
              key={index}
              className={cn(
                'group relative transform-gpu overflow-hidden rounded-3xl border bg-card/40 p-8 shadow-sm transition-all duration-500 will-change-transform',
                'hover:scale-[1.02] hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/10'
              )}
            >
              {/* Inner Glow */}
              <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-br from-white/5 to-transparent opacity-50 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10"></div>
              
              {/* Animated Border */}
              <div className="absolute -inset-[1px] -z-10 rounded-[calc(1.5rem+1px)] bg-gradient-to-b from-primary/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden="true"></div>

              <div className="relative">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                    <section.icon className="h-6 w-6" />
                  </div>
                  <h2 className="font-headline text-xl font-bold text-foreground">
                    {section.title}
                  </h2>
                </div>
                <div className="mt-6 text-base leading-relaxed text-muted-foreground">
                  {section.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
