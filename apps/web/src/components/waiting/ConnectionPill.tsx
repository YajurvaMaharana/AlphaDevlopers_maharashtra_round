'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionPillProps {
  connected: boolean;
  reconnecting: boolean;
  className?: string;
}

export function ConnectionPill({
  connected,
  reconnecting,
  className = ''
}: ConnectionPillProps) {
  if (reconnecting) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium shadow-sm transition-all ${className}`}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span>Reconnecting...</span>
      </div>
    );
  }

  if (connected) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-sm transition-all ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span>Live</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono font-medium shadow-sm transition-all ${className}`}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3.5 h-3.5 text-rose-400" />
      <span>Offline - your place is saved</span>
    </div>
  );
}
