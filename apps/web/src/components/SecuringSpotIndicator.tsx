'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Cpu, CheckCircle2, AlertCircle, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { PoWStatus, PoWProgress } from '@/hooks/usePow';
import { PoWSolveResult } from '@/lib/pow-solver';

interface SecuringSpotIndicatorProps {
  status: PoWStatus;
  progress: PoWProgress | null;
  passToken?: string | null;
  solveResult?: PoWSolveResult | null;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Subtle animated "Securing your spot..." indicator using Framer Motion.
 * Displays off-thread hashrate, elapsed time, and difficulty without blocking UI.
 */
export function SecuringSpotIndicator({
  status,
  progress,
  passToken,
  solveResult,
  error,
  onCancel,
  onRetry,
  className = '',
}: SecuringSpotIndicatorProps) {
  if (status === 'idle') return null;

  const isComputing = status === 'computing' || status === 'fetching_challenge' || status === 'verifying';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={`glass-panel p-5 sm:p-6 rounded-3xl border relative overflow-hidden backdrop-blur-xl ${
          isCompleted
            ? 'border-emerald-500/40 bg-emerald-950/15'
            : isError
            ? 'border-red-500/40 bg-red-950/15'
            : 'border-violet-500/30 bg-gradient-to-br from-violet-950/20 via-slate-900/60 to-indigo-950/20'
        } ${className}`}
        role="status"
        aria-live="polite"
      >
        {/* Subtle Background Radial Glow */}
        <div
          className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            isCompleted
              ? 'bg-emerald-500/15'
              : isError
              ? 'bg-red-500/15'
              : 'bg-violet-600/15'
          }`}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left: Animated Icon & Headings */}
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center shrink-0">
              {/* Subtle Concentric Pulsing Ring */}
              {isComputing && (
                <motion.div
                  animate={{
                    scale: [1, 1.35, 1],
                    opacity: [0.6, 0.15, 0.6],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-0 rounded-2xl bg-violet-500/30 -z-10"
                />
              )}

              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-colors shadow-lg ${
                  isCompleted
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20'
                    : isError
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 shadow-red-500/20'
                    : 'bg-violet-600/20 border-violet-500/30 text-violet-300 shadow-violet-500/20'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : isError ? (
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                ) : (
                  <Lock className="w-6 h-6 text-violet-400 animate-pulse" />
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400 font-semibold">
                  Client Proof-of-Work
                </span>
                {status === 'computing' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Web Worker Off-Thread
                  </span>
                )}
              </div>

              <h4 className="text-base font-bold text-white tracking-tight mt-0.5">
                {isCompleted
                  ? 'Spot Verified & Secured!'
                  : isError
                  ? 'Security Verification Paused'
                  : 'Securing your spot...'}
              </h4>

              <p className="text-xs text-slate-400 max-w-md">
                {isCompleted
                  ? 'Pass token issued. You are cryptographically cleared for waiting room enrollment.'
                  : isError
                  ? error || 'An unexpected worker error occurred.'
                  : status === 'fetching_challenge'
                  ? 'Requesting adaptive challenge from server...'
                  : status === 'verifying'
                  ? 'Transmitting preimage solution to server verification pipeline...'
                  : 'Solving SHA-256 partial preimage puzzle using Web Worker...'}
              </p>
            </div>
          </div>

          {/* Right: Actions & Status Tag */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {isComputing && onCancel && (
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Cancel challenge computation"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}

            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-white border border-red-500/40 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Challenge</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Hash Telemetry Strip */}
        {isComputing && progress && (
          <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Hash Rate</span>
              <div className="text-sm font-bold text-violet-300 mt-0.5">
                {progress.hashRate.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">H/s</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Hashes Checked</span>
              <div className="text-sm font-bold text-white mt-0.5">
                {progress.hashes.toLocaleString()}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Time Elapsed</span>
              <div className="text-sm font-bold text-slate-200 mt-0.5">
                {(progress.elapsedMs / 1000).toFixed(2)}s
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Target Difficulty</span>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">
                {progress.difficultyBits} bits (0000...)
              </div>
            </div>
          </div>
        )}

        {/* Completed State Pass Token Display */}
        {isCompleted && (passToken || solveResult) && (
          <div className="mt-4 pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Pass Token:</span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold truncate max-w-xs">
                {passToken}
              </span>
            </div>

            {solveResult && (
              <div className="text-slate-400 text-[11px]">
                Solved in <strong className="text-white">{solveResult.elapsedMs}ms</strong> ({solveResult.totalHashes.toLocaleString()} hashes)
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
