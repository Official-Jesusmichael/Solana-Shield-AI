'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * @fileOverview Global Telemetry Manager (Optimized).
 * Throttled interaction tracking to prevent main-thread blockage and redundant network requests.
 */

export function TelemetryManager() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const initialEntry = useRef(true);
  const prevConnected = useRef(false);
  const lastClickTime = useRef(0);

  const sendTelemetry = async (message: string, type: string) => {
    try {
      // Fire-and-forget to maintain zero-latency UX
      // Assign low priority to ensure rendering takes precedence
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          type: type.toUpperCase(),
        }),
        // Signal low priority to browser to keep GPU/rendering thread clear
        priority: 'low'
      } as any);
    } catch (e) {
      // Silent failure to maintain UX integrity
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

  // 3. Optimized Interaction Tracking
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      // Throttling: Ignore clicks that happen within 500ms of each other (prevents multi-click spam)
      if (now - lastClickTime.current < 500) return;
      
      const target = e.target as HTMLElement;
      if (!target) return;

      // Filter for meaningful interactive elements only
      const isInteractive = target.closest('button, a, input, select, [role="button"]');
      if (!isInteractive) return;

      lastClickTime.current = now;

      const tag = target.tagName;
      const text = (target.innerText || target.getAttribute('aria-label') || target.getAttribute('placeholder') || 'N/A').trim().substring(0, 30);
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