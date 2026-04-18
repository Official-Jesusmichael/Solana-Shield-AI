/**
 * @fileOverview Helius API Utility for real-time Solana blockchain forensics.
 * Provides high-performance access to enhanced transactions, asset data, and wallet intelligence.
 */

// Official Helius API Key
const HELIUS_API_KEY = 'fe8246a3-a6c8-4285-816f-788626d86e09'; 
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API_URL = `https://api.helius.xyz`;

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

/**
 * Fetches enhanced transaction history for a specific Solana address.
 * Utilizes Helius's high-performance parsing engine.
 */
export async function fetchEnhancedTransactions(address: string): Promise<HeliusTransaction[]> {
  try {
    const response = await fetch(`${HELIUS_API_URL}/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}`);
    if (!response.ok) {
      throw new Error(`Helius API Request Failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Forensic Data Fetch Error:', error);
    return [];
  }
}

/**
 * Fetches the identity signature of a wallet (Names, Categories, Tags).
 */
export async function fetchWalletIdentity(address: string) {
  try {
    const response = await fetch(`${HELIUS_API_URL}/v1/wallet/${address}/identity?api-key=${HELIUS_API_KEY}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Identity Resolution Error:', error);
    return null;
  }
}

/**
 * Discovers the original funding source for a wallet.
 */
export async function fetchFundingSource(address: string) {
  try {
    const response = await fetch(`${HELIUS_API_URL}/v1/wallet/${address}/funded-by?api-key=${HELIUS_API_KEY}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Funding Discovery Error:', error);
    return null;
  }
}

/**
 * Fetches all token and NFT balances with USD pricing.
 */
export async function fetchWalletBalances(address: string) {
  try {
    const response = await fetch(`${HELIUS_API_URL}/v1/wallet/${address}/balances?api-key=${HELIUS_API_KEY}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Balance Extraction Error:', error);
    return null;
  }
}

/**
 * Fetches full asset inventory using DAS API.
 */
export async function fetchWalletAssets(address: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'shield-ai-audit',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 100,
          displayOptions: { 
            showFungible: true,
            showNativeBalance: true
          }
        },
      }),
    });
    
    if (!response.ok) return null;

    const { result } = await response.json();
    return result;
  } catch (error) {
    console.error('Asset Inventory Error:', error);
    return null;
  }
}
