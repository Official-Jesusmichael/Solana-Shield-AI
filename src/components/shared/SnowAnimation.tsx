'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * @fileOverview A hyper-realistic, high-performance snow animation component.
 * Features intelligent drift that reacts to mouse movements and varying flake properties
 * for deep immersion.
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let snowflakes: Snowflake[] = [];
    const flakeCount = 120; // Perfect balance for density and performance

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
          radius: Math.random() * 3 + 1,
          speed: Math.random() * 1 + 0.5,
          drift: Math.random() * 1 - 0.5,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();

      // Intelligent drift calculation based on mouse position
      const mouseInfluence = (mouseRef.current.x / window.innerWidth - 0.5) * 2;

      snowflakes.forEach((flake) => {
        ctx.moveTo(flake.x, flake.y);
        ctx.globalAlpha = flake.opacity;
        ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2, true);

        // Update position
        flake.y += flake.speed;
        flake.x += flake.drift + mouseInfluence * 0.8;

        // Loop back to top if out of bounds
        if (flake.y > canvas.height) {
          flake.y = -flake.radius;
          flake.x = Math.random() * canvas.width;
        }
        if (flake.x > canvas.width) {
          flake.x = 0;
        } else if (flake.x < 0) {
          flake.x = canvas.width;
        }
      });

      ctx.fill();
      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    resizeCanvas();
    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (!isClient) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40 h-full w-full opacity-30 mix-blend-screen"
      aria-hidden="true"
    />
  );
}