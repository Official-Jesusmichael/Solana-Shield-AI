import Link from 'next/link';
import { Logo } from './Logo';

export function Footer() {
  return (
    <footer className="bg-muted/50">
      <div className="container mx-auto px-4 py-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <Logo />
          <ul className="mt-4 flex flex-wrap items-center text-sm font-medium text-muted-foreground sm:mt-0">
            <li>
              <Link href="/terms" className="me-4 hover:underline md:me-6">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
        <hr className="my-6 border-border sm:mx-auto" />
        <span className="block text-sm text-muted-foreground sm:text-center">
          © {new Date().getFullYear()}{' '}
          <Link href="/" className="hover:underline">
            Solana Shield AI™
          </Link>
          . All Rights Reserved.
        </span>
      </div>
    </footer>
  );
}
