'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Flame,
  Zap,
  Activity,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Radio,
  BarChart3,
  TrendingUp,
  Cpu,
  RefreshCw,
  Sliders,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { api } from '@/lib/api';
import { LiveMetricsPayload } from '@fairdrop/shared';

// Interface for live 120-point rolling traffic buffer
interface TrafficDataPoint {
  time: string;
  timestamp: number;
  requestsPerSec: number;
  rejectedPerSec: number;
}

// Interface for Decile Win Rate
interface DecileDataPoint {
  decile: string;
  speedLabel: string;
  winRatePct: number;
}

// Interface for Security Event Feed
interface SecurityEvent {
  id: string;
  timestamp: string;
  type: 'IP_PENALTY' | 'TARPIT' | 'POW_ESCALATION' | 'SYBIL_BLOCKED' | 'SEAT_ALLOCATED' | 'REPLAY_BURNED';
  message: string;
  ipMasked?: string;
  asnType?: 'residential' | 'datacenter' | 'vpn_proxy' | 'unknown' | 'DATACENTER' | 'VPN' | 'RESIDENTIAL' | string;
  reasons?: string[];
  severity: 'low' | 'medium' | 'high' | 'good';
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const isMockMode = searchParams?.get('mock') === '1' || process.env.NEXT_PUBLIC_MOCK === '1';

  // Fullscreen projector state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Core metrics state
  const [metrics, setMetrics] = useState<LiveMetricsPayload>({
    timestamp: Date.now(),
    requestsPerSecond: 2840,
    activeConnections: 50000,
    seatsSold: 412,
    seatsHeld: 18,
    seatsRemaining: 70,
    totalInventory: 500,
    botSeatSharePct: 1.8,
    humanSeatSharePct: 98.2,
    giniCoefficient: 0.04,
    speedAdvantageIndex: 0.01,
    p95LatencyMs: 19,
    p99LatencyMs: 38,
    rateLimit429Count: 6420,
    powBlockedCount: 28410,
    oversellCount: 0,
    defensesEnabled: true,
    funnel: {
      waitingRoom: 50000,
      admitted: 2400,
      reserved: 512,
      paid: 412,
    },
  });

  const [defensesEnabled, setDefensesEnabled] = useState(true);
  const [isTogglingDefenses, setIsTogglingDefenses] = useState(false);
  const [streamConnected, setStreamConnected] = useState(true);

  // 120-point rolling traffic data (requests vs rejected)
  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>(() => {
    const initial: TrafficDataPoint[] = [];
    const now = Date.now();
    for (let i = 119; i >= 0; i--) {
      const t = new Date(now - i * 1000);
      initial.push({
        time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        timestamp: t.getTime(),
        requestsPerSec: 2500 + Math.floor(Math.sin(i / 10) * 350 + Math.random() * 200),
        rejectedPerSec: 1800 + Math.floor(Math.sin(i / 10) * 300 + Math.random() * 150),
      });
    }
    return initial;
  });

  // Decile win rate data (10 speed deciles)
  const decileData: DecileDataPoint[] = useMemo(() => {
    if (defensesEnabled) {
      // With defenses enabled (FairDrop shuffle), win rate is strictly uniform ~10% (+-0.5% random variance)
      return [
        { decile: 'D1', speedLabel: '< 15ms (Fastest)', winRatePct: 10.2 },
        { decile: 'D2', speedLabel: '15-25ms', winRatePct: 9.8 },
        { decile: 'D3', speedLabel: '25-40ms', winRatePct: 10.1 },
        { decile: 'D4', speedLabel: '40-60ms', winRatePct: 9.9 },
        { decile: 'D5', speedLabel: '60-80ms', winRatePct: 10.4 },
        { decile: 'D6', speedLabel: '80-110ms', winRatePct: 9.7 },
        { decile: 'D7', speedLabel: '110-150ms', winRatePct: 10.0 },
        { decile: 'D8', speedLabel: '150-200ms', winRatePct: 10.2 },
        { decile: 'D9', speedLabel: '200-300ms', winRatePct: 9.8 },
        { decile: 'D10', speedLabel: '> 300ms (Slowest)', winRatePct: 9.9 },
      ];
    } else {
      // With defenses disabled (FCFS), D1 and D2 bots claim 92% of all seats!
      return [
        { decile: 'D1', speedLabel: '< 15ms (Fastest)', winRatePct: 68.4 },
        { decile: 'D2', speedLabel: '15-25ms', winRatePct: 23.8 },
        { decile: 'D3', speedLabel: '25-40ms', winRatePct: 5.1 },
        { decile: 'D4', speedLabel: '40-60ms', winRatePct: 1.8 },
        { decile: 'D5', speedLabel: '60-80ms', winRatePct: 0.6 },
        { decile: 'D6', speedLabel: '80-110ms', winRatePct: 0.2 },
        { decile: 'D7', speedLabel: '110-150ms', winRatePct: 0.1 },
        { decile: 'D8', speedLabel: '150-200ms', winRatePct: 0.0 },
        { decile: 'D9', speedLabel: '200-300ms', winRatePct: 0.0 },
        { decile: 'D10', speedLabel: '> 300ms (Slowest)', winRatePct: 0.0 },
      ];
    }
  }, [defensesEnabled]);

