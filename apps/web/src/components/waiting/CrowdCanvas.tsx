'use client';

import React, { useRef, useEffect, useState } from 'react';

interface CrowdCanvasProps {
  position: number;
  total?: number;
  admittedCount?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  rankIndex: number;
}

export function CrowdCanvas({
  position = 412,
  total = 50000,
  admittedCount = 0,
  className = ''
}: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check prefers-reduced-motion on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isTabVisible = document.visibilityState === 'visible';

    // Particle simulation configuration
    const maxDots = 800;
    const dotsCount = Math.min(maxDots, Math.max(100, Math.round(total / 62.5)));
    const userRankIndex = Math.max(0, Math.min(dotsCount - 1, Math.floor((position / total) * dotsCount)));

    // Scale canvas for devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Generate initial particle grid
    const particles: Particle[] = [];
    const cols = Math.floor(Math.sqrt(dotsCount * (width / height)));
    const rows = Math.ceil(dotsCount / cols);
    const cellW = width / cols;
    const cellH = height / rows;

    for (let i = 0; i < dotsCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const targetX = col * cellW + cellW * 0.5 + (Math.random() - 0.5) * (cellW * 0.6);
      const targetY = row * cellH + cellH * 0.5 + (Math.random() - 0.5) * (cellH * 0.6);

      particles.push({
        x: targetX,
        y: targetY,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * 0.2, // Drift forward/upward
        radius: 1.5 + Math.random() * 1.2,
        alpha: 0.3 + Math.random() * 0.4,
        baseAlpha: 0.3 + Math.random() * 0.4,
        rankIndex: i
      });
    }

    // Handle tab visibility to save power & mobile battery
    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Animation Loop
    const render = () => {
      if (isTabVisible) {
        ctx.clearRect(0, 0, width, height);

        // Render queue dots
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          // Drift movement
          p.x += p.vx;
          p.y += p.vy;

          // Wrap edges
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          const isUserDot = i === userRankIndex;
          const isAdmitted = i < userRankIndex && admittedCount > 0;

          if (isUserDot) {
            // Highlighted User Dot with Violet Pulsing Glow
            const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.2;
            const userRadius = 5.5 * pulse;

            // Outer glow ring
            ctx.beginPath();
            ctx.arc(p.x, p.y, userRadius * 2.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
            ctx.fill();

            // Inner core
            ctx.beginPath();
            ctx.arc(p.x, p.y, userRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#a78bfa';
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            // "You" label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('You', p.x, p.y - 14);
          } else if (isAdmitted) {
            // Admitted participants fade out cleanly
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(16, 185, 129, ${p.baseAlpha * 0.35})`;
            ctx.fill();
          } else {
            // Standard crowd particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.4})`;
            ctx.fill();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [position, total, admittedCount, prefersReducedMotion]);

  if (prefersReducedMotion) {
    // Reduced motion accessible fallback: static visual representation
    return (
      <div className={`relative rounded-2xl bg-gradient-to-br from-violet-950/40 via-zinc-950 to-zinc-900 border border-white/10 p-6 flex flex-col items-center justify-center text-center space-y-2 ${className}`}>
        <div className="w-4 h-4 rounded-full bg-violet-400 shadow-[0_0_12px_#8b5cf6]" />
        <span className="text-xs font-mono font-bold text-white">Your Queue Position: #{position}</span>
        <span className="text-[10px] text-zinc-500 font-mono">Animation paused (prefers-reduced-motion active)</span>
      </div>
    );
  }

  return (
    <div className={`relative rounded-3xl bg-zinc-950/70 border border-white/10 overflow-hidden shadow-2xl p-4 ${className}`}>
      {/* Crowd Canvas Overlay Metadata */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full bg-zinc-900/90 border border-white/10 text-[10px] font-mono text-zinc-300">
          Scale: 1 dot ≈ {Math.round(total / 800)} fans
        </span>
        <span className="px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-[10px] font-mono text-violet-300 font-bold">
          Queue: {total.toLocaleString()} entrants
        </span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-48 sm:h-64 block rounded-2xl"
      />
    </div>
  );
}
