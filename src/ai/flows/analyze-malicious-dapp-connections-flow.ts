'use server';
/**
 * @fileOverview An AI agent that analyzes active dApp and smart contract connections for a Solana wallet.
 *
 * - analyzeMaliciousDappConnections - A function that handles the analysis of dApp connections.
 * - AnalyzeMaliciousDappConnectionsInput - The input type for the analyzeMaliciousDappConnections function.
 * - AnalyzeMaliciousDappConnectionsOutput - The return type for the analyzeMaliciousDappConnections function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ConnectionDetailSchema = z.object({
  dappAddress: z.string().describe('The public key or address of the dApp or smart contract.'),
  dappName: z.string().optional().describe('An optional human-readable name for the dApp.'),
  permissionsGranted: z
    .array(z.string())
    .describe('A list of permissions granted to this dApp (e.g., "transfer SOL", "sign messages", "access token accounts").'),
  lastInteraction: z
    .string()
    .optional()
    .describe('The timestamp of the last interaction with this dApp, in ISO 8601 format.'),
});

const AnalyzeMaliciousDappConnectionsInputSchema = z.object({
  walletAddress: z.string().describe('The Solana wallet address being analyzed.'),
  connections: z
    .array(ConnectionDetailSchema)
    .describe('A list of active dApp and smart contract connections.'),
});
export type AnalyzeMaliciousDappConnectionsInput = z.infer<typeof AnalyzeMaliciousDappConnectionsInputSchema>;

const ConnectionAnalysisResultSchema = z.object({
  dappAddress: z.string().describe('The public key or address of the dApp or smart contract.'),
  dappName: z.string().optional().describe('The human-readable name of the dApp, if provided.'),
  isMalicious: z.boolean().describe('True if the dApp or smart contract is identified as potentially malicious or high-risk.'),
  riskLevel: z
    .enum(['none', 'low', 'medium', 'high', 'critical'])
    .describe('The overall risk level associated with this connection.'),
  identifiedVulnerabilities: z
    .array(z.string())
    .describe('A list of specific vulnerabilities, suspicious behaviors, or risks identified for this connection.'),
  explanation: z
    .string()
    .describe('A detailed explanation of the analysis, including reasons for the risk level, potential impact, and recommended actions.'),
});

const AnalyzeMaliciousDappConnectionsOutputSchema = z.object({
  analysisResults: z
    .array(ConnectionAnalysisResultSchema)
    .describe('An array of analysis results, one for each connected dApp or smart contract.'),
  overallSummary: z.string().describe('A general summary of the security posture based on the analyzed connections.'),
});
export type AnalyzeMaliciousDappConnectionsOutput = z.infer<typeof AnalyzeMaliciousDappConnectionsOutputSchema>;

export async function analyzeMaliciousDappConnections(
  input: AnalyzeMaliciousDappConnectionsInput
): Promise<AnalyzeMaliciousDappConnectionsOutput> {
  return analyzeMaliciousDappConnectionsFlow(input);
}

const analyzeDappConnectionPrompt = ai.definePrompt({
  name: 'analyzeDappConnectionPrompt',
  input: {schema: AnalyzeMaliciousDappConnectionsInputSchema},
  output: {schema: AnalyzeMaliciousDappConnectionsOutputSchema},
  prompt: `You are an expert Solana blockchain security auditor. Your task is to meticulously analyze a list of active dApp and smart contract connections for a user's Solana wallet. For each connection, identify any potential vulnerabilities, suspicious behaviors, or known malicious patterns. Assign a risk level and provide a clear, detailed explanation of your findings, including the potential impact and recommended actions. Finally, provide an overall summary of the wallet's security posture based on these connections.

Consider the dApp address, granted permissions, and last interaction time to assess the risk. If a dApp is known to be malicious or exploit critical vulnerabilities, mark `isMalicious` as true and assign a 'critical' risk level.

Wallet Address: {{{walletAddress}}}

Connections to analyze:
{{#each connections}}
--- Connection to dApp "{{{dappName}}}" (Address: {{{dappAddress}}}) ---
Permissions Granted:
{{#each permissionsGranted}}- {{{this}}}
{{/each}}
Last Interaction: {{{lastInteraction}}}
---
{{/each}}

Please provide your analysis in the following JSON format:`,
});

const analyzeMaliciousDappConnectionsFlow = ai.defineFlow(
  {
    name: 'analyzeMaliciousDappConnectionsFlow',
    inputSchema: AnalyzeMaliciousDappConnectionsInputSchema,
    outputSchema: AnalyzeMaliciousDappConnectionsOutputSchema,
  },
  async input => {
    const {output} = await analyzeDappConnectionPrompt(input);
    return output!;
  }
);
