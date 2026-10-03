'use client';

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface PositionRingProps {
  position: number;
  total?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function PositionRing({
  position,
  total = 50000,
  size = 200,
  strokeWidth = 10,
  className = ''
}: PositionRingProps) {
  // Calculated progress: 0 when in back, approaches 1 as position approaches 1
  const rawProgress = Math.max(0, Math.min(1, 1 - (position - 1) / total));

  // Visual forward-only progress invariant: ensure the ring never retreats visually
  const maxProgressRef = useRef<number>(rawProgress);
  useEffect(() => {
    if (rawProgress > maxProgressRef.current) {
      maxProgressRef.current = rawProgress;
    }
  }, [rawProgress]);

  const visualProgress = Math.max(rawProgress, maxProgressRef.current);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - visualProgress * circumference;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 origin-center"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />

        {/* Dynamic Glowing Progress Arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#positionRingGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />

        <defs>
          <linearGradient id="positionRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center Position Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block">
          QUEUE POSITION
        </span>
        <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
          #{position.toLocaleString()}
        </span>
        <span className="text-[10px] font-mono text-emerald-400 block mt-0.5">
          Top {((position / total) * 100).toFixed(1)}% of entrants
        </span>
      </div>
    </div>
  );
}