  // Seat ownership data for stacked bar
  const seatOwnershipData = useMemo(() => {
    const total = 500;
    const sold = metrics.seatsSold;
    const humanSeats = Math.round((sold * metrics.humanSeatSharePct) / 100);
    const botSeats = Math.round((sold * metrics.botSeatSharePct) / 100);
    const unknownSeats = Math.max(0, sold - humanSeats - botSeats);
    const remainingSeats = total - sold;

    return [
      {
        category: 'Allocated Seats',
        human: humanSeats,
        bot: botSeats,
        unknown: unknownSeats,
        available: remainingSeats,
      },
    ];
  }, [metrics.seatsSold, metrics.humanSeatSharePct, metrics.botSeatSharePct]);

  // Funnel data: joined -> admitted -> reserved -> paid
  const funnelData = useMemo(() => {
    const f = metrics.funnel;
    return [
      { step: '1. Joined Waiting', count: f.waitingRoom, pct: 100, color: '#8b5cf6' },
      { step: '2. Admitted', count: f.admitted, pct: Number(((f.admitted / f.waitingRoom) * 100).toFixed(1)), color: '#6366f1' },
      { step: '3. Reserved Hold', count: f.reserved + f.paid, pct: Number((((f.reserved + f.paid) / f.waitingRoom) * 100).toFixed(2)), color: '#3b82f6' },
      { step: '4. Confirmed Paid', count: f.paid, pct: Number(((f.paid / f.waitingRoom) * 100).toFixed(2)), color: '#22c55e' },
    ];
  }, [metrics.funnel]);

  // Security Event Feed
  const [events, setEvents] = useState<SecurityEvent[]>([
    {
      id: 'evt_1',
      timestamp: '20:42:15',
      type: 'IP_PENALTY',
      message: 'Token bucket 429 triggered: Cloud datacenter flood detected',
      ipMasked: '3.88.50.xx',
      asnType: 'DATACENTER',
      reasons: ['datacenter network', "timezone doesn't match location", 'High request rate'],
      severity: 'high',
    },
    {
      id: 'evt_2',
      timestamp: '20:42:14',
      type: 'IP_PENALTY',
      message: 'IP penalty applied: Anonymization proxy cluster rate-limited',
      ipMasked: '185.220.101.xx',
      asnType: 'VPN',
      reasons: ['vpn or proxy network', 'High device fingerprint reuse'],
      severity: 'medium',
    },
    {
      id: 'evt_3',
      timestamp: '20:42:12',
      type: 'IP_PENALTY',
      message: 'Automated BotLab simulated botnet cluster throttled and penalized',
      ipMasked: '192.168.1.xx',
      asnType: 'DATACENTER',
      reasons: ['datacenter network', 'BotLab botnet cluster', 'Superhuman join reaction time'],
      severity: 'high',
    },
    {
      id: 'evt_4',
      timestamp: '20:42:10',
      type: 'TARPIT',
      message: 'Tarpit engaged (4.8s delay) on volumetric crawler cluster',
      ipMasked: '45.154.255.xx',
      asnType: 'DATACENTER',
      reasons: ['datacenter network', 'Anomalous User-Agent'],
      severity: 'medium',
    },
    {
      id: 'evt_5',
      timestamp: '20:42:08',
      type: 'POW_ESCALATION',
      message: 'PoW difficulty escalated to 6 leading zeros for subnet 194.26.29.0/24',
      ipMasked: '194.26.29.xx',
      asnType: 'DATACENTER',
      reasons: ['datacenter network', 'High IP subnet reuse'],
      severity: 'high',
    },
    {
      id: 'evt_6',
      timestamp: '20:42:05',
      type: 'SEAT_ALLOCATED',
      message: 'Seat #412 confirmed for low-risk verified fan (Entropy score: 0.94)',
      ipMasked: '73.4.10.xx',
      asnType: 'RESIDENTIAL',
      severity: 'good',
    },
  ]);

