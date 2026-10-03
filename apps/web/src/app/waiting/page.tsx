'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Dice5,
  ShieldCheck,
  Cpu,
  Clock,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Zap,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';
import { solvePoW } from '@fairdrop/shared';

export default function WaitingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'INITIAL' | 'SOLVING_POW' | 'WAITING_ROOM' | 'SHUFFLING' | 'QUEUED' | 'ADMITTED'>('INITIAL');
  const [powNonce, setPowNonce] = useState<string | null>(null);
  const [powDuration, setPowDuration] = useState<number | null>(null);
  const [queueRank, setQueueRank] = useState<number>(84);
  const [error, setError] = useState<string | null>(null);

  const handleStartJoin = async () => {
    setError(null);
    setPhase('SOLVING_POW');

    try {
      // 1. Get PoW challenge
      const challenge = await api.auth.createPoWChallenge({
        clientId: 'usr_fan_001',
        action: 'join'
      });

      // 2. Solve PoW using universal WebCrypto
      const startTime = Date.now();
      const solution = await solvePoW(challenge);
      const duration = Date.now() - startTime;
      setPowNonce(solution.nonce);
      setPowDuration(duration);

      // 3. Verify on server
      await api.auth.solvePoW({
        challengeId: challenge.challengeId,
        clientId: 'usr_fan_001',
        nonce: solution.nonce,
        durationMs: duration
      });

      // 4. Enroll in drop
      await api.drop.join({
        dropId: 'fairdrop-main-2026',
        powSolutionToken: solution.nonce,
        idempotencyKey: crypto.randomUUID(),
        fingerprint: `fp-${Math.random().toString(36).slice(2, 10)}`
      });

      setPhase('WAITING_ROOM');
    } catch (err: any) {
      setError(err?.message || 'Failed to complete waiting room entry');
      setPhase('INITIAL');
    }
  };

  const handleSimulateShuffle = () => {
    setPhase('SHUFFLING');
    setTimeout(() => {
      setQueueRank(42);
      setPhase('QUEUED');
    }, 2500);
  };

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
          <Dice5 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Waiting Room & Fair Queue
        </h2>
        <p className="text-xs text-slate-400">
          Step 2: Solve anti-bot challenge and enter the randomized lottery queue.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Waiting Card */}
      <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6">
        {phase === 'INITIAL' && (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 text-left text-xs space-y-2">
              <span className="text-violet-400 font-bold block">Why Waiting Room Lottery?</span>
              <p className="text-slate-400 leading-relaxed">
                When the drop starts, all fans currently in this waiting room receive a <strong className="text-white">uniformly random queue position</strong>. Bot latency gives zero advantage.
              </p>
            </div>

            <button
              onClick={handleStartJoin}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
            >
              Solve PoW Shield & Enter Waiting Room
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === 'SOLVING_POW' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center animate-spin">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">
              Solving Client Proof-of-Work Shield...
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Calculating SHA-256 difficulty target in your browser. This throttles automated bot swarms.
            </p>
          </div>
        )}

        {phase === 'WAITING_ROOM' && (
          <div className="space-y-6">
            <div className="glass-panel-good rounded-2xl p-4 flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-good shrink-0" />
              <div>
                <span className="text-xs font-bold text-good block">
                  PoW Shield Verified ({powDuration}ms)
                </span>
                <span className="text-[11px] text-slate-300">
                  Nonce: <code className="text-slate-100">{powNonce}</code>. You are registered in the waiting room with 49,850 fans.
                </span>
              </div>
            </div>

            <div className="text-center py-4 space-y-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block">
                Next Stage: Uniform Shuffle
              </span>
              <h3 className="text-xl font-bold text-white">
                Waiting Room Open &bull; 500 Seats Available
              </h3>
              <p className="text-xs text-slate-400">
                All participants in this pool have equal chance when the shuffle triggers.
              </p>
            </div>

            <button
              onClick={handleSimulateShuffle}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <Dice5 className="w-4 h-4" />
              Execute Random Fisher-Yates Shuffle
            </button>
          </div>
        )}

        {phase === 'SHUFFLING' && (
          <div className="text-center py-8 space-y-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/40 flex items-center justify-center"
            >
              <Dice5 className="w-7 h-7" />
            </motion.div>
            <h3 className="text-lg font-bold text-white">
              Shuffling 50,000 Queue Positions...
            </h3>
            <p className="text-xs text-violet-300/80">
              Applying deterministic commit-revealed seed algorithm.
            </p>
          </div>
        )}

        {phase === 'QUEUED' && (
          <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 text-center border border-white/10 bg-slate-900/60">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                Your Shuffled Queue Position
              </span>
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-emerald-400 my-2">
                #{queueRank}
              </div>
              <span className="text-xs font-mono text-slate-400">
                out of 50,000 participants &bull; 500 Seats Available
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="glass-panel rounded-xl p-3 border border-white/5 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-violet-400" />
                <div>
                  <span className="text-slate-400 block font-mono text-[10px]">EST. WAIT</span>
                  <span className="font-semibold text-white">~35 seconds</span>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-3 border border-white/5 flex items-center gap-2.5">
                <UserCheck className="w-4 h-4 text-good" />
                <div>
                  <span className="text-slate-400 block font-mono text-[10px]">STATUS</span>
                  <span className="font-semibold text-good">Admitting Soon</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/checkout')}
              className="w-full py-3 rounded-xl bg-good hover:bg-good-glow text-white font-semibold text-xs shadow-lg shadow-good/30 flex items-center justify-center gap-2 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Admission Granted! Proceed to Checkout
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
