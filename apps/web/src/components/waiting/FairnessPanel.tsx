'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Shuffle,
  ZapOff,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface FairnessPanelProps {
  commitmentHash?: string;
  className?: string;
}

export function FairnessPanel({
  commitmentHash = '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
  className = ''
}: FairnessPanelProps) {
  const [copied, setCopied] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const shortCommitment = `${commitmentHash.slice(0, 10)}...${commitmentHash.slice(-6)}`;

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(commitmentHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-3xl bg-zinc-950/80 border border-white/10 shadow-2xl backdrop-blur-xl p-5 sm:p-6 space-y-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Why this is fair
            </h3>
            <span className="text-[10px] font-mono text-zinc-500 block uppercase">
              Zero-Bot Mathematical Guarantee
            </span>
          </div>
        </div>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="sm:hidden p-1.5 rounded-lg bg-zinc-900 border border-white/10 text-zinc-400"
          aria-expanded={isMobileOpen}
          aria-label="Toggle fairness explanations"
        >
          {isMobileOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* 3 Short Core Points (Always visible on desktop, toggleable on mobile) */}
      <div className={`space-y-3.5 ${isMobileOpen ? 'block' : 'hidden sm:block'}`}>
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
            <Shuffle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-200">
              Random Uniform Shuffle
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              Everyone who joins during the open window receives an identical probability of winning a seat via a randomized shuffle.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <ZapOff className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-200">
              No Speed Advantage
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              Speed, automated scripts, and repeated attempts offer zero benefit. A client-side Proof-of-Work barrier equalizes request volume.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-200">
              Cryptographically Verifiable
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
              The entropy seed was committed before the sale. Once revealed, anyone can recompute the draw with WebCrypto.
            </p>
          </div>
        </div>

        {/* Pre-Sale Seed Commitment Hash Box */}
        <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
            <span>PRE-SALE COMMITMENT HASH</span>
            <span>SHA-256</span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-300 tracking-wider truncate">
              {shortCommitment}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors shrink-0"
              title="Copy Commitment Hash"
              aria-label="Copy Commitment Hash"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 leading-relaxed">
            After the draw you can verify it yourself on our{' '}
            <Link
              href="/verify"
              className="text-violet-400 hover:text-violet-300 underline font-medium inline-flex items-center gap-0.5"
            >
              <span>independent audit tool</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
