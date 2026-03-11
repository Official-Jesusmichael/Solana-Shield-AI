'use client';
import {useEffect, useState} from 'react';

export default function TermsOfServicePage() {
    const [date, setDate] = useState('');
    useEffect(() => {
        setDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    }, []);

  return (
    <div className="bg-background py-16 sm:py-24">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Last updated: {date}
        </p>
        <div className="prose prose-lg mt-10 max-w-none text-foreground prose-headings:font-headline prose-headings:text-foreground dark:prose-invert">
          <p>
            Please read these Terms of Service ("Terms", "Terms of Service")
            carefully before using the Solana Shield AI application (the
            "Service") operated by us.
          </p>
          <h2>1. Agreement to Terms</h2>
          <p>
            By using our Service, you agree to be bound by these Terms. If you
            disagree with any part of the terms, then you do not have permission
            to access the Service.
          </p>
          <h2>2. Description of Service</h2>
          <p>
            Solana Shield AI is a security auditing tool for the Solana
            blockchain. It is designed to help users identify potential security
            risks associated with their wallets. The service is provided "AS IS"
            and "AS AVAILABLE" without any warranties.
          </p>
          <h2>3. Disclaimers</h2>
          <p>
            The information provided by our Service is for informational
            purposes only and should not be considered as financial or security
            advice. You are solely responsible for your own decisions and the security of
            your wallet. We are not liable for any losses or damages that may
            occur.
          </p>
          <h2>4. Limitation of Liability</h2>
          <p>
            In no event shall Solana Shield AI, nor its directors, employees,
            partners, agents, suppliers, or affiliates, be liable for any
            indirect, incidental, special, consequential or punitive damages,
            including without limitation, loss of profits, data, use, goodwill,
            or other intangible losses, resulting from your access to or use of
            or inability to access or use the Service.
          </p>
          <h2>5. Changes</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. We will provide at least 30 days' notice
            prior to any new terms taking effect.
          </p>
          <h2>6. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please contact us at:
            legal@solanashield.ai
          </p>
        </div>
      </div>
    </div>
  );
}
