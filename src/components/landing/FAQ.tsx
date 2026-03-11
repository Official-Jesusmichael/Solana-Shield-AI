import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqs = [
  {
    question: 'What is Solana Shield AI?',
    answer:
      'Solana Shield AI is an advanced security tool that uses artificial intelligence to scan your Solana wallet for threats. It helps you identify malicious transactions, risky dApp connections, and potential phishing attempts before they can cause harm.',
  },
  {
    question: 'Is it safe to connect my wallet?',
    answer:
      'Yes. Solana Shield AI uses industry-standard, secure methods to connect to your wallet. We only require read-only access to your public transaction history and never ask for or store your private keys. Your assets remain under your control at all times.',
  },
  {
    question: 'How does the AI threat detection work?',
    answer:
      "Our AI is trained on a massive dataset of Solana transactions and smart contracts, including known security exploits and malicious patterns. It analyzes your wallet's activity in real-time to flag anything that deviates from normal, safe behavior.",
  },
  {
    question: 'Can Solana Shield AI revoke permissions for me?',
    answer:
      'Our Revocation Manager provides a simplified, user-friendly interface to review and revoke risky permissions you\'ve granted to dApps. While we guide you through the process, the final transaction to revoke permissions must always be signed and approved by you in your wallet.',
  },
  {
    question: 'Is this service free?',
    answer:
      'We offer a free basic scan to help you get a quick overview of your wallet\'s security posture. For continuous monitoring, real-time alerts, and advanced features, we offer premium subscription plans.',
  },
  {
    question: 'What types of wallets does Solana Shield AI support?',
    answer:
      'Solana Shield AI is compatible with all major Solana wallets that adhere to the wallet-adapter standard, including Phantom, Solflare, and Backpack. If you can connect it to a dApp, you can scan it with us.',
  },
  {
    question: 'How does the pricing work for enterprise teams?',
    answer:
      'We offer tailored enterprise plans that include team-based access, unlimited scans, API access for CI/CD integration, and dedicated support. Please contact our sales team for a custom quote.',
  },
  {
    question: 'Can I integrate Solana Shield AI into my CI/CD pipeline?',
    answer:
      'Yes, our enterprise plan includes API access that allows you to programmatically scan wallets or smart contracts as part of your development and deployment workflows, ensuring continuous security.',
  },
  {
    question: 'How often is the AI model updated with new threat intelligence?',
    answer:
      'Our security team and AI models are constantly analyzing new on-chain threats. The threat intelligence database is updated in near real-time, ensuring our users are protected against the latest zero-day exploits and scams.',
  },
  {
    question: 'Do you provide detailed reports for compliance and auditing?',
    answer:
      'Absolutely. Solana Shield AI generates comprehensive, exportable security reports that detail findings, risk levels, and remediation steps. These reports are ideal for internal audits, compliance requirements, and for providing security assurances to stakeholders.',
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative w-full overflow-hidden bg-background py-20 md:py-32">
       <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 15% 85%, hsl(var(--primary)/0.05), transparent 30%), radial-gradient(circle at 85% 25%, hsl(var(--accent)/0.05), transparent 30%)',
        }}
      />
      <div className="container mx-auto max-w-4xl px-4">
        <div className="text-center">
          <h2 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Have questions? We have answers. If you have other questions, feel
            free to reach out.
          </p>
        </div>
        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="group overflow-hidden rounded-2xl border bg-card/40 shadow-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 data-[state=open]:border-primary/40 data-[state=open]:shadow-lg data-[state=open]:shadow-primary/10"
              >
                <AccordionTrigger className="px-6 py-4 font-headline text-lg text-left transition-colors hover:no-underline group-hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 text-base text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
