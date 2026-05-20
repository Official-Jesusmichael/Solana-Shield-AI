"use client";

import React, { FC, useMemo, useCallback } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    WalletConnectWalletAdapter
} from "@solana/wallet-adapter-wallets";
// Removed react-hot-toast import to ensure zero-dependency build stability

// Using your private, high-performance Alchemy RPC endpoint.
const RPC_ENDPOINT = "https://solana-mainnet.g.alchemy.com/v2/FVvKBlxDEgnF_ELOYpp_x";

// Your bespoke WalletConnect Project ID for dedicated channel routing.
const WALLETCONNECT_PROJECT_ID = "814452fd12b77a99b5694298acaee9b5";

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;

    const endpoint = useMemo(() => RPC_ENDPOINT, []);

    // Error handling to ensure "zero defect" stability
    const onError = useCallback((error: WalletError) => {
        console.error("Wallet Error:", error);
        const message = error.message ? error.message : "An unknown wallet error occurred";

        // Defensive UI notification fallback.
        // This prevents build crashes if react-hot-toast or similar is missing.
        try {
            if (typeof window !== "undefined") {
                // Check for common toast implementations or fall back gracefully
                const anyWindow = window as any;
                if (anyWindow.toast?.error) {
                    anyWindow.toast.error(message);
                }
            }
        } catch (e) {
            console.warn("UI Notification failed:", message);
        }
    }, []);

    const wallets = useMemo(
        () => {
            // SSR Guard: Ensure crypto-heavy adapters only initialize in the browser.
            // This prevents "bigint" binding errors during static site generation on Netlify.
            if (typeof window === "undefined") return [];

            return [
                // WalletConnect is the primary and universal bridge for all mobile wallets.
                // Optimized with redirect metadata to solve the mobile deep-linking issue.
                new WalletConnectWalletAdapter({
                    network,
                    options: {
                        projectId: WALLETCONNECT_PROJECT_ID,
                        relayUrl: 'wss://relay.walletconnect.com',
                        metadata: {
                            name: 'Solana Shield AI',
                            description: '#1 protocol for Solana Chain Protection.',
                            url: 'https://solanashieldai.org',
                            icons: ["https://res.cloudinary.com/diwlbun0d/image/upload/v1775743403/331c5039-93f0-4043-ab40-6b10eeb78579-1_nsowsx.png"],
                            redirect: {
                                native: 'https://solanashieldai.org',
                                universal: 'https://solanashieldai.org',
                            },
                        },
                    },
                }),
                // Desktop browser extension wallets.
                new PhantomWalletAdapter(),
                new SolflareWalletAdapter({ network }),
                new TorusWalletAdapter(),
            ];
        },
        [network]
    );

    // Prevent rendering on server to ensure hydration consistency and zero-defect execution.
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider
                wallets={wallets}
                onError={onError}
                autoConnect={true}
                localStorageKey="solana-shield-ai-wallet-session"
            >
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;