import { FAQ } from '@/components/landing/FAQ';
import { Features } from '@/components/landing/Features';
import { Hero } from '@/components/landing/Hero';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Features />
      <FAQ />
    </div>
  );
}
