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
];

export function FAQ() {
  return (
    <section id="faq" className="w-full bg-background py-20 md:py-32">
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
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="rounded-lg bg-card px-4 shadow-clay-light mb-4"
              >
                <AccordionTrigger className="font-headline text-lg text-left hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">
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
