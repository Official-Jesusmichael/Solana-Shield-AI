'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

/**
 * @fileOverview Optimized Interactive Gradient.
 * Uses MotionValues and Springs for GPU-accelerated follow effects,
 * eliminating main-thread lag during mouse interaction.
 */

export function InteractiveGradient() {
  const [isClient, setIsClient] = useState(false);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    setIsClient(true);
    
    // Set initial centered position
    mouseX.set(window.innerWidth / 2);
    mouseY.set(window.innerHeight / 2);

    const handleMouseMove = (event: MouseEvent) => {
      // Direct updates to motion values are highly performant
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  if (!isClient) return null;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-40 blur-[100px]"
      style={{
        background: `radial-gradient(800px at var(--x) var(--y), hsl(var(--primary)/0.25), transparent 80%)`,
        // We use CSS variables to bridge motion values to the background gradient
        // @ts-ignore
        '--x': smoothX.get() + 'px',
        // @ts-ignore
        '--y': smoothY.get() + 'px',
      }}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-background via-transparent to-accent/5 opacity-50" />
    </motion.div>
  );
}