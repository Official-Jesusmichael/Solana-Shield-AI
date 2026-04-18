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
  prompt: `You are an elite AI security auditor for the Solana blockchain, operating at the same intelligence level as Helius Orbs. 
Your task is to perform an ultra-deep forensic analysis of a wallet based on its REAL-TIME on-chain profile.

Wallet Address: {{{walletAddress}}}

Blockchain Context (Deep Forensics):
{{{json context}}}

Your forensic audit MUST cover:
1. **Identity Resolution**: Analyze the wallet's associated names and categories. Is it a known exchange, protocol, or a high-risk unclassified entity?
2. **Funding Source Analysis**: Evaluate the "funded-by" lineage. Was this wallet funded by a known mixer, a suspicious exchange, or a safe individual?
3. **Behavioral Forensics**: Meticulously audit the recent transactions for phishing patterns, unusual token distributions (spam/airdrops), or rapid interactions with malicious contracts.
4. **Asset Integrity**: Check the portfolio for unverified tokens or high-risk "drainer" NFTs.

If the context shows 0 transactions and no history, provide a 'Clean' summary but highlight the lack of on-chain footprint. 
If data is present, command absolute professional authority in your findings.

Please return your deep forensic audit in JSON format.`,
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
