'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Ticket,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sparkles,
  WifiOff,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useDropStream } from '@/hooks/useDropStream';
import { useMeState } from '@/hooks/useMeState';
import { usePow } from '@/hooks/usePow';
import { ConnectionPill } from './ConnectionPill';
import { HeroCard } from './HeroCard';
import { CrowdCanvas } from './CrowdCanvas';
import { FairnessPanel } from './FairnessPanel';

interface WaitingRoomProps {
  mockMode?: boolean;
}

export function WaitingRoom({ mockMode }: WaitingRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMock = mockMode ?? (searchParams?.get('mock') === '1' || process.env.NEXT_PUBLIC_MOCK === '1');

  // Authoritative State Sources
  const { user, tier, isVerified, isLoading: isMeLoading, isTokenExpired } = useMeState();
  const {
    state: dropState,
    position,
    etaSec,
    admitted,
    total,
    connected,
    reconnecting,
    admittedCountdownSec
  } = useDropStream({ mockOverride: isMock });

  // Background Proof-of-Work (Non-blocking spot security)
  const { status: powStatus, progress: powProgress, start: startPow } = usePow('join', {
    autoStart: true,
    mock: isMock
  });

  // Reconnection Toast UX: Track previous connection state
  const prevConnectedRef = useRef(connected);
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    if (!prevConnectedRef.current && connected) {
      setShowReconnectedToast(true);
      const timer = setTimeout(() => setShowReconnectedToast(false), 3500);
      return () => clearTimeout(timer);
    }
    prevConnectedRef.current = connected;
  }, [connected]);

  // Throttled aria-live announcements (at most once every 5 seconds)
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const lastAnnounceTimeRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (position && now - lastAnnounceTimeRef.current > 5000) {
      lastAnnounceTimeRef.current = now;
      setAriaAnnouncement(`Your position in the queue is now number ${position}.`);
    }
  }, [position]);

  // Safe fallback for position
  const activePosition = position ?? 412;

  // Handle Token Expiry
  if (isTokenExpired) {
    return (
      <main className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Session Expired</h1>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Your verification token has expired or is invalid. Please sign in to restore your queue spot.
          </p>
        </div>
        <Link
          href="/register"
          className="inline-flex py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors"
        >
          Return to Sign In
        </Link>
      </main>
    );
  }

  // Loading Skeleton State
  if (isMeLoading && !isMock) {
    return (
      <main className="max-w-5xl mx-auto py-12 px-4 space-y-6 animate-pulse">
        <div className="h-14 rounded-2xl bg-zinc-900/80 border border-white/5" />
        <div className="h-80 rounded-3xl bg-zinc-900/80 border border-white/5" />
        <div className="h-60 rounded-3xl bg-zinc-900/80 border border-white/5" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#120F4A] text-slate-100 flex flex-col justify-between selection:bg-violet-500 selection:text-white">
      {/* Throttled Accessibility Live Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ariaAnnouncement}
      </div>

      {/* RECONNECTED TOAST NOTIFICATION */}
      <AnimatePresence>
        {showReconnectedToast && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-mono shadow-2xl flex items-center gap-2 backdrop-blur-md"
            role="status"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Back online &bull; your place is saved</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl w-full mx-auto py-6 px-4 sm:px-6 space-y-6">
        {/* 1. HEADER STRIP */}
        <header className="rounded-2xl p-4 sm:p-5 bg-zinc-950/70 border border-white/10 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 font-bold">
                  HIGH-DEMAND TICKET SALE
                </span>
                {isMock && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    MOCK STREAM
                  </span>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                FairDrop Arena 2026
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Verified Badge (User's Risk Tier intentionally hidden from public view) */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold"
              title="Verified Human Session (Risk Tier Kept Confidential)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Fan</span>
            </div>

            {/* Connection Status Pill */}
            <ConnectionPill
              connected={connected}
              reconnecting={reconnecting}
            />
          </div>
        </header>

        {/* 2 & 3. MAIN COCKPIT: HERO STATE CARD + CROWD CANVAS + FAIRNESS PANEL */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: HERO STATE CARD + CROWD CANVAS (8 COLS) */}
          <section className="lg:col-span-8 space-y-6">
            <div className={!connected ? 'opacity-70 transition-opacity' : ''}>
              <HeroCard
                state={dropState}
                position={activePosition}
                etaSec={etaSec}
                total={total}
                admittedCountdownSec={admittedCountdownSec}
                isPowRunning={powStatus === 'computing'}
              />
            </div>

            {/* CROWD CANVAS SIGNATURE VISUAL (Scale: 1 dot ≈ total/800) */}
            <CrowdCanvas
              position={activePosition}
              total={total}
              admittedCount={admitted ? 500 : Math.max(0, 500 - activePosition)}
            />
          </section>

          {/* RIGHT: FAIRNESS PANEL (4 COLS on desktop, bottom on mobile) */}
          <aside className="lg:col-span-4">
            <FairnessPanel />
          </aside>
        </main>
      </div>

      {/* FOOTER STRIP */}
      <footer className="max-w-6xl w-full mx-auto py-6 px-4 text-center text-xs text-zinc-500 font-mono border-t border-white/5 mt-8">
        <p>FairDrop &bull; Cryptographically Provable Anti-Bot Ticket Allocation &bull; Zero Advantage for Fast Connections</p>
      </footer>
    </div>
  );
}
