'use server';
/**
 * @fileOverview This file implements a Genkit flow for detecting suspicious activity
 * in a Solana wallet, providing early warnings about potential security risks.
 *
 * - detectSuspiciousWalletActivity - A function to initiate the wallet scanning process.
 * - DetectSuspiciousWalletActivityInput - The input type for the detection function.
 * - DetectSuspiciousWalletActivityOutput - The output type detailing detected threats.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectSuspiciousWalletActivityInputSchema = z.object({
  walletAddress: z.string().describe('The Solana wallet address to scan for suspicious activity.'),
});
export type DetectSuspiciousWalletActivityInput = z.infer<typeof DetectSuspiciousWalletActivityInputSchema>;

const DetectSuspiciousWalletActivityOutputSchema = z.object({
  threats: z
    .array(
      z.object({
        type: z
          .string()
          .describe('The type of threat detected (e.g., suspicious_transaction, phishing_attempt, malicious_interaction).'),
        description: z.string().describe('A detailed explanation of the detected threat.'),
        severity: z
          .enum(['low', 'medium', 'high', 'critical'])
          .describe('The severity level of the threat.'),
        details: z.string().optional().describe('Optional additional technical details or identifiers related to the threat.'),
      })
    )
    .describe('A list of security threats detected for the given wallet address.'),
  summary: z.string().describe('A brief summary of the overall security posture and findings.'),
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
  prompt: `You are an enterprise-grade AI security auditor specializing in Solana blockchain. Your task is to rigorously scan a given Solana wallet address for any suspicious activity, potential phishing attempts, and interactions with known malicious entities.

Analyze the wallet's historical data, recent transactions, and connected dApps (simulated based on your knowledge base) to identify any anomalies. Provide a list of detected threats, including their type, a clear description, their severity, and any relevant details.

If no threats are detected, return an empty array for 'threats'. Always provide an overall summary of the security posture.

Wallet Address to Scan: {{{walletAddress}}}`,
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
