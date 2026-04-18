/**
 * @fileOverview Helius API Utility for real-time Solana blockchain forensics.
 * Provides high-performance access to enhanced transactions, asset data, and wallet intelligence.
 * Optimized for Helius Developer/Pro tier credentials.
 */

// Super Ultra Unparalleled Perfection Helius API Key
const HELIUS_API_KEY = 'c88a42f2-63f0-42e8-9694-a0ace748b03d';
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
 * Fetches ultra-refined, human-readable transaction history for a Solana address.
 * Mimics Helius Orb's deep forensic capabilities by filtering for meaningful balance changes.
 */
export async function fetchEnhancedTransactions(address: string): Promise<HeliusTransaction[]> {
  try {
    // Construct a high-fidelity query:
    // - limit=100: Fetches a deep set of recent activities.
    // - token-accounts=balanceChanged: The core of the "Orb" refinement. It filters out noise
    //   (e.g., spam, unrelated system ops) and focuses only on transactions that
    //   materially changed the wallet's token balances, as recommended for a clean history.
    const url = new URL(`${HELIUS_API_URL}/v0/addresses/${address}/transactions`);
    url.searchParams.append('api-key', HELIUS_API_KEY);
    url.searchParams.append('limit', '100');
    url.searchParams.append('token-accounts', 'balanceChanged');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Helius API Request Failed: ${response.statusText} - ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Helius Forensic Data Fetch Error:', error);
    return [];
  }
}

/**
 * Fetches the identity signature of a wallet (Names, Categories, Tags).
 * Based on Helius Wallet API v1 documentation.
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
 * Based on Helius Wallet API v1 documentation.
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
 * Fetches all token and NFT balances with USD pricing for a comprehensive portfolio view.
 * Based on Helius Wallet API v1 documentation.
 */
export async function fetchWalletBalances(address: string) {
  try {
    // showNfts=true: Enriches the balance data with NFT holdings, providing a more
    // complete picture of the wallet's assets in a single, efficient call.
    const url = new URL(`${HELIUS_API_URL}/v1/wallet/${address}/balances`);
    url.searchParams.append('api-key', HELIUS_API_KEY);
    url.searchParams.append('showNfts', 'true');

    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Balance Extraction Error:', error);
    return null;
  }
}

/**
 * Fetches full asset inventory using DAS API.
 * This provides a definitive count and list of all assets owned by the address.
 */
export async function fetchWalletAssets(address: string) {
  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'shield-ai-audit-assets',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: address,
          page: 1,
          limit: 1000, // Increased limit for more comprehensive asset fetching
          displayOptions: {
            showFungible: true,
            showNativeBalance: true,
            showUnverified: false // Filter out potential spam assets
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
