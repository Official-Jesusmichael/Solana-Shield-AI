'use client';
import { useEffect, useState } from 'react';
import {
  FileText,
  Server,
  AlertTriangle,
  ShieldOff,
  GitBranch,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Data for the sections
const termsSections = [
  {
    icon: FileText,
    title: 'Agreement to Terms',
    content:
      'By accessing or using the Solana Shield AI application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service. Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.',
  },
  {
    icon: Server,
    title: 'Description of Service',
    content:
      'Solana Shield AI is a security auditing tool for the Solana blockchain. It is designed to help users identify potential security risks associated with their wallets. The service is provided "AS IS" and "AS AVAILABLE" for informational purposes only, without any warranties, express or implied.',
  },
  {
    icon: AlertTriangle,
    title: 'Disclaimers & No Advice',
    content:
      'The information provided by our Service does not constitute financial, investment, or security advice. You are solely responsible for your own decisions, actions, and the security of your wallet. We are not liable for any losses, damages, or claims that may arise from your use of the Service.',
  },
  {
    icon: ShieldOff,
    title: 'Limitation of Liability',
    content:
      'In no event shall Solana Shield AI, its creators, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, resulting from your use of or inability to access the Service, even if we have been advised of the possibility of such damage.',
  },
  {
    icon: GitBranch,
    title: 'Modifications to Terms',
    content:
      'We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days\' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.',
  },
  {
    icon: Mail,
    title: 'Contact Us',
    content: (
      <>
        If you have any questions about these Terms, you can contact us for clarification. Please reach out via{' '}
        <a
          href="https://forms.gle/wyfAutiJc7qf22Fg6"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-black"
        >
          our official form
        </a>
        . We welcome your feedback and inquiries.
      </>
    ),
  },
];

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Our commitment to transparency, security, and our shared success.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {date || '...'}
          </p>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {termsSections.map((section, index) => (
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
