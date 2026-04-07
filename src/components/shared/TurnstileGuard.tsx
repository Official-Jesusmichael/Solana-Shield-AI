'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import { ShieldCheck, Lock, Activity, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    // Add a slight delay for aesthetic "handshake" feeling
    setTimeout(() => {
      sessionStorage.setItem('shield_neural_verified', 'true');
      setIsVerified(true);
    }, 1200);
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
              scale: 1.1,
              filter: 'blur(20px)',
              transition: { duration: 1, ease: [0.23, 1, 0.32, 1] } 
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#05040a]"
          >
            {/* Immersive Background Auras */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.15, 0.1],
                  x: [0, 20, 0],
                  y: [0, -20, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary rounded-full blur-[180px]" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.05, 0.1, 0.05],
                  x: [0, -30, 0],
                  y: [0, 30, 0]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-accent rounded-full blur-[140px]" 
              />
            </div>

            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-md p-6"
            >
              <div className="clay-card p-10 glow-border relative overflow-hidden backdrop-blur-3xl">
                {/* AI Pulse Core / Neural Link Animation */}
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center mb-8">
                  <motion.div 
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 bg-primary rounded-full blur-2xl"
                  />
                  <div className="absolute inset-0 rounded-full border border-primary/20 animate-spin-slow" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-card/80 border border-white/10 shadow-2xl">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                  </div>
                </div>

                <div className="text-center mb-8">
                  <h1 className="text-2xl font-black font-headline mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 uppercase">
                    Neural Verification
                  </h1>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                      <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest">Protocol: Uplink_Established</span>
                    </div>
                    <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.2em] leading-relaxed">
                      Confirming human neural signature <br /> for secure access...
                    </p>
                  </div>
                </div>

                {/* Turnstile Widget Container */}
                <div className="flex justify-center min-h-[65px] relative group">
                  <div className="absolute -inset-4 bg-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div 
                    className="cf-turnstile relative" 
                    data-sitekey={siteKey}
                    data-callback="onTurnstileSuccess"
                    data-theme="dark"
                  ></div>
                </div>

                {/* Secure Metrics Badges */}
                <div className="mt-10 grid grid-cols-2 gap-3 border-t border-white/5 pt-8">
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 shadow-inner">
                    <div className="h-6 w-6 rounded-lg bg-accent/10 flex items-center justify-center border border-accent/20">
                      <Lock className="h-3 w-3 text-accent" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">Encryption</span>
                      <span className="text-[8px] font-bold text-foreground/80 uppercase">AES-256 GCM</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/5 shadow-inner">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                      <Activity className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[7px] font-black text-muted-foreground/40 uppercase tracking-widest">Bot Filter</span>
                      <span className="text-[8px] font-bold text-foreground/80 uppercase">Active_Core</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <footer className="mt-8 flex flex-col items-center gap-2">
                <div className="flex items-center gap-4 opacity-30">
                  <div className="h-px w-8 bg-white/20" />
                  <span className="text-[8px] text-muted-foreground font-mono tracking-[0.4em] uppercase">Shield AI Gateway v2.8.0</span>
                  <div className="h-px w-8 bg-white/20" />
                </div>
                <p className="text-[7px] text-muted-foreground/20 font-mono tracking-widest uppercase">Optimized for Solana Mainnet-Beta Architecture</p>
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
