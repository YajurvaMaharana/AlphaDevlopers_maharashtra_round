'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { NetworkStatus } from '@/hooks/useNetworkStatus';

interface NetworkBannerProps {
  network: NetworkStatus;
  queuePosition?: number | null;
  holdExpiresAt?: number | null;
  onForceReconnect?: () => void;
}

export function NetworkBanner({
  network,
  queuePosition,
  holdExpiresAt,
  onForceReconnect,
}: NetworkBannerProps) {
  const isOffline = !network.isOnline;
  const isReconnecting = network.isOnline && network.isReconnecting;

  if (!isOffline && !isReconnecting) {
    return null;
  }

  const isHoldActive = holdExpiresAt ? holdExpiresAt > Date.now() : false;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed top-0 inset-x-0 z-50 px-4 py-2.5 backdrop-blur-xl border-b shadow-2xl transition-all"
        style={{
          backgroundColor: isOffline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          borderColor: isOffline ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)',
        }}
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            {isOffline ? (
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                <WifiOff className="w-4 h-4 animate-pulse" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              </div>
            )}

            <div>
              <span className="font-semibold text-white">
                {isOffline ? 'You are currently offline' : 'Reconnecting to live queue stream...'}
              </span>
              <span className="text-slate-300 ml-2">
                {isOffline
                  ? 'All changes and cryptographic proofs are preserved locally.'
                  : 'Re-establishing SSE connection with exponential backoff & jitter.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {typeof queuePosition === 'number' && queuePosition > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-white/10 text-slate-300 text-xs font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                <span>Spot #{queuePosition} safe on server</span>
              </div>
            )}

            {isHoldActive && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Hold expires against server clock</span>
              </div>
            )}

            {onForceReconnect && (
              <button
                onClick={onForceReconnect}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/15 transition-colors cursor-pointer"
              >
                Retry Now
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
