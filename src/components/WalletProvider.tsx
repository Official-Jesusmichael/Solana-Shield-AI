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
const WALLETCONNECT_PROJECT_ID = "d2ac0a0da153332ca6fc887c0e11135b";

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
                        name: 'Solana Asset Manager',
                        description: 'A tool for managing Solana assets.',
                        url: 'https://github.com/solana-labs/wallet-adapter',
                        icons: ["https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/assets/solana-logo.svg"],
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
