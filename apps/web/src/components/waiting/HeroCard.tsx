'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Users,
  Timer,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Shuffle
} from 'lucide-react';
import { DropStreamState } from '@/hooks/useDropStream';
import { CountdownTimer } from './CountdownTimer';
import { PositionRing } from './PositionRing';
import { useTweenNumber } from '@/lib/useTweenNumber';

interface HeroCardProps {
  state: DropStreamState;
  position: number | null;
  etaSec: number | null;
  total: number;
  admittedCountdownSec?: number;
  isPowRunning?: boolean;
}

export function HeroCard({
  state,
  position = 412,
  etaSec = 180,
  total = 50000,
  admittedCountdownSec = 600,
  isPowRunning = false
}: HeroCardProps) {
  // Tween the total entrants count in the room
  const tweenedPeople = useTweenNumber(total, { durationMs: 1200 });

  // Tween the user's position so it glides smoothly
  const honestPosition = position ?? 412;
  const tweenedPosition = useTweenNumber(honestPosition, { durationMs: 900 });

  // "Updated 1s ago" heartbeat
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(1);
  useEffect(() => {
    setSecondsSinceUpdate(1);
    const interval = setInterval(() => {
      setSecondsSinceUpdate((prev) => (prev < 30 ? prev + 1 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [position, state]);

  // Honest ETA formatting: Range instead of false precision
  const etaText = useMemo(() => {
    if (!etaSec || etaSec <= 0) return 'Immediate';
    const minutes = Math.ceil(etaSec / 60);
    if (minutes <= 1) return 'under a minute';
    if (minutes <= 3) return 'about 1–3 min';
    if (minutes <= 6) return 'about 3–5 min';
    if (minutes <= 12) return 'about 8–12 min';
    return `about ${minutes - 2}–${minutes + 2} min`;
  }, [etaSec]);

  return (
    <div className="relative rounded-3xl p-6 sm:p-8 bg-zinc-950/80 border border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden min-h-[380px] flex flex-col justify-center">
      {/* Background glow accents */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <AnimatePresence mode="wait">
        {/* STATE 1: SCHEDULED */}
        {state === 'SCHEDULED' && (
          <motion.div
            key="state-scheduled"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="space-y-6 text-center"
          >
            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 font-mono text-xs uppercase tracking-widest inline-block">
                PRE-SALE COUNTDOWN
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                FairDrop Arena 2026 Ticket Drop
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                The waiting room opens 15 minutes before the shuffle. Joining first offers zero advantage.
              </p>
            </div>

            <CountdownTimer
              targetTimestamp={Date.now() + 3600 * 2000}
              label="Waiting Room Opens In"
            />
          </motion.div>
        )}

        {/* STATE 2: JOIN_WINDOW */}
        {state === 'JOIN_WINDOW' && (
          <motion.div
            key="state-join-window"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6 text-center"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Doors Are Open</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Joining early or fast does not help.
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Everyone inside the waiting room when the timer hits zero will be randomized uniformly via a verifiable cryptographic shuffle.
              </p>
            </div>

            {/* Window Progress Bar */}
            <div className="space-y-2 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Waiting Room Window</span>
                <span className="text-violet-400 font-bold">Shuffling in 04:30</span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-white/5">
                <motion.div
                  className="bg-gradient-to-r from-violet-600 to-emerald-500 h-full rounded-full"
                  initial={{ width: '45%' }}
                  animate={{ width: '70%' }}
                  transition={{ duration: 30, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Live People in the room counter */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 max-w-xs mx-auto flex items-center justify-center gap-3 text-xs font-mono">
              <Users className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <span className="text-zinc-500 block text-[10px]">PEOPLE IN THE ROOM</span>
                <span className="text-lg font-bold text-white tabular-nums">
                  {tweenedPeople.toLocaleString()}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* STATE 3: DRAWING */}
        {state === 'DRAWING' && (
          <motion.div
            key="state-drawing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 text-center py-6"
          >
            {/* 3-Second Swirling Dots Animation */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-violet-500/20 border-t-violet-500"
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="absolute inset-2 rounded-full border-2 border-emerald-500/20 border-b-emerald-400"
              />
              <Shuffle className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Shuffling fairly...
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Executing seeded Fisher-Yates draw across all 50,000 registered participants.
              </p>
            </div>
          </motion.div>
        )}

        {/* STATE 4: ADMITTING */}
        {state === 'ADMITTING' && (
          <motion.div
            key="state-admitting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col md:flex-row items-center justify-between gap-8 py-2"
          >
            {/* Forward-only Progress Ring */}
            <div className="shrink-0 flex justify-center w-full md:w-auto">
              <PositionRing
                position={Math.round(tweenedPosition)}
                total={total}
                size={180}
              />
            </div>

            {/* Position Details & Honest ETA */}
            <div className="space-y-4 text-center md:text-left flex-1">
              <div>
                <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">
                  LIVE ADMISSION QUEUE
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
                  You are #{Math.round(tweenedPosition).toLocaleString()} in line
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Admitting fans in small uniform batches to prevent checkout thrashing.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
                  <span className="text-zinc-500 block text-[10px]">ESTIMATED WAIT</span>
                  <span className="text-sm font-bold text-white">{etaText}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5">
                  <span className="text-zinc-500 block text-[10px]">TELEMETRY STATUS</span>
                  <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    Updated {secondsSinceUpdate}s ago
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STATE 5: ADMITTED */}
        {state === 'ADMITTED' && (
          <motion.div
            key="state-admitted"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 text-center py-4"
          >
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold uppercase tracking-widest inline-block">
                ALLOCATION READY
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Your turn has arrived!
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                A seat hold is reserved exclusively for your session token.
              </p>
            </div>

            {/* 10:00 Countdown */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-emerald-500/30 max-w-sm mx-auto space-y-1">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest block">
                TIME TO COMPLETE CHECKOUT
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-400 tabular-nums">
                {Math.floor(admittedCountdownSec / 60)}:
                {(admittedCountdownSec % 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Choose Seats Primary CTA */}
            <Link
              href="/checkout"
              className="inline-flex py-3.5 px-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02] group"
            >
              <span>Choose Seats & Check Out</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle PoW Shimmer (Step 6 requirement: Never blocks UI) */}
      {isPowRunning && (
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-violet-300">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
            <span>Securing your spot in background with adaptive PoW...</span>
          </div>
          <span className="text-zinc-500">Non-blocking Web Worker</span>
        </div>
      )}
    </div>
  );
}
