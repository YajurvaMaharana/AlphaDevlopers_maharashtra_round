'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldCheck, Zap, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';
import { QueueStatus } from '@fairdrop/shared';
import { formatSeconds } from '../lib/utils';

interface QueueProgressCardProps {
  status: QueueStatus;
  onSimulateTurn: () => void;
}

export function QueueProgressCard({ status, onSimulateTurn }: QueueProgressCardProps) {
  const position = status.position ?? 150;
  const total = status.totalInQueue || 50000;
  const progressPercent = Math.min(100, Math.max(5, ((total - position) / total) * 100));

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="glass-panel-glow rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-6 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono mb-2">
              <UserCheck className="w-3 h-3" />
              Live Fair Queue Active
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              You Are in Line
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Positions are verified and locked to your session token.
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-zinc-400 block font-mono">SEATS REMAINING</span>
            <span className="text-2xl font-extrabold text-emerald-400">
              {status.remainingSeats} / 500
            </span>
          </div>
        </div>

        {/* Big Rank Display */}
        <div className="glass-panel rounded-2xl p-6 border border-zinc-700/60 bg-zinc-900/60 text-center relative mb-6">
          <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-widest block mb-1">
            Current Position
          </span>
          <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight my-2">
            #{position.toLocaleString()}
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            out of {total.toLocaleString()} total queue participants
          </span>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-800 rounded-full h-3 mt-6 overflow-hidden p-0.5 border border-white/10">
            <motion.div
              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full"
              initial={{ width: '5%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="glass-panel rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block font-mono">ESTIMATED WAIT</span>
              <span className="text-base font-semibold text-white">
                {status.estimatedWaitSeconds ? formatSeconds(status.estimatedWaitSeconds) : '~1 min 15 sec'}
              </span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/5 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-zinc-400 block font-mono">SESSION INTEGRITY</span>
              <span className="text-base font-semibold text-emerald-400">
                Refresh & Disconnect Proof
              </span>
            </div>
          </div>
        </div>

        {/* Info callout & Fast Forward Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
            <span>If you refresh this browser tab, your exact queue rank is retained.</span>
          </div>

          <button
            onClick={onSimulateTurn}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Fast-Forward to My Turn
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
