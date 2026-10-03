'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Users, Lock, Clock, Dice5, ShieldAlert, ArrowRight } from 'lucide-react';
import { EventConfig, DropPhase } from '@fairdrop/shared';
import { formatPrice } from '../lib/utils';
import { ProofOfWorkBadge } from './ProofOfWorkBadge';
import { PoWSolution } from '@fairdrop/shared';
import { PoWSolveProgress } from '../lib/pow-solver';

interface WaitingRoomCardProps {
  config: EventConfig;
  phase: DropPhase;
  hasJoined: boolean;
  isJoining: boolean;
  powSolution: PoWSolution | null;
  powProgress: PoWSolveProgress | null;
  onJoin: () => void;
  onTriggerShuffle: () => void;
}

export function WaitingRoomCard({
  config,
  phase,
  hasJoined,
  isJoining,
  powSolution,
  powProgress,
  onJoin,
  onTriggerShuffle
}: WaitingRoomCardProps) {
  const isShuffle = phase === 'SHUFFLE';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Event Header Banner Card */}
      <div className="glass-panel-glow rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle background glow circle */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono mb-2">
              <Sparkles className="w-3 h-3" />
              Cryptographically Fair Drop
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {config.title}
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-md">
              {config.description}
            </p>
          </div>

          <div className="sm:text-right">
            <span className="text-xs text-zinc-400 block font-mono">TICKET PRICE</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
              {formatPrice(config.priceCents, config.currency)}
            </span>
            <span className="text-xs text-zinc-500 block">500 Seats Available</span>
          </div>
        </div>

        {/* Anti-Bot Fairness Guarantee Box */}
        <div className="glass-panel rounded-xl p-4 border border-zinc-700/60 mb-6 bg-zinc-900/60">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Fairness Architecture vs Scalper Bots
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Speed bots receive <strong className="text-zinc-200">zero advantage</strong>. All fans in the waiting room receive a uniformly distributed lottery rank via randomized shuffle when the sale begins. A client-side SHA-256 Proof of Work equalizes request volume.
              </p>
            </div>
          </div>
        </div>

        {/* Proof of Work Live Badge */}
        <ProofOfWorkBadge
          solution={powSolution}
          progress={powProgress}
          isSolving={isJoining}
        />

        {/* Phase Action Box */}
        {isShuffle ? (
          <div className="mt-6 p-6 rounded-xl bg-purple-950/30 border border-purple-500/30 text-center">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40"
            >
              <Dice5 className="w-6 h-6" />
            </motion.div>
            <h3 className="text-lg font-bold text-white mb-1">
              Executing Fair Random Shuffle
            </h3>
            <p className="text-xs text-purple-200/80 max-w-sm mx-auto">
              Assigning uniformly random queue ranks across 50,000 waiting room participants. Front-running bots have no advantage.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-zinc-400 block font-mono">ESTIMATED CROWD</span>
                <span className="text-sm font-semibold text-zinc-200">
                  ~50,000 Fans Waiting
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {!hasJoined ? (
                <button
                  onClick={onJoin}
                  disabled={isJoining}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isJoining ? (
                    <>
                      <Lock className="w-4 h-4 animate-spin" />
                      Computing PoW Shield...
                    </>
                  ) : (
                    <>
                      Enter Waiting Room
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={onTriggerShuffle}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all"
                >
                  <Dice5 className="w-4 h-4" />
                  Simulate Drop Shuffle Now
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
