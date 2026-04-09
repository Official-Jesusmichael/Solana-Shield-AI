'use server';
/**
 * @fileOverview This file implements a Genkit flow for detecting suspicious activity
 * in a Solana wallet using REAL blockchain context.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectSuspiciousWalletActivityInputSchema = z.object({
  walletAddress: z.string().describe('The Solana wallet address to scan.'),
  context: z.any().optional().describe('Real-time blockchain context from Helius.'),
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
        details: z.string().optional().describe('Technical payload identifier.'),
      })
    )
    .describe('A list of security threats detected.'),
  summary: z.string().describe('Overall security posture summary.'),
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
  prompt: `You are an enterprise-grade AI security auditor for the Solana blockchain. 
Your task is to analyze a wallet based on its REAL recent transaction history and asset profile.

Wallet Address: {{{walletAddress}}}

Blockchain Context:
{{{json context}}}

Analyze the transactions for:
1. Known malicious signatures or phishing patterns.
2. Unusual token distributions or airdrops.
3. Rapid, repetitive interactions with unverified contracts.

If the context shows 0 transactions, provide a 'Clean' summary but note that the wallet has zero on-chain history. 
If transactions are found, meticulously audit each one for security breaches.

Please return your forensic findings in JSON format.`,
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
