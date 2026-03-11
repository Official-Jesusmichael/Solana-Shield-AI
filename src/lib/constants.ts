import type { AnalyzeMaliciousDappConnectionsInput } from "@/ai/flows/analyze-malicious-dapp-connections-flow";

export const MOCK_WALLET_ADDRESS = "So11111111111111111111111111111111111111112";

export const MOCK_WALLET_CONNECTIONS: AnalyzeMaliciousDappConnectionsInput['connections'] = [
  {
    dappAddress: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tYevGfVAN5gEP75",
    dappName: "Jupiter Exchange",
    permissionsGranted: ["transfer SOL", "transfer SPL tokens", "sign messages"],
    lastInteraction: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
  },
  {
    dappAddress: "mgrdD33tC2u3Ho1JdFkM1RBwJtNEf5tL2h3U2dG1aZc",
    dappName: "MarginFi",
    permissionsGranted: ["deposit SOL", "borrow assets", "access all token accounts"],
    lastInteraction: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
  },
  {
    dappAddress: "hacker1111111111111111111111111111111111111",
    dappName: "Suspicious NFT Mint",
    permissionsGranted: ["unlimited transfer of all assets", "sign arbitrary data"],
    lastInteraction: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
  },
  {
    dappAddress: "rndmC2u3Ho1JdFkM1RBwJtNEf5tL2h3U2dG1aZc",
    dappName: "Unknown Airdrop Claim",
    permissionsGranted: ["transfer SOL", "access token accounts"],
    lastInteraction: new Date(Date.now() - 86400000 * 90).toISOString(), // 90 days ago
  },
];
