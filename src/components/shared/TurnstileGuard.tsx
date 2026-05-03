'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import { ShieldCheck, Lock, Activity, Cpu } from 'lucide-react';

/**
 * @fileOverview Optimized security gateway.
 * Reduced blur radius for faster rendering during the verification challenge.
 */

export function TurnstileGuard({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState(false);
  const [isMounted, setIsClient] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAC0-Ljkw8HTIHNmu';

  useEffect(() => {
    setIsClient(true);
    const verified = sessionStorage.getItem('shield_neural_verified');
    if (verified === 'true') {
      setIsVerified(true);
    }
  }, []);

  const handleTurnstileSuccess = () => {
    setTimeout(() => {
      sessionStorage.setItem('shield_neural_verified', 'true');
      setIsVerified(true);
    }, 1500);
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
            exit={{ 
              opacity: 0, 
              scale: 1.05,
              filter: 'blur(20px)',
              transition: { duration: 0.8, ease: "easeOut" } 
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05040a]"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.15, 1],
                  opacity: [0.1, 0.15, 0.1],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary rounded-full blur-[120px]" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.05, 0.1, 0.05],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-accent rounded-full blur-[100px]" 
              />
            </div>

            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-md p-6"
            >
              <div className="clay-card p-12 glow-border relative overflow-hidden backdrop-blur-[32px]">
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center mb-10">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.35, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 bg-primary rounded-full blur-2xl"
                  />
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-spin-slow" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-card/90 border border-white/10 shadow-2xl primary-glow">
                    <ShieldCheck className="h-10 w-10 text-primary" />
                  </div>
                </div>

                <div className="text-center mb-10">
                  <h1 className="text-2xl font-black font-headline mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
                    Neural Verification
                  </h1>
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                      <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-[10px] font-black text-accent uppercase tracking-widest">System Uplink: Secured</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-[0.25em] leading-relaxed max-w-[240px] mx-auto">
                      Authenticating human <br /> neural signature...
                    </p>
                  </div>
                </div>

                <div className="flex justify-center min-h-[70px] relative group">
                  <div 
                    className="cf-turnstile relative z-10" 
                    data-sitekey={siteKey}
                    data-callback="onTurnstileSuccess"
                    data-theme="dark"
                  ></div>
                </div>

                <div className="mt-12 grid grid-cols-2 gap-4 border-t border-white/10 pt-10">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
                    <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                      <Lock className="h-4 w-4 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Protocol</span>
                      <span className="text-[10px] font-bold text-foreground/80 uppercase">AES-256</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5 shadow-inner">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Neural</span>
                      <span className="text-[10px] font-bold text-foreground/80 uppercase">Active</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <footer className="mt-10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-5 opacity-40">
                  <div className="h-px w-10 bg-white/20" />
                  <span className="text-[9px] text-muted-foreground font-mono tracking-[0.5em] uppercase">Shield AI Guard v2.8.0</span>
                  <div className="h-px w-10 bg-white/20" />
                </div>
                <p className="text-[8px] text-muted-foreground/30 font-mono tracking-[0.2em] uppercase">Optimized for Solana Mainnet-Beta Architecture</p>
              </footer>
            </motion.div>
            
            <Script 
              src="https://challenges.cloudflare.com/turnstile/v0/api.js" 
              strategy="afterInteractive" 
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

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