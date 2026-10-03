'use client';

import React, { useRef, useEffect } from 'react';

interface CrowdCanvasProps {
  userPosition: number;
  totalParticipants?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  isUser?: boolean;
}

export function CrowdCanvas({
  userPosition,
  totalParticipants = 50000,
  className = ''
}: CrowdCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Generate crowd particles
    const particleCount = Math.min(220, Math.floor(width * 0.4));
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.3 - Math.random() * 0.55, // drifting upward toward arena gate
        size: Math.random() * 2 + 1.2,
        alpha: Math.random() * 0.5 + 0.25,
        baseAlpha: Math.random() * 0.5 + 0.25
      });
    }

    // User position mapping: lower rank = closer to the front (top)
    // Rank 1 -> y = 25%, Rank 50000 -> y = 85%
    const normalizedRank = Math.max(0, Math.min(1, userPosition / 500));
    const targetUserY = height * 0.25 + normalizedRank * (height * 0.55);
    const targetUserX = width * 0.5;

    let currentUserX = targetUserX;
    let currentUserY = targetUserY;
    let radarPulse = 0;

    const render = () => {
      const currentRect = canvas.getBoundingClientRect();
      const w = currentRect.width;
      const h = currentRect.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw glowing Arena Gate at top center
      const gateGradient = ctx.createRadialGradient(w * 0.5, 0, 10, w * 0.5, 0, 180);
      gateGradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
      gateGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.12)');
      gateGradient.addColorStop(1, 'rgba(7, 12, 30, 0)');
      ctx.fillStyle = gateGradient;
      ctx.fillRect(0, 0, w, 180);

      // Subtle arena portal line
      ctx.beginPath();
      ctx.moveTo(w * 0.2, 40);
      ctx.quadraticCurveTo(w * 0.5, 65, w * 0.8, 40);
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Draw ambient crowd dots
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Wrap around edges to simulate continuous crowd drifting toward admission gate
          if (p.y < 30) {
            p.y = h + Math.random() * 10;
            p.x = Math.random() * w;
          }
          if (p.x < 0) p.x = w;
          if (p.x > w) p.x = 0;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha})`;
        ctx.fill();
      }

      // 3. Smoothly drift User Dot forward
      currentUserY += (targetUserY - currentUserY) * 0.05;
      currentUserX += (targetUserX - currentUserX) * 0.05;

      // Radar ripple rings around user dot
      if (!prefersReducedMotion) {
        radarPulse = (radarPulse + 0.035) % 1;
      }
      const rippleRadius1 = 12 + radarPulse * 24;
      const rippleAlpha1 = (1 - radarPulse) * 0.65;

      ctx.beginPath();
      ctx.arc(currentUserX, currentUserY, rippleRadius1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${rippleAlpha1})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Second ripple
      const radarPulse2 = (radarPulse + 0.5) % 1;
      const rippleRadius2 = 12 + radarPulse2 * 24;
      const rippleAlpha2 = (1 - radarPulse2) * 0.4;
      ctx.beginPath();
      ctx.arc(currentUserX, currentUserY, rippleRadius2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${rippleAlpha2})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // User Glow Circle
      const userGlow = ctx.createRadialGradient(
        currentUserX,
        currentUserY,
        0,
        currentUserX,
        currentUserY,
        18
      );
      userGlow.addColorStop(0, 'rgba(139, 92, 246, 0.9)');
      userGlow.addColorStop(0.5, 'rgba(34, 197, 94, 0.6)');
      userGlow.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = userGlow;
      ctx.beginPath();
      ctx.arc(currentUserX, currentUserY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Core User Dot
      ctx.beginPath();
      ctx.arc(currentUserX, currentUserY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // User Badge Floating Callout: "YOU (#Rank)"
      const tagText = `YOU (#${userPosition})`;
      ctx.font = 'bold 11px monospace';
      const textWidth = ctx.measureText(tagText).width;
      const tagX = currentUserX - textWidth / 2 - 8;
      const tagY = currentUserY - 26;

      ctx.fillStyle = 'rgba(7, 12, 30, 0.92)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, textWidth + 16, 18, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#4ade80';
      ctx.fillText(tagText, tagX + 8, tagY + 13);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [userPosition]);

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-48 sm:h-56 block cursor-crosshair"
        role="img"
        aria-label={`Visual crowd canvas representing 50,000 queue participants with your spot highlighted at position ${userPosition}`}
      />
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-good animate-ping" />
          Drifting toward Gate
        </span>
        <span>
          Live Queue Population: {totalParticipants.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
