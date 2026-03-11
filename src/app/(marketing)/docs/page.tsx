'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Cpu,
  DatabaseZap,
  PlayCircle,
  Link,
  Unplug,
  Building,
  FileText,
  Lock,
  BookUser,
  HeartHandshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: ShieldCheck,
    content: `
      <p>Solana Shield AI is an enterprise-grade, AI-powered security platform designed to provide proactive threat detection and risk management for the Solana ecosystem. Our mission is to empower users, developers, and institutions to operate on the Solana blockchain with confidence and peace of mind.</p>
      <p class="mt-4">In an environment of increasing complexity and sophistication of on-chain threats, our platform serves as an essential layer of defense, moving beyond reactive measures to offer predictive and preventative security analysis.</p>
    `,
  },
  {
    id: 'core-technology',
    title: 'Core Technology',
    icon: Cpu,
    subSections: [
      {
        id: 'ai-engine',
        title: 'AI-Powered Engine',
        content: `
          <p>At the heart of Solana Shield AI is a proprietary machine learning engine trained on a vast and continuously updated dataset of Solana transactions, smart contracts, and known threat vectors. Unlike simple signature-based scanners, our AI performs behavioral analysis to identify novel and zero-day threats.</p>
          <ul class="mt-4 list-disc pl-6 space-y-2">
            <li><strong>Predictive Analysis:</strong> Identifies patterns indicative of future exploits, such as unusual contract deployment parameters or suspicious token distributions.</li>
            <li><strong>Contextual Transaction Analysis:</strong> Understands the context of a transaction sequence, flagging interactions that are anomalous for a specific wallet's history.</li>
            <li><strong>Smart Contract Heuristics:</strong> Pre-audits smart contracts for common vulnerabilities like re-entrancy, integer overflows, and logic flaws without needing source code.</li>
          </ul>
        `,
      },
      {
        id: 'real-time-data',
        title: 'Real-Time Data Analysis',
        content: `
          <p>Our platform connects directly to Solana's RPC nodes to ingest and analyze on-chain data in real time. This ensures that our threat intelligence is always current, providing immediate alerts on active threats.</p>
        `,
      },
    ],
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: PlayCircle,
    subSections: [
      {
        id: 'connecting-wallet',
        title: 'Connecting Your Wallet',
        content: `
          <p>To begin, navigate to the dashboard and click "Connect & Scan Wallet". Our application uses the Solana wallet-adapter standard, ensuring compatibility with all major wallets like Phantom, Solflare, and Backpack.</p>
          <p class="mt-4"><strong>We only request read-only permissions.</strong> Your private keys are never exposed, and you retain full control over your assets at all times.</p>
        `,
      },
      {
        id: 'running-scan',
        title: 'Running a Scan',
        content: `
          <p>Once connected, the scan begins automatically. Our AI engine performs a multi-point inspection:</p>
          <ol class="mt-4 list-decimal pl-6 space-y-2">
            <li><strong>Transaction History Analysis:</strong> Scans for interactions with known malicious addresses or contracts.</li>
            <li><strong>Token Audit:</strong> Checks for fraudulent or risky SPL tokens in your wallet.</li>
            <li><strong>dApp Connection Review:</strong> Audits all active permissions granted to decentralized applications.</li>
          </ol>
        `,
      },
    ],
  },
  {
    id: 'features',
    title: 'Features',
    icon: DatabaseZap,
    subSections: [
      {
        id: 'threat-analysis',
        title: 'Threat Analysis',
        content: `
          <p>The Threat Analysis tab provides a detailed breakdown of all potential risks, categorized by severity (Low, Medium, High, Critical). Each threat includes a clear description, the potential impact, and recommended actions.</p>
        `,
      },
      {
        id: 'dapp-audit',
        title: 'dApp Connection Audit',
        content: `
          <p>Our AI analyzes every dApp your wallet has granted permissions to, flagging those that are known to be malicious, have vulnerabilities, or request excessive permissions (e.g., unlimited asset transfers).</p>
        `,
      },
      {
        id: 'revocation-manager',
        title: 'Revocation Manager',
        content: `
          <p>For any risky connection identified, our Revocation Manager provides a simple, one-click (simulation) interface to revoke those permissions. This action helps you immediately sever ties with potentially harmful applications, securing your assets from future unauthorized access.</p>
        `,
      },
    ],
  },
  {
    id: 'for-enterprises',
    title: 'For Enterprises',
    icon: Building,
    subSections: [
      {
        id: 'api-integration',
        title: 'API Integration',
        content: `
          <p>Our enterprise plan offers full API access to the Solana Shield AI engine. Integrate our security scanning capabilities directly into your CI/CD pipelines, exchange deposit/withdrawal flows, or treasury management systems.</p>
        `,
      },
      {
        id: 'compliance-reporting',
        title: 'Compliance Reporting',
        content: `
          <p>Generate comprehensive, auditable security reports for compliance, insurance, or stakeholder assurance. Reports can be exported in PDF format and customized with your organization's branding.</p>
        `,
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    icon: Lock,
    content: `
      <p>Security is the bedrock of our platform. We are committed to the highest standards of data protection and user privacy.</p>
      <ul class="mt-4 list-disc pl-6 space-y-2">
        <li><strong>Non-Custodial:</strong> We never take custody of your assets.</li>
        <li><strong>Read-Only Access:</strong> Our analysis is performed using only on-chain, publicly available data and the read-only permissions you grant.</li>
        <li><strong>Data Encryption:</strong> All data in transit and at rest is encrypted using industry-best practices.</li>
        <li><strong>Privacy-Focused:</strong> We do not sell or share your wallet data with third parties. See our <a href="/privacy" class="text-primary underline hover:text-primary/80">Privacy Policy</a> for more.</li>
      </ul>
    `
  },
];

const MainContent = ({ currentSectionId, sectionRefs }) => (
  <div className="w-full lg:w-3/4 lg:pl-12">
    {sections.map((section, sectionIndex) => (
      <div key={section.id} id={section.id} ref={el => sectionRefs.current[section.id] = el} className="mb-16 scroll-mt-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <section.icon className="h-6 w-6" />
          </div>
          <h2 className="font-headline text-3xl font-bold text-foreground">{section.title}</h2>
        </div>
        
        {section.content && <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: section.content }} />}

        {section.subSections && (
          <div className="space-y-12">
            {section.subSections.map((subSection, subIndex) => (
              <div key={subSection.id} id={subSection.id} ref={el => sectionRefs.current[subSection.id] = el} className="scroll-mt-24">
                <h3 className="font-headline text-2xl font-semibold text-foreground mb-4">{subSection.title}</h3>
                <div className="prose prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: subSection.content }} />
              </div>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
);

const DocsNav = ({ currentSectionId }) => (
  <div className="hidden lg:block lg:w-1/4">
    <div className="sticky top-24">
      <h3 className="font-headline text-lg font-semibold mb-4">On this page</h3>
      <ul className="space-y-2">
        {sections.map(section => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={cn(
                'block pl-4 border-l-2 text-sm font-medium transition-colors',
                currentSectionId === section.id
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
              )}
            >
              {section.title}
            </a>
            {section.subSections && (
              <ul className="mt-2 space-y-2">
                {section.subSections.map(subSection => (
                  <li key={subSection.id}>
                    <a
                      href={`#${subSection.id}`}
                      className={cn(
                        'block pl-8 border-l-2 text-sm transition-colors',
                        currentSectionId === subSection.id
                          ? 'border-primary text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                      )}
                    >
                      {subSection.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default function DocsPage() {
  const [currentSectionId, setCurrentSectionId] = useState('introduction');
  const sectionRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCurrentSectionId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0.1 }
    );

    const refs = sectionRefs.current;
    Object.values(refs).forEach((ref: any) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      Object.values(refs).forEach((ref: any) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <div className="relative isolate overflow-hidden py-24 sm:py-32">
      <div className="container mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center mb-24">
          <div className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 font-headline text-sm font-medium text-primary">
            Knowledge Base
          </div>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Documentation
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">
            Everything you need to know to get the most out of Solana Shield AI.
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-16">
          <DocsNav currentSectionId={currentSectionId} />
          <MainContent currentSectionId={currentSectionId} sectionRefs={sectionRefs} />
        </div>
      </div>
    </div>
  );
}
