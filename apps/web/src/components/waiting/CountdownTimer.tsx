'use client';

import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetTimestamp?: number; // Epoch timestamp for SCHEDULED mode
  secondsRemaining?: number; // Pre-calculated seconds for ADMITTED mode
  compact?: boolean;
  className?: string;
  label?: string;
}

export function CountdownTimer({
  targetTimestamp,
  secondsRemaining: directSeconds,
  compact = false,
  className = '',
  label
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (directSeconds !== undefined) return directSeconds;
    if (targetTimestamp) {
      return Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
    }
    return 3600 * 2 + 14 * 60 + 22; // Default 2h 14m 22s
  });

  useEffect(() => {
    if (directSeconds !== undefined) {
      setSecondsLeft(directSeconds);
      return;
    }

    if (!targetTimestamp) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTimestamp, directSeconds]);

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (compact) {
    return (
      <span className={`font-mono tabular-nums font-bold tracking-tight ${className}`}>
        {pad(minutes)}:{pad(seconds)}
      </span>
    );
  }

  return (
    <div className={`space-y-2 text-center ${className}`}>
      {label && (
        <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-widest block">
          {label}
        </span>
      )}

      <div className="flex items-center justify-center gap-2 sm:gap-3 text-white font-mono tabular-nums">
        {days > 0 && (
          <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 min-w-[64px] sm:min-w-[80px]">
            <span className="text-2xl sm:text-4xl font-extrabold">{pad(days)}</span>
            <span className="text-[10px] text-zinc-500 uppercase mt-1">Days</span>
          </div>
        )}

        <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 min-w-[64px] sm:min-w-[80px]">
          <span className="text-2xl sm:text-4xl font-extrabold">{pad(hours)}</span>
          <span className="text-[10px] text-zinc-500 uppercase mt-1">Hours</span>
        </div>

        <span className="text-xl sm:text-2xl text-zinc-600 font-bold -mt-3">:</span>

        <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 min-w-[64px] sm:min-w-[80px]">
          <span className="text-2xl sm:text-4xl font-extrabold">{pad(minutes)}</span>
          <span className="text-[10px] text-zinc-500 uppercase mt-1">Minutes</span>
        </div>

        <span className="text-xl sm:text-2xl text-zinc-600 font-bold -mt-3">:</span>

        <div className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/90 border border-white/10 min-w-[64px] sm:min-w-[80px]">
          <span className="text-2xl sm:text-4xl font-extrabold text-violet-400">{pad(seconds)}</span>
          <span className="text-[10px] text-zinc-500 uppercase mt-1">Seconds</span>
        </div>
      </div>
    </div>
  );
}
