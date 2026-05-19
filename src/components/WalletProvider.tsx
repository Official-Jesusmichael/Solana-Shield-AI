"use client";

import React, { FC, useMemo, useCallback, useEffect, useRef } from "react";
import {
    ConnectionProvider,
    WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
    WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** High-performance Alchemy RPC endpoint. */
const RPC_ENDPOINT =
    "https://solana-mainnet.g.alchemy.com/v2/FVvKBlxDEgnF_ELOYpp_x";

/** WalletConnect Cloud Project ID. */
const WALLETCONNECT_PROJECT_ID = "814452fd12b77a99b5694298acaee9b5";

/** Key used by the Solana wallet-adapter to persist the last-connected wallet name. */
const WALLET_NAME_STORAGE_KEY = "walletName";

/** Stale WalletConnect session prefix in localStorage. */
const WC_SESSION_PREFIX = "wc@2:";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Purge orphaned / expired WalletConnect v2 sessions from localStorage.
 *
 * Stale sessions are the #1 cause of "stuck connecting" and silent reconnection
 * failures on mobile. This runs once on provider mount to guarantee a clean
 * handshake every cold-start.
 */
function purgeStaleWalletConnectSessions(): void {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(WC_SESSION_PREFIX)) {
                try {
                    const raw = localStorage.getItem(key);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        // WC v2 stores expiry as a Unix timestamp (seconds).
                        if (parsed?.expiry && parsed.expiry * 1000 < Date.now()) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    // Corrupted entry — remove unconditionally.
                    keysToRemove.push(key);
                }
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
        // localStorage may be unavailable (SSR, private browsing quota).
    }
}

/**
 * Detect whether the current environment is a mobile browser.
 * Used to configure WalletConnect behaviour (deep-link vs QR).
 */
function isMobileBrowser(): boolean {
    if (typeof navigator === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Component
// ─────────────────────────────────────────────────────────────────────────────

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;
    const isMobile = useMemo(() => isMobileBrowser(), []);
    const sessionPurged = useRef(false);

    // ── Purge stale WC sessions once on mount ────────────────────────────
    useEffect(() => {
        if (!sessionPurged.current) {
            purgeStaleWalletConnectSessions();
            sessionPurged.current = true;
        }
    }, []);

    // ── RPC endpoint (memoised, stable reference) ────────────────────────
    const endpoint = useMemo(() => RPC_ENDPOINT, []);

    // ── Connection config for stability ──────────────────────────────────
    //    - `confirmed` commitment balances speed vs. reliability.
    //    - Extended timeout prevents premature "transaction not confirmed"
    //      errors during network congestion.
    const connectionConfig = useMemo(
        () => ({
            commitment: "confirmed" as const,
            confirmTransactionInitialTimeout: 120_000, // 120 s
            disableRetryOnRateLimit: false,
        }),
        [],
    );

    // ── Wallet adapters ──────────────────────────────────────────────────
    const wallets = useMemo(() => {
        const adapters = [
            // ────── WalletConnect (universal mobile bridge) ──────
            new WalletConnectWalletAdapter({
                network,
                options: {
                    projectId: WALLETCONNECT_PROJECT_ID,
                    metadata: {
                        name: "Solana Shield AI",
                        description: "#1 protocol for Solana Chain Protection.",
                        url: "https://solanashieldai.org/",
                        icons: [
                            "https://res.cloudinary.com/diwlbun0d/image/upload/v1775743403/331c5039-93f0-4043-ab40-6b10eeb78579-1_nsowsx.png",
                        ],
                    },
                },
            }),
            // ────── Desktop / extension wallets ──────
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter(),
        ];

        return adapters;
    }, [network]);

    // ── Centralised error handler ────────────────────────────────────────
    //    Catches lifecycle errors (connect / disconnect / autoConnect).
    //    On mobile, a failed autoConnect with a stale session can wedge the
    //    adapter into a permanent "connecting" state. We detect this and
    //    force-clear the persisted wallet name so the next attempt starts
    //    fresh instead of silently looping.
    const onError = useCallback(
        (error: WalletError) => {
            // Always log for diagnostics.
            console.error("[WalletProvider] Wallet error:", error.name, error.message);

            // If the connection itself failed, nuke the stored wallet name
            // so autoConnect does not keep retrying a broken session.
            if (
                error.name === "WalletConnectionError" ||
                error.name === "WalletDisconnectedError" ||
                error.name === "WalletNotReadyError" ||
                error.name === "WalletTimeoutError"
            ) {
                try {
                    localStorage.removeItem(WALLET_NAME_STORAGE_KEY);
                    // Also nuke any lingering WC sessions that may be the culprit.
                    purgeStaleWalletConnectSessions();
                } catch {
                    // localStorage unavailable — non-fatal.
                }
            }
        },
        [],
    );

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
            <SolanaWalletProvider
                wallets={wallets}
                autoConnect
                onError={onError}
            >
                <WalletModalProvider>{children}</WalletModalProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;