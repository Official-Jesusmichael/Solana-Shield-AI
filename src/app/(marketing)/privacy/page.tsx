export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background py-16 sm:py-24">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>
        <div className="prose prose-lg mt-10 max-w-none text-foreground prose-headings:font-headline prose-headings:text-foreground">
          <p>
            Welcome to Solana Shield AI. We are committed to protecting your
            privacy. This Privacy Policy explains how we collect, use,
            disclose, and safeguard your information when you use our
            application.
          </p>
          <h2>1. Information We Collect</h2>
          <p>
            We may collect information about you in a variety of ways. The
            information we may collect via the Application includes:
          </p>
          <ul>
            <li>
              <strong>Wallet Information:</strong> We collect your public Solana
              wallet address when you connect it to our service. We do not
              collect or store your private keys.
            </li>
            <li>
              <strong>Usage Data:</strong> We may automatically collect
              information about your device and how you use the Application,
              such as your IP address, browser type, and the pages you visit.
            </li>
          </ul>
          <h2>2. Use of Your Information</h2>
          <p>
            Having accurate information about you permits us to provide you with
            a smooth, efficient, and customized experience. Specifically, we may
            use information collected about you via the Application to:
          </p>
          <ul>
            <li>
              Provide our core service of scanning your wallet for security
              threats.
            </li>
            <li>Improve our application and user experience.</li>
            <li>Monitor and analyze usage and trends.</li>
            <li>Ensure the security of our platform.</li>
          </ul>
          <h2>3. Disclosure of Your Information</h2>
          <p>
            We do not share your personal information with third parties except
            as described in this Privacy Policy. We may share information with
            vendors, consultants, and other third-party service providers who
            need access to such information to carry out work on our behalf.
          </p>
          <h2>4. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to
            help protect your personal information. While we have taken
            reasonable steps to secure the personal information you provide to
            us, please be aware that despite our efforts, no security measures
            are perfect or impenetrable.
          </p>
          <h2>5. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please
            contact us at: privacy@solanashield.ai
          </p>
        </div>
      </div>
    </div>
  );
}
