'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import { ShieldCheck, Lock, Activity } from 'lucide-react';

/**
 * @fileOverview A high-fidelity security gateway using Cloudflare Turnstile.
 * Features immersive animations and brand-aligned aesthetics to protect the application.
 */

export function TurnstileGuard({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(false);
  const [isMounted, setIsClient] = useState(false);

  // Site key placeholder - user should set this in .env
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

  useEffect(() => {
    setIsClient(true);
    // Check session storage to see if verified in this session
    const verified = sessionStorage.getItem('shield_neural_verified');
    if (verified === 'true') {
      setIsVerified(true);
    }
  }, []);

  const handleTurnstileSuccess = () => {
    sessionStorage.setItem('shield_neural_verified', 'true');
    // Add a slight delay for aesthetic "handshake" feeling
    setTimeout(() => {
      setIsVerified(true);
    }, 800);
  };

  useEffect(() => {
    if (isMounted && !isVerified) {
      // @ts-ignore - Turnstile is global
      window.onTurnstileSuccess = handleTurnstileSuccess;
    }
  }, [isMounted, isVerified]);

  if (!isMounted) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {!isVerified ? (
          <motion.div
            key="security-gateway"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
          >
            {/* Immersive Background Auras */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px]" />
              <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px]" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="relative w-full max-w-sm p-8 text-center"
            >
              <div className="clay-card p-8 glow-border relative overflow-hidden">
                {/* AI Pulse Core */}
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                  <ShieldCheck className="relative h-10 w-10 text-primary" />
                </div>

                <h1 className="text-xl font-black font-headline mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
                  Neural Verification
                </h1>
                <p className="text-muted-foreground mb-8 text-[10px] font-medium uppercase tracking-[0.2em] leading-relaxed">
                  Establishing secure uplink to <br /> Solana Shield Network...
                </p>

                {/* Turnstile Widget Container */}
                <div className="flex justify-center min-h-[65px]">
                  <div 
                    className="cf-turnstile" 
                    data-sitekey={siteKey}
                    data-callback="onTurnstileSuccess"
                    data-theme="dark"
                  ></div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-4 border-t border-white/5 pt-6">
                  <div className="flex items-center gap-2">
                    <Lock className="h-3 w-3 text-accent" />
                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">RSA-4096 Secure</span>
                  </div>
                  <div className="h-3 w-px bg-white/10" />
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-primary" />
                    <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">Bot Filter Active</span>
                  </div>
                </div>
              </div>
              
              <footer className="mt-8 text-[8px] text-muted-foreground/30 font-mono tracking-[0.3em] uppercase">
                Shield AI Gateway v2.8.0
              </footer>
            </motion.div>
            
            <Script 
              src="https://challenges.cloudflare.com/turnstile/v0/api.js" 
              strategy="afterInteractive" 
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Actual Application Content */}
      <motion.div
        initial={false}
        animate={{ opacity: isVerified ? 1 : 0 }}
        className={!isVerified ? 'hidden' : 'contents'}
      >
        {children}
      </motion.div>
    </>
  );
}
