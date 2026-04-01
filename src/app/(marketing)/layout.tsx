import { Footer } from '@/components/shared/Footer';
import { Header } from '@/components/shared/Header';

/**
 * @fileOverview Layout for marketing pages.
 * Includes padding adjustments to accommodate the floating navigation and footer docks.
 */

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-32 pt-24">{children}</main>
      <Footer />
    </div>
  );
}
