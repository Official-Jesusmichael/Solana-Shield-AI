'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * @fileOverview Global Telemetry Manager.
 * Orchestrates real-time tracking of app entries, page visits, and user interactions.
 * Integrates with the Telegram control terminal via the telemetry API.
 */

export function TelemetryManager() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const initialEntry = useRef(true);
  const prevConnected = useRef(false);

  const sendTelemetry = async (message: string, type: string) => {
    try {
      // Fire-and-forget to maintain zero-latency UX
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          type: type.toUpperCase(),
        }),
      });
    } catch (e) {
      // Silent failure to preserve application stability
    }
  };

  // 1. Visit & Entry Tracking
  useEffect(() => {
    const walletInfo = publicKey ? `\n*Wallet:* \`${publicKey.toBase58()}\`` : "";
    if (initialEntry.current) {
      sendTelemetry(`🚀 *Neural Session Initiated*\nPath: \`${pathname}\`${walletInfo}`, 'Entry');
      initialEntry.current = false;
    } else {
      sendTelemetry(`📍 *Navigation Event*\nPath: \`${pathname}\`${walletInfo}`, 'Visit');
    }
  }, [pathname, publicKey]);

  // 2. Wallet State Tracking
  useEffect(() => {
    if (publicKey && !prevConnected.current) {
      sendTelemetry(`🔗 *Neural Handshake Successful*\nADDR: \`${publicKey.toBase58()}\``, 'Auth');
      prevConnected.current = true;
    } else if (!publicKey && prevConnected.current) {
      sendTelemetry(`🔌 *Neural Uplink Detached*`, 'Auth');
      prevConnected.current = false;
    }
  }, [publicKey]);

  // 3. Global Interaction (Click) Tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Filter for meaningful elements to maintain report quality
      const tag = target.tagName;
      const text = (target.innerText || target.getAttribute('aria-label') || target.getAttribute('placeholder') || 'N/A').trim().substring(0, 40);
      const classes = typeof target.className === 'string' ? target.className.split(' ').slice(0, 2).join('.') : '';
      const walletInfo = publicKey ? `\n*Wallet:* \`${publicKey.toBase58()}\`` : "";

      sendTelemetry(
        `🖱️ *Interaction Detected*\nElement: \`${tag}.${classes}\`\nLabel: \`${text}\`${walletInfo}`,
        'Click'
      );
    };

    window.addEventListener('click', handleClick, { passive: true });
    return () => window.removeEventListener('click', handleClick);
  }, [publicKey]);

  return null;
}
