'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

/**
 * @fileOverview Optimized Interactive Gradient.
 * Uses MotionValues and Springs for GPU-accelerated follow effects.
 * Includes a Visibility Guard to suspend updates when the tab is inactive, saving GPU resources.
 */

export function InteractiveGradient() {
  const [isClient, setIsClient] = useState(false);
  const isVisible = useRef(true);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 120, restDelta: 0.001 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    setIsClient(true);
    
    mouseX.set(window.innerWidth / 2);
    mouseY.set(window.innerHeight / 2);

    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === 'visible';
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isVisible.current) return;
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [mouseX, mouseY]);

  if (!isClient) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-40 blur-[100px]"
      style={{
        background: `radial-gradient(800px at var(--x) var(--y), hsl(var(--primary)/0.25), transparent 80%)`,
        // @ts-ignore
        '--x': smoothX.get() + 'px',
        // @ts-ignore
        '--y': smoothY.get() + 'px',
        willChange: 'background',
        transform: 'translateZ(0)'
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-background via-transparent to-accent/5 opacity-50" />
    </motion.div>
  );
}