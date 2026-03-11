'use server';

import { analyzeMaliciousDappConnections } from '@/ai/flows/analyze-malicious-dapp-connections-flow';
import type { AnalyzeMaliciousDappConnectionsOutput } from '@/ai/flows/analyze-malicious-dapp-connections-flow';
import { detectSuspiciousWalletActivity } from '@/ai/flows/detect-suspicious-wallet-activity';
import type { DetectSuspiciousWalletActivityOutput } from '@/ai/flows/detect-suspicious-wallet-activity';
import { MOCK_WALLET_CONNECTIONS } from '@/lib/constants';

export async function runWalletActivityScan(
  walletAddress: string
): Promise<DetectSuspiciousWalletActivityOutput> {
  try {
    const result = await detectSuspiciousWalletActivity({ walletAddress });
    return result;
  } catch (error) {
    console.error('Error in runWalletActivityScan:', error);
    // In a real app, you might want to return a structured error object
    return {
      threats: [
        {
          type: 'error',
          description: 'Failed to run wallet activity scan.',
          severity: 'critical',
          details: error instanceof Error ? error.message : String(error),
        },
      ],
      summary:
        'An error occurred while scanning the wallet. Please try again later.',
    };
  }
}

export async function runDappConnectionAnalysis(
  walletAddress: string
): Promise<AnalyzeMaliciousDappConnectionsOutput> {
  try {
    const result = await analyzeMaliciousDappConnections({
      walletAddress,
      connections: MOCK_WALLET_CONNECTIONS,
    });
    return result;
  } catch (error) {
    console.error('Error in runDappConnectionAnalysis:', error);
    return {
      analysisResults: [],
      overallSummary:
        'An error occurred while analyzing dApp connections. Please try again later.',
    };
  }
}
