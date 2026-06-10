'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * @fileOverview Optimized Snow Animation.
 * Implements visibility-based suspension to prevent background GPU usage when tab is hidden.
 */

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  opacity: number;
}

export function SnowAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isVisible = useRef(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let snowflakes: Snowflake[] = [];
    const flakeCount = 100; // Optimized for performance

    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === 'visible';
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initSnowflakes();
    };

    const initSnowflakes = () => {
      snowflakes = [];
      for (let i = 0; i < flakeCount; i++) {
        snowflakes.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: Math.random() * 2.5 + 0.5,
          speed: Math.random() * 0.8 + 0.2,
          drift: Math.random() * 0.6 - 0.3,
          opacity: Math.random() * 0.4 + 0.1,
        });
      }
    };

    const draw = () => {
      if (!isVisible.current) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouseInfluence = (mouseRef.current.x / window.innerWidth - 0.5) * 1.5;

      snowflakes.forEach((flake) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        ctx.fill();

        flake.y += flake.speed;
        flake.x += flake.drift + mouseInfluence;

        if (flake.y > canvas.height) {
          flake.y = -flake.radius;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width) flake.x = 0;
        else if (flake.x < 0) flake.x = canvas.width;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    resizeCanvas();
    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!isClient) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40 h-full w-full opacity-20 mix-blend-screen"
      style={{ transform: 'translateZ(0)' }}
      aria-hidden="true"
    />
  );
}