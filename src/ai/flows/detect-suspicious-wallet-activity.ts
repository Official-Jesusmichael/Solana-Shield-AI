'use server';
/**
 * @fileOverview This file implements an ultra-deep Genkit flow for detecting 
 * suspicious activity in a Solana wallet using Helius Orb-level forensics.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectSuspiciousWalletActivityInputSchema = z.object({
  walletAddress: z.string().describe('The Solana wallet address to scan.'),
  context: z.any().optional().describe('Deep blockchain context including Identity, Funding, and History.'),
});
export type DetectSuspiciousWalletActivityInput = z.infer<typeof DetectSuspiciousWalletActivityInputSchema>;

const DetectSuspiciousWalletActivityOutputSchema = z.object({
  threats: z
    .array(
      z.object({
        type: z
          .string()
          .describe('The type of threat detected.'),
        description: z.string().describe('A detailed explanation.'),
        severity: z
          .enum(['low', 'medium', 'high', 'critical'])
          .describe('The severity level.'),
        details: z.string().optional().describe('Technical forensic identifier.'),
      })
    )
    .describe('A list of security threats detected.'),
  summary: z.string().describe('Overall forensic security posture summary.'),
  executiveSummary: z.array(z.object({
    type: z.enum(['text', 'pill']),
    content: z.string(),
    risk: z.enum(['low', 'medium', 'high']).optional(),
  })).describe('A structured narrative summary with key phrases highlighted in pills.'),
  counterparties: z.array(z.object({
    name: z.string(),
    address: z.string(),
    type: z.string(),
    risk: z.enum(['low', 'medium', 'high']),
  })).describe('A list of all detected interacting entities.'),
  identity: z.any().optional(),
  funding: z.any().optional(),
  balances: z.any().optional()
});
export type DetectSuspiciousWalletActivityOutput = z.infer<typeof DetectSuspiciousWalletActivityOutputSchema>;

export async function detectSuspiciousWalletActivity(
  input: DetectSuspiciousWalletActivityInput
): Promise<DetectSuspiciousWalletActivityOutput> {
  return detectSuspiciousWalletActivityFlow(input);
}

const detectSuspiciousWalletActivityPrompt = ai.definePrompt({
  name: 'detectSuspiciousWalletActivityPrompt',
  input: {schema: DetectSuspiciousWalletActivityInputSchema},
  output: {schema: DetectSuspiciousWalletActivityOutputSchema},
  prompt: `You are an elite AI security auditor for the Solana blockchain.
Your task is to perform an ultra-deep forensic analysis of a wallet based on its REAL-TIME on-chain profile.

Wallet Address: {{{walletAddress}}}

Blockchain Context (Deep Forensics):
{{{json context}}}

Your forensic audit MUST cover:
1. **Executive Summary**: A structured narrative organized by flow. Use the "executiveSummary" output to break the text into segments. Parts that are "pill" type should be critical technical findings or risk indicators.
2. **Counterparty Audit**: Identify and list all major counterparties found in the transaction history. Provide their addresses and classify their risk.
3. **Identity & Behavior**: Analyze the wallet's associated names, funding lineage, and behavioral patterns (phishing, drainers, standard DeFi).

Classify key findings in the executive summary as:
- low: blue (Standard interactions, safe protocols)
- medium: yellow (DEX interactions, unverified tokens)
- high: red (Malicious programs, known drainers, mixer interactions)

Please return your deep forensic audit in the requested JSON format.`,
});

const detectSuspiciousWalletActivityFlow = ai.defineFlow(
  {
    name: 'detectSuspiciousWalletActivityFlow',
    inputSchema: DetectSuspiciousWalletActivityInputSchema,
    outputSchema: DetectSuspiciousWalletActivityOutputSchema,
  },
  async input => {
    const {output} = await detectSuspiciousWalletActivityPrompt(input);
    return output!;
  }
);
