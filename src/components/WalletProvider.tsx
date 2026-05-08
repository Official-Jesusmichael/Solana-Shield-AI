"use client";

import React, { FC, useMemo } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { 
    PhantomWalletAdapter, 
    SolflareWalletAdapter, 
    TorusWalletAdapter, 
    WalletConnectWalletAdapter 
} from "@solana/wallet-adapter-wallets";

// Using your private, high-performance Alchemy RPC endpoint.
const RPC_ENDPOINT = "https://solana-mainnet.g.alchemy.com/v2/FVvKBlxDEgnF_ELOYpp_x";

// Your bespoke WalletConnect Project ID for dedicated channel routing.
const WALLETCONNECT_PROJECT_ID = "2af58838e51d67abbcd7808c348a20d2";

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;

    const endpoint = useMemo(() => RPC_ENDPOINT, []);

    const wallets = useMemo(
        () => [
            // The aggressive, specialized MWS protocol has been PURGED.
            // It was the source of the mobile connection failure.

            // WalletConnect is now the primary and universal bridge for all mobile wallets.
            new WalletConnectWalletAdapter({
                network,
                options: {
                    projectId: WALLETCONNECT_PROJECT_ID,
                    metadata: {
                        name: 'Solana Shield AI',
                        description: '#1 protocol for Solana Chain Protection .',
                        url: 'https://solanashieldai.org/',
                        icons: ["https://res.cloudinary.com/diwlbun0d/image/upload/v1775743403/331c5039-93f0-4043-ab40-6b10eeb78579-1_nsowsx.png"],
                    },
                },
            }),
            // Desktop browser extension wallets.
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider wallets={wallets}>
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
