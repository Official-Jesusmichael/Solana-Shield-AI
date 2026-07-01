'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import { ShieldCheck, Lock, Activity } from 'lucide-react';

/**
 * @fileOverview Optimized security gateway.
 * Hardware accelerated transitions and light-weight exit animations.
 * Synchronized with /scan Indented Glass architecture and Balanced Solana Neon gradients.
 * Reinstated: Fully functional Turnstile verification protocol.
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
    // Artificial delay for viscous visual transition
    setTimeout(() => {
      sessionStorage.setItem('shield_neural_verified', 'true');
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
            exit={{ 
              opacity: 0, 
              scale: 1.02,
              transition: { duration: 0.5, ease: "easeOut" } 
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05040a]"
            style={{ transform: 'translateZ(0)' }}
          >
            {/* Balanced Solana Neon Aura */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.18, 0.1],
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/40 rounded-full blur-[120px]" 
                style={{ willChange: 'transform' }}
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.05, 0.12, 0.05],
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/4 w-[400px] h-[300px] bg-accent/40 rounded-full blur[100px]" 
                style={{ willChange: 'transform' }}
              />
            </div>

            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative w-full max-w-lg p-6"
            >
              <div className="liquid-glass-pro rim-light-pro p-10 relative overflow-hidden shadow-3xl">
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center mb-8">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.3, 0.15] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/30 rounded-full blur-xl"
                  />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-background/40 border border-white/10 shadow-2xl">
                    <ShieldCheck className="h-8 w-8 text-primary drop-shadow-[0_0_10px_hsla(var(--primary),0.5)]" />
                  </div>
                </div>

                <div className="text-center mb-10">
                  <h1 className="text-xl font-black font-headline mb-4 tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
                    Neural Verification
                  </h1>
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest">System Uplink: Secured</span>
                    </div>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-[0.3em] leading-relaxed max-w-[240px] mx-auto opacity-60">
                      Authenticating human <br /> signature...
                    </p>
                  </div>
                </div>

                <div className="flex justify-center min-h-[70px] relative">
                  <div 
                    className="cf-turnstile relative z-10 scale-90 md:scale-100" 
                    data-sitekey={siteKey}
                    data-callback="onTurnstileSuccess"
                    data-theme="dark"
                  ></div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-4 border-t border-white/5 pt-8">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                      <Lock className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">Protocol</span>
                      <span className="text-[9px] font-bold text-foreground/80 uppercase">AES-256</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">Neural</span>
                      <span className="text-[9px] font-bold text-foreground/80 uppercase">Active</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <footer className="mt-8 flex flex-col items-center gap-2">
                <div className="flex items-center gap-4 opacity-20">
                  <div className="h-px w-8 bg-white/20" />
                  <span className="text-[8px] text-muted-foreground font-mono tracking-[0.4em] uppercase">Shield AI Guard v3.2.0</span>
                  <div className="h-px w-8 bg-white/20" />
                </div>
                <p className="text-[7px] text-muted-foreground/10 font-mono tracking-[0.2em] uppercase">Enterprise Neural Verification Protocol</p>
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
