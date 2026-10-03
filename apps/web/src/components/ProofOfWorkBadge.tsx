'use client';

import React from 'react';
import { Cpu, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { PoWSolution } from '@fairdrop/shared';
import { PoWSolveProgress } from '../lib/pow-solver';

interface ProofOfWorkBadgeProps {
  solution: PoWSolution | null;
  progress: PoWSolveProgress | null;
  isSolving: boolean;
}

export function ProofOfWorkBadge({
  solution,
  progress,
  isSolving
}: ProofOfWorkBadgeProps) {
  if (!solution && !isSolving) {
    return null;
  }

  return (
    <div className="w-full glass-panel rounded-xl p-4 border border-blue-500/20 bg-blue-950/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
            {solution ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <Cpu className="w-5 h-5 text-blue-400 animate-spin" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-white">
                {solution ? 'FairPlay PoW Shield Verified' : 'Solving Anti-Bot Cryptographic Challenge...'}
              </h4>
              {solution && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" />
                  Bot Advantage Neutralized
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {solution
                ? `Solved in ${solution.durationMs ?? 180}ms using browser SHA-256 target. Bot farms attempting 50,000 requests are throttled.`
                : 'Computing client-side hashcash nonce to equalize network speed differentials.'}
            </p>
          </div>
        </div>

        {/* Live hash stats */}
        <div className="hidden sm:flex flex-col items-end text-xs font-mono">
          <div className="flex items-center gap-1 text-zinc-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {progress ? `${progress.hashRate.toLocaleString()} H/s` : 'Active'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {solution
              ? `Nonce: ${solution.nonce}`
              : `${progress?.hashesComputed.toLocaleString() || 0} nonces`}
          </span>
        </div>
      </div>
    </div>
  );
}
