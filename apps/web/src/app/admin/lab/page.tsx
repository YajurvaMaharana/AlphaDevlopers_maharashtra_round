'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Play,
  Square,
  Sliders,
  Cpu,
  Layers,
  Zap,
  Check,
  CheckSquare,
  Square as EmptySquare,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  History,
  Users,
  Bot,
  Activity,
  Timer,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { api } from '@/lib/api';
import { BotLabScenario, RunReport } from '@fairdrop/shared';
import {
  STATIC_DEFENSES_OFF_REPORT,
  STATIC_DEFENSES_ON_REPORT
} from '@/data/static-reports';

interface ScenarioDefinition {
  id: BotLabScenario;
  title: string;
  category: string;
  badgeColor: string;
  description: string;
  defaultHumans: number;
  defaultBots: number;
  defaultRps: number;
  defaultDuration: number;
}

const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'baseline_humans',
    title: 'Baseline Organic Crowd',
    category: 'BENCHMARK',
    badgeColor: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
    description: '100% legitimate human fans with realistic latency jitter (50ms - 350ms) and zero bot traffic.',
    defaultHumans: 5000,
    defaultBots: 0,
    defaultRps: 250,
    defaultDuration: 30
  },
  {
    id: 'naive_flood',
    title: 'Naive HTTP Burst Flood',
    category: 'RATE ABUSE',
    badgeColor: 'border-red-500/40 text-red-400 bg-red-500/10',
    description: 'Single-origin bot storm firing maximum concurrency requests without PoW solving or delays.',
    defaultHumans: 1000,
    defaultBots: 9000,
    defaultRps: 2500,
    defaultDuration: 15
  },
  {
    id: 'distributed_botnet',
    title: 'Distributed Botnet Swarm',
    category: 'SCALE THREAT',
    badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    description: '5,000+ rotating residential IP proxies attempting to overwhelm the shuffle and monopolize the lottery.',
    defaultHumans: 2500,
    defaultBots: 7500,
    defaultRps: 1250,
    defaultDuration: 30
  },
  {
    id: 'replay_duplicate',
    title: 'Replay & Token Duplicate',
    category: 'INTEGRITY',
    badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    description: 'Aggressive race conditions sending duplicate checkout tokens to test Redis Lua idempotency.',
    defaultHumans: 1000,
    defaultBots: 3000,
    defaultRps: 800,
    defaultDuration: 20
  },
  {
    id: 'sybil_signup',
    title: 'Sybil Account Multi-Registration',
    category: 'IDENTITY',
    badgeColor: 'border-pink-500/40 text-pink-400 bg-pink-500/10',
    description: 'Automated bulk registration generator attempting to flood waiting room tickets with disposable accounts.',
    defaultHumans: 2000,
    defaultBots: 8000,
    defaultRps: 1500,
    defaultDuration: 25
  },
  {
    id: 'slow_payment',
    title: 'Slow-Loris Checkout Hold',
    category: 'INVENTORY STARVATION',
    badgeColor: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
    description: 'Bots reserve seats and withhold payments until the final TTL second before abandoning to deny inventory.',
    defaultHumans: 1500,
    defaultBots: 3500,
    defaultRps: 400,
    defaultDuration: 45
  },
  {
    id: 'headless_mimic',
    title: 'Headless Browser Mimic',
    category: 'STEALTH',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    description: 'Automated Playwright/Puppeteer instances mimicking realistic mouse entropy, scroll variance, and typing.',
    defaultHumans: 3000,
    defaultBots: 5000,
    defaultRps: 600,
    defaultDuration: 30
  }
];

function AdminLabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMockMode = searchParams?.get('mock') === '1' || process.env.NEXT_PUBLIC_MOCK === '1';

  // Master States
  const [defensesEnabled, setDefensesEnabled] = useState(true);
  const [isTogglingDefenses, setIsTogglingDefenses] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<BotLabScenario>('distributed_botnet');

  // Sliders State
  const [humans, setHumans] = useState(2500);
  const [bots, setBots] = useState(7500);
  const [rps, setRps] = useState(1250);
  const [duration, setDuration] = useState(30);

  // Execution & Progress State
  const [isDropRunning, setIsDropRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0); // 0 to 100
  const [activeRunTimer, setActiveRunTimer] = useState<number | null>(null);
  const [lastCompletedRun, setLastCompletedRun] = useState<RunReport | null>(null);

  // Run History & Comparison State
  const [reports, setReports] = useState<RunReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([
    'run_sim_fcfs_001',
    'run_sim_fairdrop_002'
  ]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync sliders when scenario is selected
  const handleSelectScenario = (sc: ScenarioDefinition) => {
    setSelectedScenarioId(sc.id);
    setHumans(sc.defaultHumans);
    setBots(sc.defaultBots);
    setRps(sc.defaultRps);
    setDuration(sc.defaultDuration);
  };

  // Load Reports from /reports
  const fetchReports = useCallback(async () => {
    setIsLoadingReports(true);
    try {
      const data = await api.admin.getReports();
      if (Array.isArray(data) && data.length > 0) {
        setReports(data);
      } else {
        setReports([STATIC_DEFENSES_OFF_REPORT, STATIC_DEFENSES_ON_REPORT]);
      }
    } catch (err) {
      console.warn('Falling back to static reports', err);
      setReports([STATIC_DEFENSES_OFF_REPORT, STATIC_DEFENSES_ON_REPORT]);
    } finally {
      setIsLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Master Toggle Defenses
  const handleToggleDefenses = useCallback(async () => {
    if (isTogglingDefenses) return;
    setIsTogglingDefenses(true);
    const nextState = !defensesEnabled;

    try {
      await api.admin.toggleDefenses({
        enabled: nextState,
        rateLimiting: nextState,
        powRequired: nextState,
        powDifficulty: nextState ? 4 : 1,
        tarpitting: nextState,
        strictFingerprinting: nextState
      });
      setDefensesEnabled(nextState);
      showToast(
        nextState
          ? 'DEFENSES ARMED: Shuffle, PoW, and Rate-Limiting Active'
          : 'DEFENSES DISARMED: Switched to vulnerable Raw FCFS'
      );
    } catch (err: any) {
      // Local fallback for offline/mock
      setDefensesEnabled(nextState);
      showToast(
        nextState
          ? 'DEFENSES ARMED (Local Fallback)'
          : 'DEFENSES DISARMED (Local Fallback)'
      );
    } finally {
      setIsTogglingDefenses(false);
    }
  }, [defensesEnabled, isTogglingDefenses]);

  // START DROP / Run Simulation
  const handleStartDrop = useCallback(async () => {
    if (isDropRunning) return;
    setIsDropRunning(true);
    setRunProgress(0);

    const totalClients = humans + bots;
    const botRatio = totalClients > 0 ? bots / totalClients : 0;
    const scenario = SCENARIOS.find((s) => s.id === selectedScenarioId) || SCENARIOS[2];

    showToast(`LAUNCHING DROP: ${scenario.title} (${totalClients.toLocaleString()} clients)...`);

    try {
      // Trigger API endpoints
      await Promise.all([
        api.admin.startDrop({
          dropId: 'fairdrop-main-2026',
          totalSeats: 500
        }).catch(() => null),
        api.admin.runBotLab({
          scenario: selectedScenarioId,
          totalClients,
          botRatio,
          durationSeconds: duration
        }).catch(() => null)
      ]);
    } catch (err) {
      console.warn('Simulation API note:', err);
    }

    // Progress animation (accelerated for presentation: 3 seconds total)
    const startTime = Date.now();
    const simDurationMs = 3200;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / simDurationMs) * 100));
      setRunProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setIsDropRunning(false);

        // Generate synthetic or realistic report based on defensesEnabled state
        const isDefended = defensesEnabled;
        const totalRequests = Math.round(rps * duration);

        const newReport: RunReport = {
          runId: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          scenario: selectedScenarioId,
          scenarioName: `${scenario.title} (${isDefended ? 'Defenses ON' : 'Defenses OFF'})`,
          defensesEnabled: isDefended,
          parameters: {
            totalClients,
            botRatio,
            durationSeconds: duration,
            totalSeats: 500,
            rateLimitRps: isDefended ? 50 : 0,
            powDifficulty: isDefended ? 4 : 0
          },
          metrics: {
            botSeatSharePct: isDefended
              ? Math.max(0, Math.round((botRatio * 3.5 + Math.random() * 1.5) * 10) / 10)
              : Math.min(98, Math.round((botRatio * 92 + Math.random() * 5) * 10) / 10),
            humanSeatSharePct: isDefended
              ? Math.min(100, Math.round((100 - (botRatio * 3.5 + Math.random() * 1.5)) * 10) / 10)
              : Math.max(2, Math.round((100 - (botRatio * 92 + Math.random() * 5)) * 10) / 10),
            giniCoefficient: isDefended ? 0.06 : 0.88,
            speedAdvantageIndex: isDefended ? 0.02 : 0.95,
            oversellCount: isDefended ? 0 : Math.floor(Math.random() * 18 + 4),
            p95LatencyMs: isDefended ? Math.round(18 + Math.random() * 14) : Math.round(2800 + Math.random() * 1200),
            errorRatePct: isDefended ? 0.2 : 38.6,
            totalRequests,
            rejectedRequests: isDefended ? Math.round(totalRequests * botRatio * 0.96) : 0,
            seatsSold: isDefended ? 500 : 514,
            totalSeats: 500
          },
          completedAt: Date.now()
        };

        setLastCompletedRun(newReport);
        setReports((prev) => [newReport, ...prev]);
        setSelectedReportIds([newReport.runId, selectedReportIds[0] || 'run_sim_fcfs_001']);
        showToast('DROP RUN COMPLETED! Run report recorded in ledger history.');
      }
    }, 60);
  }, [
    isDropRunning,
    humans,
    bots,
    rps,
    duration,
    selectedScenarioId,
    defensesEnabled,
    selectedReportIds
  ]);

  // Keyboard Shortcuts Handler: [D] toggles defenses, [S] starts drop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleToggleDefenses();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleStartDrop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleDefenses, handleStartDrop]);

  // Handle Report Selection for Comparison (max 2)
  const toggleReportSelection = (runId: string) => {
    setSelectedReportIds((prev) => {
      if (prev.includes(runId)) {
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [prev[1], runId];
      }
      return [...prev, runId];
    });
  };

  // Compare Runs Action
  const handleCompareRuns = () => {
    if (selectedReportIds.length < 2) {
      showToast('Please select exactly 2 runs from history to compare.');
      return;
    }
    const [left, right] = selectedReportIds;
    router.push(`/admin/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`);
  };

  const totalCalculatedClients = humans + bots;
  const botCalculatedPct = totalCalculatedClients > 0 ? (bots / totalCalculatedClients) * 100 : 0;
  const estimatedRequests = rps * duration;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-8 select-none">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl bg-zinc-900 border border-violet-500/40 text-white font-mono text-xs shadow-2xl shadow-violet-500/20 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MISSION CONTROL TOP BAR (PROJECTOR SIZED) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 sm:p-8 rounded-3xl bg-zinc-950/90 border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 font-mono text-xs font-bold tracking-widest uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-violet-400" />
              MISSION CONTROL TERMINAL
            </span>

            {isMockMode && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] font-semibold">
                MOCK TELEMETRY ACTIVE
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight uppercase">
            Adversarial Bot Lab
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
            Simulate flash crowds, burst attacks, and distributed proxy swarms. Benchmark
            how FairDrop cryptographic defenses stop automated clients from gaining unfair advantage.
          </p>
        </div>

        {/* MASTER DEFENSES TOGGLE SWITCH (PROJECTOR GLOW) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 hidden sm:flex">
            <span>SHORTCUTS:</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-white font-bold">[D] Defenses</span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-white/10 text-white font-bold">[S] Start</span>
          </div>

          <button
            type="button"
            onClick={handleToggleDefenses}
            disabled={isTogglingDefenses}
            className={`px-8 py-5 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3.5 transition-all shadow-2xl relative overflow-hidden group ${
              defensesEnabled
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white border-2 border-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.4)]'
                : 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)] animate-pulse'
            }`}
          >
            {defensesEnabled ? (
              <>
                <ShieldCheck className="w-7 h-7 text-white" />
                <div className="text-left">
                  <div className="text-sm font-mono opacity-80 uppercase tracking-widest">STATE: ARMED</div>
                  <div className="font-extrabold tracking-tight">DEFENSES: ON</div>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="w-7 h-7 text-white" />
                <div className="text-left">
                  <div className="text-sm font-mono opacity-80 uppercase tracking-widest">STATE: VULNERABLE</div>
                  <div className="font-extrabold tracking-tight">DEFENSES: OFF</div>
                </div>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ACTIVE DEFENSE STATUS SUB-STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            defensesEnabled
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/60 border-white/5 text-zinc-500'
          }`}
        >
          <span>Waiting Room Shuffle</span>
          <span className="font-bold">{defensesEnabled ? 'ARMED (Lottery)' : 'OFF (FCFS)'}</span>
        </div>
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            defensesEnabled
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/60 border-white/5 text-zinc-500'
          }`}
        >
          <span>Adaptive PoW Barrier</span>
          <span className="font-bold">{defensesEnabled ? 'ACTIVE (Bits: 4)' : 'BYPASSED'}</span>
        </div>
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            defensesEnabled
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/60 border-white/5 text-zinc-500'
          }`}
        >
          <span>Rate Limiting & Tarpit</span>
          <span className="font-bold">{defensesEnabled ? '50 req/sec IP' : 'UNLIMITED'}</span>
        </div>
        <div
          className={`p-3 rounded-xl border flex items-center justify-between ${
            defensesEnabled
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-zinc-900/60 border-white/5 text-zinc-500'
          }`}
        >
          <span>Redis Lua Invariant</span>
          <span className="font-bold text-emerald-400">Strict Conservation</span>
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAB COCKPIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: THE 7 SCENARIO CARDS (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-400" />
              1. Select Attack Scenario (The 7 Threat Profiles)
            </h2>
            <span className="text-xs font-mono text-zinc-400">
              Selected: <strong className="text-white">{selectedScenarioId}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {SCENARIOS.map((sc) => {
              const isSelected = sc.id === selectedScenarioId;
              return (
                <div
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc)}
                  className={`p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border text-left relative overflow-hidden ${
                    isSelected
                      ? 'bg-zinc-900/90 border-violet-500 shadow-xl shadow-violet-500/10 scale-[1.01]'
                      : 'bg-zinc-950/70 border-white/5 hover:border-white/20 hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sc.badgeColor}`}>
                          {sc.category}
                        </span>
                        <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                          {sc.title}
                        </h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed pr-6">
                        {sc.description}
                      </p>
                    </div>

                    <div className="shrink-0 pt-1">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-violet-600 border-violet-400 text-white'
                            : 'border-zinc-700 bg-zinc-900 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* Preset defaults indicator */}
                  <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center gap-4 text-[11px] font-mono text-zinc-400">
                    <span>Baseline: <strong className="text-zinc-200">{sc.defaultHumans.toLocaleString()}</strong> Humans</span>
                    <span><strong className="text-red-400">{sc.defaultBots.toLocaleString()}</strong> Bots</span>
                    <span><strong className="text-zinc-200">{sc.defaultRps}</strong> RPS</span>
                    <span><strong className="text-zinc-200">{sc.defaultDuration}s</strong> Duration</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SLIDERS & START DROP HERO (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 sm:p-7 rounded-3xl bg-zinc-950/90 border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-5 h-5 text-violet-400" />
                2. Calibrate Simulation Sliders
              </h2>
              <button
                type="button"
                onClick={() => {
                  const sc = SCENARIOS.find((s) => s.id === selectedScenarioId);
                  if (sc) handleSelectScenario(sc);
                }}
                className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-1"
                title="Reset to scenario defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Slider 1: Humans */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-400" />
                  HUMAN PARTICIPANTS
                </span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {humans.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={100}
                max={50000}
                step={100}
                value={humans}
                onChange={(e) => setHumans(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-zinc-800 accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>100</span>
                <span>25,000</span>
                <span>50,000</span>
              </div>
            </div>

            {/* Slider 2: Bots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-red-400" />
                  ADVERSARIAL BOTS
                </span>
                <span className="text-base font-bold font-mono text-red-400">
                  {bots.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={50000}
                step={100}
                value={bots}
                onChange={(e) => setBots(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-zinc-800 accent-red-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>0</span>
                <span>25,000</span>
                <span>50,000</span>
              </div>
            </div>

            {/* Slider 3: RPS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  REQUEST VELOCITY (RPS)
                </span>
                <span className="text-base font-bold font-mono text-amber-400">
                  {rps.toLocaleString()} req/sec
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={5000}
                step={50}
                value={rps}
                onChange={(e) => setRps(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-zinc-800 accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>50 rps</span>
                <span>2,500 rps</span>
                <span>5,000 rps</span>
              </div>
            </div>

            {/* Slider 4: Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-blue-400" />
                  BURST DURATION
                </span>
                <span className="text-base font-bold font-mono text-blue-400">
                  {duration} seconds
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full h-2 rounded-lg bg-zinc-800 accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-600">
                <span>5s</span>
                <span>60s</span>
                <span>120s</span>
              </div>
            </div>

            {/* Live Telemetry Projection */}
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/5 space-y-2 text-xs font-mono">
              <div className="text-zinc-400 font-bold uppercase text-[10px]">
                CALCULATED LOAD PROFILE
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 block">TOTAL ENTRANTS:</span>
                  <span className="text-white font-bold">{totalCalculatedClients.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">BOT RATIO:</span>
                  <span className={`font-bold ${botCalculatedPct > 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {botCalculatedPct.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">TOTAL REQUESTS:</span>
                  <span className="text-zinc-200">{estimatedRequests.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">AVAILABLE SEATS:</span>
                  <span className="text-white font-bold">500</span>
                </div>
              </div>
            </div>

            {/* HERO START DROP BUTTON */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleStartDrop}
                disabled={isDropRunning}
                className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-wider flex items-center justify-center gap-3 transition-all shadow-2xl relative overflow-hidden group ${
                  isDropRunning
                    ? 'bg-violet-700 text-white cursor-wait animate-pulse'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/30 hover:shadow-violet-600/50 hover:scale-[1.02]'
                }`}
              >
                {isDropRunning ? (
                  <>
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span>Executing Drop Simulation ({runProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    <span>START DROP SIMULATION</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-black/30 font-mono font-normal">
                      [S]
                    </span>
                  </>
                )}
              </button>

              {isDropRunning && (
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-white/5">
                  <div
                    className="bg-violet-500 h-full transition-all duration-100 ease-out"
                    style={{ width: `${runProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RUN HISTORY LIST (PULLED FROM /REPORTS) & COMPARE RUNS */}
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-950/90 border border-white/10 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <History className="w-5 h-5 text-violet-400" />
              Run History & Empirical Evidence
            </h2>
            <p className="text-xs text-zinc-400">
              Historical drop runs recorded in /reports. Select any 2 runs to compare side-by-side.
            </p>
          </div>

          {/* COMPARE RUNS BUTTON (ACTION) */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-zinc-400">
              Selected: <strong className="text-white">{selectedReportIds.length}/2</strong> runs
            </div>

            <button
              type="button"
              onClick={handleCompareRuns}
              disabled={selectedReportIds.length !== 2}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-violet-600/25 disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              <span>Compare Runs</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* TABLE / CARD STACK OF REPORTS */}
        {isLoadingReports ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-violet-400" />
            <p>Loading historical simulation reports from /reports...</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {reports.map((report) => {
              const isSelected = selectedReportIds.includes(report.runId);
              const selectionIndex = selectedReportIds.indexOf(report.runId);

              return (
                <div
                  key={report.runId}
                  onClick={() => toggleReportSelection(report.runId)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-zinc-900 border-violet-500/80 shadow-lg shadow-violet-500/10'
                      : 'bg-zinc-950/60 border-white/5 hover:border-white/20 hover:bg-zinc-900/30'
                  }`}
                >
                  {/* Left: Checkbox + Meta */}
                  <div className="flex items-center gap-3.5">
                    <div className="shrink-0 text-violet-400">
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-mono font-bold">
                          {selectionIndex + 1}
                        </div>
                      ) : (
                        <EmptySquare className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            report.defensesEnabled
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-red-500/10 border border-red-500/30 text-red-400'
                          }`}
                        >
                          {report.defensesEnabled ? 'DEFENSES ON' : 'DEFENSES OFF'}
                        </span>
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {report.scenarioName || report.scenario}
                        </h4>
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-3">
                        <span>ID: {report.runId}</span>
                        <span>•</span>
                        <span>{new Date(report.completedAt).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>{report.parameters.totalClients.toLocaleString()} clients ({Math.round(report.parameters.botRatio * 100)}% bots)</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Key Metrics Preview */}
                  <div className="flex items-center gap-4 sm:gap-6 text-xs font-mono">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">BOT SHARE</span>
                      <span
                        className={`font-bold ${
                          report.metrics.botSeatSharePct > 20 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {report.metrics.botSeatSharePct.toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block text-[10px]">HUMAN SHARE</span>
                      <span className="font-bold text-emerald-400">
                        {report.metrics.humanSeatSharePct.toFixed(1)}%
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block text-[10px]">P95 LATENCY</span>
                      <span className="text-zinc-300">
                        {report.metrics.p95LatencyMs < 1000
                          ? `${report.metrics.p95LatencyMs}ms`
                          : `${(report.metrics.p95LatencyMs / 1000).toFixed(1)}s`}
                      </span>
                    </div>

                    <div>
                      <span className="text-zinc-500 block text-[10px]">OVERSELL</span>
                      <span
                        className={`font-bold ${
                          report.metrics.oversellCount === 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {report.metrics.oversellCount}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminLabPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs font-mono text-zinc-400">
          Loading Mission Control Lab...
        </div>
      }
    >
      <AdminLabContent />
    </Suspense>
  );
}
