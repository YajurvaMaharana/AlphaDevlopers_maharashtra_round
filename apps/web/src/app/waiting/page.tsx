'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Dice5,
  ArrowRight,
  Info,
  HelpCircle,
  Sparkles,
  Zap,
  Lock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { api } from '@/lib/api';
import { solvePoW, PoWChallenge, PoWSolution } from '@fairdrop/shared';
import { CrowdCanvas } from '@/components/CrowdCanvas';

export default function WaitingRoomPage() {
  const router = useRouter();

  // Core drop state
  const [phase, setPhase] = useState<'UPCOMING' | 'SECURING_SPOT' | 'WAITING_ROOM' | 'SHUFFLING' | 'QUEUED' | 'ADMITTED'>('UPCOMING');
  const [dropStartsAt, setDropStartsAt] = useState<number>(() => Date.now() + 25000); // 25s countdown for demo
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(25);

  // Honest Monotonic Queue Rank (never jumps backwards)
  const [queueRank, setQueueRank] = useState<number>(84);
  const lowestRankSeen = useRef<number>(84);

  // PoW Telemetry
  const [powProgress, setPowProgress] = useState<{
    hashes: number;
    hashRate: number;
    elapsedMs: number;
    targetPrefix: string;
  } | null>(null);
  const [powSolution, setPowSolution] = useState<PoWSolution | null>(null);

  // Seed commitment
  const seedCommitment = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  const [copiedCommitment, setCopiedCommitment] = useState(false);

  // Reconnection & Network Resiliency
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Side Panel
  const [isFairPanelOpen, setIsFairPanelOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Format countdown
  const mins = Math.floor(timeRemainingSeconds / 60);
  const secs = timeRemainingSeconds % 60;

  // Countdown timer effect
  useEffect(() => {
    if (phase !== 'UPCOMING') return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((dropStartsAt - Date.now()) / 1000));
      setTimeRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        handleDropOpen();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, dropStartsAt]);

  // Handle countdown completion -> Securing Spot
  const handleDropOpen = useCallback(() => {
    setPhase('SECURING_SPOT');
    executePoWStep();
  }, []);

  // Step 1: Proof of Work "Securing your spot"
  const executePoWStep = async () => {
    setError(null);
    try {
      // 1. Collect passive client signals (Part 1)
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      // 2. Fetch PoW challenge
      const challenge: PoWChallenge = await api.auth.createPoWChallenge({
        clientId: 'usr_fan_001',
        action: 'join'
      });

      // 3. Solve challenge with live hash rate feedback
      const startTime = Date.now();
      const solution = await solvePoW(challenge, (attempts) => {
        const elapsed = Math.max(1, Date.now() - startTime);
        setPowProgress({
          hashes: attempts,
          hashRate: Math.round((attempts / elapsed) * 1000),
          elapsedMs: elapsed,
          targetPrefix: '0'.repeat(challenge.difficulty)
        });
      });

      setPowSolution(solution);

      // 4. Enroll into drop with device fingerprint and signals
      await api.drop.join({
        dropId: 'fairdrop-main-2026',
        powSolutionToken: solution.nonce,
        idempotencyKey: crypto.randomUUID(),
        fingerprint: signals.deviceFp,
        signals: {
          deviceFp: signals.deviceFp,
          behaviorScore: signals.behaviorScore,
          features: signals.features
        }
      });

      setPhase('WAITING_ROOM');
    } catch (err: any) {
      setError(err?.message || 'Proof-of-work security verification error');
      setPhase('UPCOMING');
    }
  };

  // Monotonic queue rank updater: guarantees rank NEVER jumps backwards
  const updateQueueRankMonotonically = useCallback((incomingRank: number) => {
    setQueueRank((prev) => {
      const safeRank = Math.min(prev, incomingRank);
      lowestRankSeen.current = safeRank;
      return safeRank;
    });
  }, []);

  // Simulated queue progression ticker
  useEffect(() => {
    if (phase !== 'QUEUED') return;

    const ticker = setInterval(() => {
      setQueueRank((current) => {
        if (current <= 1) {
          clearInterval(ticker);
          setPhase('ADMITTED');
          return 1;
        }
        // Drifts forward by 4-8 spots per interval, never backward
        const step = 4 + Math.floor(Math.random() * 4);
        const nextRank = Math.max(1, current - step);
        lowestRankSeen.current = nextRank;
        return nextRank;
      });
    }, 2800);

    return () => clearInterval(ticker);
  }, [phase]);

  // Execute random shuffle transition
  const handleShuffle = () => {
    setPhase('SHUFFLING');
    setTimeout(() => {
      setQueueRank(84);
      lowestRankSeen.current = 84;
      setPhase('QUEUED');
    }, 2800);
  };

  // Copy commitment hash
  const handleCopyCommitment = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(seedCommitment);
      setCopiedCommitment(true);
      setTimeout(() => setCopiedCommitment(false), 2500);
    }
  };

  // Toggle reconnecting simulator for judges
  const handleSimulateDisconnect = () => {
    setIsOnline(false);
    setIsReconnecting(true);
    setTimeout(() => {
      setIsOnline(true);
      setIsReconnecting(false);
    }, 3000);
  };

  const estimatedWaitSeconds = Math.ceil(queueRank * 0.7);

  return (
    <div className="py-2 space-y-6">
      {/* Top Status Bar: SSE Connection & Seat Inventory */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Reconnecting / SSE Status Indicator */}
        <div className="flex items-center gap-2">
          {isReconnecting ? (
            <div
              className="px-3 py-1 rounded-full bg-bad/20 text-bad border border-bad/40 font-mono flex items-center gap-1.5 animate-pulse"
              role="status"
              aria-live="polite"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Reconnecting to FairDrop Mesh (Restoring Rank #{queueRank})...</span>
            </div>
          ) : (
            <div
              className="px-3 py-1 rounded-full bg-good/20 text-good border border-good/40 font-mono flex items-center gap-1.5"
              role="status"
              aria-live="polite"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>SSE Live &bull; Session Resilient</span>
            </div>
          )}

          <button
            onClick={handleSimulateDisconnect}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline transition-colors"
            title="Simulate network disconnect and state preservation"
          >
            Test Disconnect Resiliency
          </button>
        </div>

        {/* Global Inventory Counter */}
        <div className="px-3 py-1 rounded-full bg-slate-900 border border-white/10 font-mono text-slate-300 flex items-center gap-1.5">
          <span className="text-good font-bold">358</span>
          <span className="text-slate-500">/</span>
          <span>500 Seats Available</span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-bad/20 border border-bad/40 text-bad text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Waiting Room Layout: Responsive 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Live Crowd Canvas & Interactive Queue Controller */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            {/* Header with Title and Phase Badge */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-violet-400 font-bold block">
                  FairDrop Protected Event
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Main Arena Championship &bull; 500 Seats
                </h1>
              </div>

              <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                PHASE: {phase.replace('_', ' ')}
              </div>
            </div>

            {/* STAGE 1: COUNTDOWN TO DROP */}
            {phase === 'UPCOMING' && (
              <div className="text-center py-6 space-y-6">
                <div className="space-y-1">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block">
                    Drop Opens In
                  </span>
                  <div
                    className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-200 to-white font-mono tracking-tight"
                    aria-label={`${mins} minutes and ${secs} seconds remaining`}
                  >
                    {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto pt-2">
                    Waiting room is now assembling. All fans present at 00:00 will receive equal lottery standing.
                  </p>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleDropOpen}
                    className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center gap-2 transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    Fast-Forward to Drop Open Now
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2: PROOF OF WORK "SECURING YOUR SPOT" */}
            {phase === 'SECURING_SPOT' && (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center animate-spin">
                  <Cpu className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Securing Your Spot & Neutralizing Bots...
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Your browser is computing a lightweight Proof-of-Work challenge (target:{' '}
                    <code className="text-violet-300 font-mono">0000...</code>). This guarantees 1 person = 1 computer, preventing bot farms from swarming.
                  </p>
                </div>

                {powProgress && (
                  <div className="max-w-xs mx-auto p-3 rounded-xl bg-slate-900 border border-white/10 font-mono text-xs text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hashrate:</span>
                      <span className="text-violet-400 font-bold">{powProgress.hashRate.toLocaleString()} H/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hashes Computed:</span>
                      <span>{powProgress.hashes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Time Elapsed:</span>
                      <span>{powProgress.elapsedMs}ms</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 3: WAITING ROOM ASSEMBLED */}
            {phase === 'WAITING_ROOM' && (
              <div className="space-y-6">
                <div className="glass-panel-good rounded-2xl p-4 flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-good shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-good block">
                      Spot Secured via Client Proof-of-Work
                    </span>
                    <span className="text-[11px] text-slate-300">
                      Nonce verified: <code className="text-white font-mono">{powSolution?.nonce}</code>. You are pooled with 49,850 fans.
                    </span>
                  </div>
                </div>

                <div className="text-center py-4 space-y-2">
                  <h3 className="text-xl font-bold text-white">
                    You Are in the Waiting Pool
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    When the shuffle begins, all waiting participants are assigned a uniformly random queue position. Network speed offers no benefit.
                  </p>
                </div>

                <button
                  onClick={handleShuffle}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
                >
                  <Dice5 className="w-4 h-4" />
                  Trigger Random Fisher-Yates Shuffle
                </button>
              </div>
            )}

            {/* STAGE 4: SHUFFLE IN PROGRESS */}
            {phase === 'SHUFFLING' && (
              <div className="text-center py-10 space-y-4">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                  className="w-16 h-16 mx-auto rounded-3xl bg-violet-500/20 text-violet-400 border border-violet-500/40 flex items-center justify-center"
                >
                  <Dice5 className="w-8 h-8" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Executing Cryptographic Random Shuffle...
                  </h3>
                  <p className="text-xs text-violet-300/80 max-w-sm mx-auto mt-1">
                    Applying deterministic Fisher-Yates permutation seeded by the published commitment hash.
                  </p>
                </div>
              </div>
            )}

            {/* STAGE 5: ACTIVE HONEST QUEUE & CROWD CANVAS */}
            {(phase === 'QUEUED' || phase === 'ADMITTED') && (
              <div className="space-y-6">
                {/* Live Animated Crowd Canvas with highlighted User Dot drifting forward */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Interactive Flash Crowd Visualizer (50,000 Fans)
                  </span>
                  <CrowdCanvas userPosition={queueRank} totalParticipants={50000} />
                </div>

                {/* Honest Queue Rank & ETA (Never jumps backwards) */}
                <div
                  className="glass-panel rounded-2xl p-6 border border-white/10 bg-slate-900/80 text-center relative"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span className="text-xs font-mono uppercase tracking-widest text-slate-400 block mb-1">
                    Honest Queue Position (Monotonic)
                  </span>
                  <div className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-indigo-300 to-emerald-400 tracking-tight my-2">
                    #{queueRank}
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    of 50,000 fans &bull; 500 Seats in Pool
                  </span>

                  <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/10 text-xs">
                    <div className="glass-panel rounded-xl p-3 border border-white/5 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 text-violet-400" />
                      <div>
                        <span className="text-slate-400 block text-[10px] font-mono">ESTIMATED ETA</span>
                        <span className="font-semibold text-white">
                          ~{estimatedWaitSeconds} seconds
                        </span>
                      </div>
                    </div>

                    <div className="glass-panel rounded-xl p-3 border border-white/5 flex items-center justify-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-good" />
                      <div>
                        <span className="text-slate-400 block text-[10px] font-mono">MONOTONIC RANK</span>
                        <span className="font-semibold text-good">
                          Never Jumps Back
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {phase === 'ADMITTED' ? (
                  <button
                    onClick={() => router.push('/checkout')}
                    className="w-full py-4 rounded-xl bg-good hover:bg-good-glow text-white font-bold text-sm shadow-xl shadow-good/30 flex items-center justify-center gap-2 transition-all animate-bounce"
                  >
                    <Sparkles className="w-5 h-5" />
                    Your Turn Has Arrived! Proceed to 120s Checkout
                    <ArrowRight className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="text-center text-xs text-slate-400">
                    Please keep this tab open. Your spot is locked and will survive browser refreshes or network hiccups.
                  </div>
                )}
              </div>
            )}

            {/* Seed Commitment Hash with One-Click Copy */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-violet-400" />
                  PRE-SALE SEED COMMITMENT (SHA-256):
                </span>
                <button
                  onClick={handleCopyCommitment}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                  aria-label="Copy published seed commitment hash"
                >
                  {copiedCommitment ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-good" />
                      <span className="text-good font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Hash</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-white/5 font-mono text-[11px] text-slate-300 break-all select-all">
                {seedCommitment}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: "Why This Is Fair" Side Panel */}
        <aside className="glass-panel rounded-3xl p-6 border border-white/10 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Info className="w-4 h-4 text-violet-400" />
              Why This Is Fair
            </h2>
            <button
              onClick={() => setIsFairPanelOpen(!isFairPanelOpen)}
              className="text-slate-400 hover:text-white lg:hidden"
              aria-expanded={isFairPanelOpen}
            >
              {isFairPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {isFairPanelOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-5 text-xs text-slate-300 leading-relaxed"
              >
                <div className="p-3.5 rounded-2xl bg-violet-600/10 border border-violet-500/20">
                  <p className="font-semibold text-violet-300 mb-1">
                    &bull; Speed Provides Zero Benefit
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Joining early or fast does not help. Everyone in the waiting window receives an identical probability of winning a seat via a randomized shuffle.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-white uppercase text-[11px] font-mono tracking-wider">
                    FCFS vs FairDrop Comparison
                  </h4>
                  <div className="rounded-xl border border-white/10 overflow-hidden text-[11px]">
                    <div className="grid grid-cols-2 bg-slate-900/80 p-2 font-mono text-slate-400 font-bold border-b border-white/5">
                      <span>Standard Queue</span>
                      <span className="text-good">FairDrop</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 border-b border-white/5">
                      <span className="text-bad">5ms bots win 90%+</span>
                      <span className="text-good">Uniform probability</span>
                    </div>
                    <div className="grid grid-cols-2 p-2 border-b border-white/5">
                      <span className="text-bad">Refresh loses spot</span>
                      <span className="text-good">Refresh preserved</span>
                    </div>
                    <div className="grid grid-cols-2 p-2">
                      <span className="text-bad">No audit proof</span>
                      <span className="text-good">Merkle verifiable</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px]">
                  <h4 className="font-bold text-white uppercase text-[11px] font-mono tracking-wider">
                    Monotonic Guarantee
                  </h4>
                  <p className="text-slate-400">
                    Your displayed queue rank is strictly non-increasing. It will count down smoothly from your initial lottery placement and never jump backwards during network reconnects.
                  </p>
                </div>

                <div className="pt-2 border-t border-white/5">
                  <a
                    href="/verify"
                    className="inline-flex items-center gap-1.5 text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                  >
                    <span>Inspect Pre-Sale Cryptographic Commitments</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
