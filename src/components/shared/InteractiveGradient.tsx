'use client';

import { useEffect, useState } from 'react';

export function InteractiveGradient() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!isClient) {
    return null;
  }

  const { x, y } = mousePosition;
  const { width, height } = windowSize;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-40 blur-[120px] transition-opacity duration-500"
      style={{
        background: `radial-gradient(800px at ${x}px ${y}px, hsl(var(--primary)/0.25), transparent 80%),
                     radial-gradient(800px at ${
                       width - x
                     }px ${height - y}px, hsl(var(--accent)/0.15), transparent 80%)`,
      }}
      aria-hidden="true"
    />
  );
}
