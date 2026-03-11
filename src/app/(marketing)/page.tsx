import { CTA } from '@/components/landing/CTA';
import { FAQ } from '@/components/landing/FAQ';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Testimonials } from '@/components/landing/Testimonials';
import { Why } from '@/components/landing/Why';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Features />
      <Why />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
}