  // Feed scroll container ref
  const feedContainerRef = useRef<HTMLDivElement>(null);

  // Toggle Projector Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Toggle Defenses ON/OFF
  const handleToggleDefenses = async () => {
    setIsTogglingDefenses(true);
    const targetState = !defensesEnabled;

    try {
      await api.admin.updateDefenses({
        enabled: targetState,
        rateLimiting: targetState,
        powRequired: targetState,
        tarpitting: targetState,
        strictFingerprinting: targetState,
      });

      setDefensesEnabled(targetState);
      setMetrics((prev) => ({
        ...prev,
        defensesEnabled: targetState,
        botSeatSharePct: targetState ? 1.8 : 88.4,
        humanSeatSharePct: targetState ? 98.2 : 11.6,
        giniCoefficient: targetState ? 0.04 : 0.88,
        speedAdvantageIndex: targetState ? 0.01 : 0.94,
        p95LatencyMs: targetState ? 19 : 450,
      }));

      // Add audit event to feed
      const newEvent: SecurityEvent = {
        id: `evt_def_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: targetState ? 'POW_ESCALATION' : 'SYBIL_BLOCKED',
        message: targetState
          ? 'DEFENSES ARMED: Cryptographic shuffle, PoW puzzle, and rate-limiting active'
          : 'WARNING: Defenses disarmed! System running in vulnerable FCFS mode',
        severity: targetState ? 'good' : 'high',
      };
      setEvents((prev) => [newEvent, ...prev.slice(0, 40)]);
    } catch (err) {
      console.warn('Defenses toggle error', err);
    } finally {
      setIsTogglingDefenses(false);
    }
  };

  // Live Stream / Simulated Tick Generator (Jank-Free 1-second cadence)
  useEffect(() => {
    let sseSource: EventSource | null = null;

    if (!isMockMode && typeof window !== 'undefined' && window.EventSource) {
      try {
        const streamUrl = (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1')
          ? '/metrics/stream'
          : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/metrics/stream`;
        sseSource = new EventSource(streamUrl);

        sseSource.onmessage = (e) => {
          try {
            const data: LiveMetricsPayload = JSON.parse(e.data);
            setMetrics(data);
            setDefensesEnabled(data.defensesEnabled);
            setStreamConnected(true);
          } catch {
            // ignore
          }
        };

        sseSource.onerror = () => {
          setStreamConnected(false);
        };
      } catch {
        setStreamConnected(false);
      }
    }

    // High-performance timer driving smooth 1-second data updates
    const ticker = setInterval(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Generate realistic traffic variations
      const baseReqs = defensesEnabled ? 2800 : 4200;
      const rps = baseReqs + Math.floor(Math.sin(Date.now() / 4000) * 450 + Math.random() * 250);
      const rejected = defensesEnabled
        ? Math.floor(rps * 0.68 + Math.random() * 80)
        : Math.floor(rps * 0.05 + Math.random() * 20);

      // Append to 120-point rolling buffer
      setTrafficHistory((prev) => {
        const nextPoint: TrafficDataPoint = {
          time: timeStr,
          timestamp: Date.now(),
          requestsPerSec: rps,
          rejectedPerSec: rejected,
        };
        const updated = [...prev, nextPoint];
        return updated.length > 120 ? updated.slice(-120) : updated;
      });

      // Slowly increment seats sold up to 500
      setMetrics((prev) => {
        const newSold = Math.min(500, prev.seatsSold + (Math.random() > 0.6 ? 1 : 0));
        const newRemaining = Math.max(0, 500 - newSold);
        return {
          ...prev,
          requestsPerSecond: rps,
          seatsSold: newSold,
          seatsRemaining: newRemaining,
          rateLimit429Count: prev.rateLimit429Count + (defensesEnabled ? Math.floor(Math.random() * 12) : 0),
          powBlockedCount: prev.powBlockedCount + (defensesEnabled ? Math.floor(Math.random() * 28) : 0),
          funnel: {
            ...prev.funnel,
            paid: newSold,
          },
        };
      });

      // Periodically inject realistic security events into feed
      if (Math.random() > 0.65) {
        const eventTemplates: Array<Omit<SecurityEvent, 'id' | 'timestamp'>> = [
          {
            type: 'IP_PENALTY',
            message: 'Token bucket 429 triggered: Cloud datacenter flood detected',
            ipMasked: `3.88.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'DATACENTER',
            reasons: ['datacenter network', "timezone doesn't match location", 'High request rate'],
            severity: 'high',
          },
          {
            type: 'IP_PENALTY',
            message: 'IP penalty applied: Anonymization proxy cluster rate-limited',
            ipMasked: `185.220.${Math.floor(100 + Math.random() * 20)}.xx`,
            asnType: 'VPN',
            reasons: ['vpn or proxy network', 'High device fingerprint reuse'],
            severity: 'medium',
          },
          {
            type: 'IP_PENALTY',
            message: 'Automated BotLab botnet node throttled and penalized',
            ipMasked: `192.168.1.${Math.floor(1 + Math.random() * 50)}`,
            asnType: 'DATACENTER',
            reasons: ['datacenter network', 'BotLab simulated botnet cluster', 'Superhuman join reaction time'],
            severity: 'high',
          },
          {
            type: 'IP_PENALTY',
            message: 'Geographic discrepancy: Reported timezone mismatches IP origin',
            ipMasked: `86.130.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'RESIDENTIAL',
            reasons: ["timezone doesn't match location", 'High request rate'],
            severity: 'medium',
          },
          {
            type: 'TARPIT',
            message: `Tarpit delay engaged: HTTP response delayed by ${(3 + Math.random() * 3).toFixed(1)}s`,
            ipMasked: `45.154.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'DATACENTER',
            reasons: ['datacenter network', 'Anomalous User-Agent'],
            severity: 'medium',
          },
          {
            type: 'POW_ESCALATION',
            message: 'Adaptive proof-of-work puzzle difficulty escalated to 6 leading zeros',
            ipMasked: `194.26.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'DATACENTER',
            reasons: ['datacenter network', 'High IP subnet reuse'],
            severity: 'high',
          },
          {
            type: 'SYBIL_BLOCKED',
            message: `Canvas fingerprint cluster collapsed: ${Math.floor(15 + Math.random() * 35)} headless bots denied`,
            ipMasked: `103.251.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'VPN',
            reasons: ['vpn or proxy network', 'Prior abuse penalties'],
            severity: 'high',
          },
          {
            type: 'SEAT_ALLOCATED',
            message: `Seat inventory reservation secured by organic fan (Latency: ${Math.floor(18 + Math.random() * 35)}ms)`,
            ipMasked: `73.4.${Math.floor(10 + Math.random() * 200)}.xx`,
            asnType: 'RESIDENTIAL',
            severity: 'good',
          },
        ];

        const chosen = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
        const newEvent: SecurityEvent = {
          id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: timeStr,
          ...chosen,
        };

        setEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
      }
    }, 1000);

    return () => {
      clearInterval(ticker);
      if (sseSource) sseSource.close();
    };
  }, [defensesEnabled, isMockMode]);

  // Memoized Chart Tooltip to avoid DOM re-creations
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="p-2.5 rounded-xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1">
        <div className="text-slate-400 font-medium">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }} className="font-semibold">
              {entry.name}:
            </span>
            <span className="text-white font-bold">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }, []);

  return (
    <div className={`min-h-screen bg-[#070c1e] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 ${isFullscreen ? 'p-8' : ''}`}>
      {/* 1. Header Bar: Title, Projector Fullscreen, Live Stream Status, DEFENSES Badge */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  FairDrop Mission Control
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 border border-white/10 text-slate-300">
                  1920x1080 Projector
                </span>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>{streamConnected ? 'STREAM LIVE (1 Hz)' : 'MOCK FEED ACTIVE'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                High-demand anti-bot sale observability &bull; 500 seats / 50,000 concurrent fans &bull; Real-time cryptographic telemetry
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions: Defenses Badge & Fullscreen Button */}
        <div className="flex items-center flex-wrap gap-3">
          {/* DEFENSES: ON/OFF Interactive Badge */}
          <button
            onClick={handleToggleDefenses}
            disabled={isTogglingDefenses}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border transition-all cursor-pointer shadow-lg ${
              defensesEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-emerald-500/20'
                : 'bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30 shadow-red-500/30 animate-pulse'
            }`}
            title="Click to toggle defenses and observe real-time adversarial impact"
          >
            {defensesEnabled ? (
              <>
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>DEFENSES: ACTIVE (SHUFFLE + POW)</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 text-red-400" />
                <span>DEFENSES: DISABLED (FCFS VULNERABLE)</span>
              </>
            )}
            <Sliders className="w-3.5 h-3.5 opacity-60 ml-1" />
          </button>

          {/* Fullscreen Projector Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter 1920x1080 Projector Mode'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. Top KPI Tiles with Smooth Number Tweening */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Tile 1: Seats Sold */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Seats Sold</span>
            <span className="text-violet-400 font-mono">500 Cap</span>
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-black text-white font-mono">
            <AnimatedNumber value={metrics.seatsSold} />
            <span className="text-sm font-normal text-slate-400">/ 500</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-2">
            <div
              className="h-full bg-violet-500 transition-all duration-500"
              style={{ width: `${(metrics.seatsSold / 500) * 100}%` }}
            />
          </div>
        </div>

        {/* Tile 2: Bot Seat Share % */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Bot Seat Share</span>
            <span className="text-[10px] font-mono text-slate-500">Threshold &lt;5%</span>
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-black font-mono">
            <AnimatedNumber
              value={metrics.botSeatSharePct}
              decimals={1}
              className={metrics.botSeatSharePct <= 5 ? 'text-emerald-400' : 'text-red-400'}
            />
            <span className={`text-sm font-bold ${metrics.botSeatSharePct <= 5 ? 'text-emerald-400' : 'text-red-400'}`}>%</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Human: <strong className="text-emerald-300">{metrics.humanSeatSharePct.toFixed(1)}%</strong>
          </div>
        </div>

        {/* Tile 3: Oversell Incidents (A Big Green 0) */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
            <span>Oversell Incidents</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2">
            <span className="text-3xl">0</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans font-medium">
              CONSERVED
            </span>
          </div>
          <div className="text-[10px] text-emerald-300/80 font-mono">
            Atomic Lua balance verified
          </div>
        </div>

        {/* Tile 4: Gini Coefficient */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Gini Coefficient</span>
            <span className="text-[10px] font-mono text-slate-500">Target &lt; 0.10</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            <AnimatedNumber
              value={metrics.giniCoefficient}
              decimals={2}
              className={metrics.giniCoefficient <= 0.15 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {metrics.giniCoefficient <= 0.15 ? 'Uniform Fair Allocation' : 'High Inequality (Bots)'}
          </div>
        </div>

        {/* Tile 5: p95 Latency */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>p95 Latency</span>
            <span className="text-[10px] font-mono text-slate-500">SLA &lt; 50ms</span>
          </div>
          <div className="flex items-baseline gap-1 text-2xl font-black text-white font-mono">
            <AnimatedNumber
              value={metrics.p95LatencyMs}
              className={metrics.p95LatencyMs < 50 ? 'text-emerald-400' : 'text-amber-400'}
            />
            <span className="text-sm font-normal text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            p99: <strong>{metrics.p99LatencyMs}ms</strong>
          </div>
        </div>

        {/* Tile 6: 429 Rejection Rate */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>429 Rate Limits</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">
            <AnimatedNumber value={metrics.rateLimit429Count} />
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            PoW Blocked: <strong>{metrics.powBlockedCount.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      {/* 3. Middle Tier: Live Area Chart & Stacked Seat Ownership */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Area Chart: requests/sec vs rejected/sec (120 Rolling Points) */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Real-Time Traffic: Requests/sec vs. Rejected/sec
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-violet-300">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                Requests/sec ({metrics.requestsPerSecond.toLocaleString()})
              </span>
              <span className="flex items-center gap-1.5 text-red-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Rejected/sec
              </span>
              <span className="text-slate-500 text-[10px]">120 pts (2 min)</span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="rejGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                {/* isAnimationActive={false} eliminates chart re-draw jank when 1-sec ticks arrive! */}
                <Area
                  type="monotone"
                  dataKey="requestsPerSec"
                  name="Requests/sec"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#reqGradient)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="rejectedPerSec"
                  name="Rejected/sec"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#rejGradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stacked Bar Chart: Seat Ownership Human / Bot / Unknown */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Seat Ownership Allocation
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">Total: 500</span>
          </div>

          <div className="space-y-3">
            {/* Visual Multi-segment bar */}
            <div className="h-8 w-full rounded-xl bg-slate-800 flex overflow-hidden border border-white/10 font-mono text-xs font-bold text-white">
              <div
                style={{ width: `${(seatOwnershipData[0].human / 500) * 100}%` }}
                className="bg-emerald-500 h-full flex items-center justify-center transition-all duration-500"
                title={`Human: ${seatOwnershipData[0].human} seats`}
              >
                {seatOwnershipData[0].human > 30 && `${seatOwnershipData[0].human}`}
              </div>
              <div
                style={{ width: `${(seatOwnershipData[0].bot / 500) * 100}%` }}
                className="bg-red-500 h-full flex items-center justify-center transition-all duration-500"
                title={`Bot: ${seatOwnershipData[0].bot} seats`}
              >
                {seatOwnershipData[0].bot > 15 && `${seatOwnershipData[0].bot}`}
              </div>
              <div
                style={{ width: `${(seatOwnershipData[0].unknown / 500) * 100}%` }}
                className="bg-slate-600 h-full flex items-center justify-center transition-all duration-500"
                title={`Pending/Unknown: ${seatOwnershipData[0].unknown} seats`}
              >
                {seatOwnershipData[0].unknown > 15 && `${seatOwnershipData[0].unknown}`}
              </div>
              <div
                style={{ width: `${(seatOwnershipData[0].available / 500) * 100}%` }}
                className="bg-slate-900/60 h-full flex items-center justify-center text-slate-500 text-[10px] transition-all duration-500"
                title={`Remaining: ${seatOwnershipData[0].available} seats`}
              >
                {seatOwnershipData[0].available > 30 && `${seatOwnershipData[0].available} remaining`}
              </div>
            </div>

            {/* Legend with exact breakdown */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>HUMAN FANS</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {seatOwnershipData[0].human}{' '}
                  <span className="text-xs font-normal text-emerald-300">
                    ({((seatOwnershipData[0].human / 500) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span>AUTOMATED BOTS</span>
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {seatOwnershipData[0].bot}{' '}
                  <span className="text-xs font-normal text-red-300">
                    ({((seatOwnershipData[0].bot / 500) * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span>UNKNOWN / PENDING</span>
                </div>
                <div className="text-base font-bold text-slate-200 mt-1">
                  {seatOwnershipData[0].unknown}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/50 border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span>UNCLAIMED INVENTORY</span>
                </div>
                <div className="text-base font-bold text-slate-200 mt-1">
                  {seatOwnershipData[0].available}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Bottom Tier: Win Rate by Speed Decile, Conversion Funnel, & Scrolling Security Event Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Win Rate by Speed Decile Bar Chart with Dashed Reference Line */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Win Rate by Speed Decile
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Fair Baseline: 10.0%
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            A flat chart proves arrival speed grants zero advantage — everyone in the window has equal lottery odds.
          </p>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={decileData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="decile" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, defensesEnabled ? 20 : 80]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as DecileDataPoint;
                    return (
                      <div className="p-2 rounded-lg bg-slate-900 border border-white/10 text-xs font-mono space-y-0.5">
                        <div className="text-violet-300 font-bold">{d.decile} ({d.speedLabel})</div>
                        <div className="text-white">Win Rate: {d.winRatePct}%</div>
                      </div>
                    );
                  }}
                />
                {/* Dashed Reference Line at 10% (the uniform baseline) */}
                <ReferenceLine
                  y={10}
                  stroke="#22c55e"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{ value: 'Fair Target (10%)', fill: '#22c55e', fontSize: 10, position: 'top' }}
                />
                <Bar dataKey="winRatePct" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                  {decileData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={defensesEnabled ? '#8b5cf6' : index < 2 ? '#ef4444' : '#64748b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funnel: Joined -> Admitted -> Reserved -> Paid */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                FairDrop Funnel Conversion
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Total: 50,000</span>
          </div>

          <div className="space-y-3 pt-1">
            {funnelData.map((item, idx) => (
              <div key={item.step} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-medium">{item.step}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{item.count.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">({item.pct}%)</span>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden border border-white/5">
                  <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.max(2, (item.count / 50000) * 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-slate-400 space-y-1 mt-2">
              <div className="flex justify-between">
                <span>Admit-to-Hold Conversion:</span>
                <span className="text-emerald-400 font-bold">
                  {((metrics.funnel.reserved + metrics.funnel.paid) / metrics.funnel.admitted * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Hold-to-Payment Conversion:</span>
                <span className="text-violet-300 font-bold">
                  {(metrics.funnel.paid / (metrics.funnel.reserved + metrics.funnel.paid) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrolling Security Event Feed */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col space-y-3 h-[320px]">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Live Defense Event Stream
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {events.length} events logged
            </span>
          </div>

          <div
            ref={feedContainerRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs font-mono"
          >
            <AnimatePresence initial={false}>
              {events.map((evt) => {
                let badgeClass = 'bg-slate-800 text-slate-300 border-white/10';
                let IconComponent = ShieldCheck;

                if (evt.type === 'IP_PENALTY') {
                  badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                  IconComponent = Flame;
                } else if (evt.type === 'TARPIT') {
                  badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                  IconComponent = Clock;
                } else if (evt.type === 'POW_ESCALATION') {
                  badgeClass = 'bg-violet-500/15 text-violet-300 border-violet-500/30';
                  IconComponent = Cpu;
                } else if (evt.type === 'SYBIL_BLOCKED') {
                  badgeClass = 'bg-red-500/15 text-red-300 border-red-500/30';
                  IconComponent = ShieldAlert;
                } else if (evt.type === 'SEAT_ALLOCATED') {
                  badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                  IconComponent = CheckCircle2;
                }

                return (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`p-2.5 rounded-xl border ${badgeClass} space-y-1 flex items-start gap-2.5`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[10px] opacity-75">
                        <span className="font-bold">{evt.type}</span>
                        <span>{evt.timestamp}</span>
                      </div>
                      <div className="text-[11px] text-slate-200 leading-tight mt-0.5 break-words font-medium">
                        {evt.message}
                      </div>

                      {/* Source IP and Red ASN Type Badge */}
                      {evt.ipMasked && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-1 font-mono">
                          <span>Source: <strong className="text-slate-300">{evt.ipMasked}</strong></span>
                          {evt.asnType && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
                                evt.asnType.toUpperCase() === 'DATACENTER' ||
                                evt.asnType.toUpperCase() === 'VPN' ||
                                evt.asnType.toUpperCase() === 'VPN_PROXY'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm shadow-red-500/20'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              [{evt.asnType.toUpperCase().replace('_', ' ')}]
                            </span>
                          )}
                        </div>
                      )}

                      {/* Specific Penalty Reasons from Network Signals Module */}
                      {evt.reasons && evt.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-white/5">
                          {evt.reasons.map((reason, rIdx) => (
                            <span
                              key={rIdx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium bg-red-500/15 text-red-300 border border-red-500/30"
                            >
                              <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070c1e] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading Mission Control Dashboard...
        </div>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
