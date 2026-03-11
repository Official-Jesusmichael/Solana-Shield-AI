import { CTA } from '@/components/landing/CTA';
import { FAQ } from '@/components/landing/FAQ';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';
import { Testimonials } from '@/components/landing/Testimonials';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Features />
      <Testimonials />
      <FAQ />
      <CTA />
    </div>
  );
}
