/**
 * @fileOverview Helius API Utility for real-time Solana blockchain forensics.
 * Provides high-performance access to enhanced transactions and asset data.
 */

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || 'd2ac0a0da153332ca6fc887c0e11135b'; // Fallback to provided key or env
const HELIUS_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export interface HeliusTransaction {
  description: string;
  type: string;
  source: string;
  fee: number;
  signature: string;
  timestamp: number;
  nativeTransfers?: any[];
  tokenTransfers?: any[];
}

export async function fetchEnhancedTransactions(address: string): Promise<HeliusTransaction[]> {
  try {
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}`);
    if (!response.ok) throw new Error('Helius API Request Failed');
    return await response.json();
  } catch (error) {
    console.error('Forensic Data Fetch Error:', error);
    return [];
  }
}

export async function fetchWalletAssets(address: string) {
  try {
    const response = await fetch(HELIUS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'my-id',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 100,
          displayOptions: { showFungible: true }
        },
      }),
    });
    const { result } = await response.json();
    return result;
  } catch (error) {
    console.error('Asset Inventory Error:', error);
    return null;
  }
}
