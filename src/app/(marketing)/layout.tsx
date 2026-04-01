import { Footer } from '@/components/shared/Footer';
import { Header } from '@/components/shared/Header';

/**
 * @fileOverview Layout for marketing pages.
 * Includes padding adjustments to accommodate the floating header and standard footer.
 */

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-24">{children}</main>
      <Footer />
    </div>
  );
}
