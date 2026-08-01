"use client";

import React, { FC, useMemo, useCallback } from "react";
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    SolflareWalletAdapter,
    TorusWalletAdapter,
    WalletConnectWalletAdapter
} from "@solana/wallet-adapter-wallets";
import { Buffer } from "buffer"; // Essential polyfill for "zero defect" mobile crypto operations

// Ensure Buffer and process are globally available for adapters that require them in mobile/SSR environments.
if (typeof window !== "undefined") {
    if (!window.Buffer) {
        window.Buffer = Buffer;
    }
    if (!(window as any).process) {
        (window as any).process = { env: {} };
    }
}

// Removed react-hot-toast import to ensure zero-dependency build stability

// CRIT-SEC-02 FIX: RPC endpoint and API keys loaded from environment variables.
// Hardcoded Alchemy key was exposed client-side — any actor could extract and
// abuse the RPC allowance (rate limits, billing). Use domain-restricted keys
// for NEXT_PUBLIC_ vars since they're embedded in the client bundle.
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    || process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL
    || "https://api.mainnet-beta.solana.com";

// WalletConnect Project ID from environment — not security-critical but
// best practice to keep configuration out of source code.
const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    || "814452fd12b77a99b5694298acaee9b5"; // Fallback for dev — replace in production

// RPC PROBE POOL — only endpoints expected to respond without 403.
// Public endpoints (mainnet-beta, ankr) now enforce rate-limiting/auth and return
// 403 on probe requests. The browser logs these as "Failed to load resource"
// BEFORE our JavaScript can suppress them — the only fix is to not probe them.
// The primary configured RPC (Alchemy) is the only reliably probe-able endpoint.
const RPC_PROBE_ENDPOINTS = [
    RPC_ENDPOINT,
].filter((url): url is string => typeof url === "string" && url.length > 0);

// Runtime fallback — used as ConnectionProvider endpoint if primary fails during
// actual RPC calls (not during probing). Public mainnet-beta may work for some
// calls even if it 403s on probe-style requests.
const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

// Helper function to probe the latency of a given RPC endpoint.
// 403-FIX: Uses getSlot (universally supported) instead of getHealth (rejected by some providers).
// Explicitly handles 403/405 as dead endpoints without leaking console resource errors.
const probeEndpoint = async (url: string): Promise<number> => {
    const start = performance.now();
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000); // 2-second limit per endpoint
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: "latency-test",
                method: "getSlot" // getSlot is universally supported across all Solana RPC providers
            }),
            signal: controller.signal,
            cache: "no-store", // Prevent Edge/browser from caching a failed probe response
        });
        clearTimeout(id);
        // Explicit auth/method failure check — suppress silently
        if (response.status === 403 || response.status === 405 || response.status === 429) {
            return Infinity;
        }
        if (response.ok) {
            return performance.now() - start; // Return response latency in ms
        }
    } catch (err) {
        clearTimeout(id);
    }
    return Infinity;
};

const WalletContextProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
    const network = WalletAdapterNetwork.Mainnet;

    // Default to the primary Alchemy RPC endpoint, select optimal one dynamically on mount.
    const [endpoint, setEndpoint] = React.useState(RPC_ENDPOINT);

    // Track initial mounting window to suppress disruptive autoConnect console/toast errors.
    const isInitialMountRef = React.useRef(true);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            isInitialMountRef.current = false;
        }, 4000); // 4-second safety window for background auto-connect
        return () => clearTimeout(timer);
    }, []);

    // Perform dynamic RPC probing on client mount to switch to the fastest responsive endpoint.
    React.useEffect(() => {
        let isMounted = true;
        const selectOptimalEndpoint = async () => {
            try {
                const results = await Promise.all(
                    RPC_PROBE_ENDPOINTS.map(async (url) => {
                        const latency = await probeEndpoint(url);
                        return { url, latency };
                    })
                );

                const validEndpoints = results
                    .filter((r) => r.latency !== Infinity)
                    .sort((a, b) => a.latency - b.latency);

                if (validEndpoints.length > 0 && isMounted) {
                    // Redact API key from console output to prevent credential leakage
                    const displayUrl = validEndpoints[0].url.replace(
                        /(v2\/)[^/]+$/,
                        "$1***REDACTED***"
                    );
                    console.log(`[Solana Shield AI] Optimal RPC Selected: ${displayUrl} (latency: ${validEndpoints[0].latency.toFixed(0)}ms)`);
                    setEndpoint(validEndpoints[0].url);
                } else if (isMounted) {
                    // All probed endpoints failed — fall back to public mainnet-beta
                    console.warn("[Solana Shield AI] All probed RPCs failed, falling back to public mainnet-beta");
                    setEndpoint(FALLBACK_RPC);
                }
            } catch (error) {
                console.warn("[Solana Shield AI] Failed to probe RPC endpoints, using primary default:", error);
            }
        };

        selectOptimalEndpoint();
        return () => {
            isMounted = false;
        };
    }, []);

    // Error handling to ensure stability and graceful handling of transient extension errors
    const onError = useCallback((error: WalletError) => {
        const errorMessage = error.message || "";
        const errorName = error.name || "";

        // Check if this is a transient connection failure from extension communication/slumber
        const isTransientError =
            errorMessage.includes("disconnected port object") ||
            errorMessage.includes("Extension context invalidated") ||
            (errorName === "WalletConnectionError" && errorMessage.includes("Unexpected error"));

        // Suppress toasts for transient connection errors during initial mount (auto-connect phase)
        if (isTransientError && isInitialMountRef.current) {
            console.warn("[Solana Shield AI] Suppressed background auto-connect transient error:", errorMessage);
            return;
        }

        // Log detailed error telemetry for debugging and tracking
        console.error("[Solana Shield AI] Wallet Event Failure:", {
            name: error.name,
            message: error.message,
            timestamp: new Date().toISOString(),
            error
        });

        const message = error.message ? error.message : "An unknown wallet error occurred";

        // Defensive UI notification fallback.
        try {
            if (typeof window !== "undefined") {
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
            if (typeof window === "undefined") return [];

            const rawWallets = [
                // WalletConnect is the primary and universal bridge for all mobile wallets.
                new WalletConnectWalletAdapter({
                    network,
                    options: {
                        projectId: WALLETCONNECT_PROJECT_ID,
                        relayUrl: "wss://relay.walletconnect.com",
                        logger: "error",
                        metadata: {
                            name: "Solana Shield AI",
                            description: "#1 protocol for Solana Chain Protection.",
                            url: "https://solanashieldai.org",
                            icons: ["https://res.cloudinary.com/diwlbun0d/image/upload/v1775743403/331c5039-93f0-4043-ab40-6b10eeb78579-1_nsowsx.png"],
                            redirect: {
                                native: "https://solanashieldai.org",
                                universal: "https://solanashieldai.org",
                            },
                        },
                    },
                }),
                // MED-01 FIX: PhantomWalletAdapter removed — Phantom auto-registers via
                // Wallet Standard protocol. Including both causes the console warning:
                // "Phantom was registered as a Standard Wallet. The Wallet Adapter can be removed."
                // Desktop browser extension wallets.
                new SolflareWalletAdapter({ network }),
                new TorusWalletAdapter(),
            ];

            // MED-05 FIX: Retry logic moved to a safe wrapper pattern.
            // The previous approach monkey-patched wallet.connect in-place,
            // which could cause infinite loops if the adapter internally
            // referenced this.connect. The new pattern creates a thin wrapper
            // that calls the original via a saved reference.
            return rawWallets.map((wallet) => {
                const originalConnect = wallet.connect.bind(wallet);

                const retryConnect = async () => {
                    let attempts = 0;
                    const maxAttempts = 3;
                    const delayMs = 600;

                    while (attempts < maxAttempts) {
                        try {
                            attempts++;
                            await originalConnect();
                            return;
                        } catch (error: any) {
                            const errorMessage = error?.message || "";
                            const errorName = error?.name || "";

                            const isTransient =
                                errorMessage.includes("disconnected port object") ||
                                errorMessage.includes("Extension context invalidated") ||
                                (errorName === "WalletConnectionError" && errorMessage.includes("Unexpected error"));

                            if (isTransient && attempts < maxAttempts) {
                                console.warn(
                                    `[Solana Shield AI] Connection attempt ${attempts}/${maxAttempts} ` +
                                    `failed with transient error: "${errorMessage}". Retrying in ${delayMs}ms...`,
                                );
                                await new Promise((resolve) => setTimeout(resolve, delayMs));
                                continue;
                            }
                            throw error;
                        }
                    }
                };

                // Override connect with retry wrapper
                wallet.connect = retryConnect;
                return wallet;
            });
        },
        [network]
    );

    // Prevent rendering on server to ensure hydration consistency.
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
