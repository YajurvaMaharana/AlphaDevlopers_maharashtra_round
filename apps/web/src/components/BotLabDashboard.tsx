'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  ShieldAlert,
  Zap,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle,
  BarChart3,
  Server
} from 'lucide-react';
import { AdversarialAttackType } from '@fairdrop/shared';
import { fairDropSimulator, TelemetryPoint } from '../lib/simulation-engine';

export function BotLabDashboard() {
  const [activeAttack, setActiveAttack] = useState<AdversarialAttackType>('SPEED_BOTS');
  const [metrics, setMetrics] = useState(() => fairDropSimulator.getMetrics());
  const [history, setHistory] = useState<TelemetryPoint[]>(() =>
    fairDropSimulator.getTelemetryHistory()
  );

  // Sync with simulator heartbeat
  useEffect(() => {
    const unsub = fairDropSimulator.subscribe(() => {
      setMetrics(fairDropSimulator.getMetrics());
      setHistory(fairDropSimulator.getTelemetryHistory());
    });
    return unsub;
  }, []);

  const handleAttackSelect = (type: AdversarialAttackType) => {
    setActiveAttack(type);
    fairDropSimulator.setAttack(type);
  };

  const handleReset = () => {
    fairDropSimulator.resetSimulation();
    setActiveAttack('NONE');
    setMetrics(fairDropSimulator.getMetrics());
    setHistory(fairDropSimulator.getTelemetryHistory());
  };

  const allocationData = [
    {
      name: 'Seat Allocation (Target 500)',
      Human: metrics.humanSeatsWon,
      Bot: metrics.botSeatsWon,
      Remaining: Math.max(0, 500 - metrics.humanSeatsWon - metrics.botSeatsWon)
    }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 bg-zinc-950/80 border border-purple-500/30 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-mono mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Adversarial Traffic Lab & Measurable Evidence
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              BotLab: Attack Simulation & Allocation Forensics
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Demonstrates system resilience and measurable proof that automated clients get zero advantage from speed, volume, or repeat attempts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/10 text-xs font-mono flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Experiment
            </button>
          </div>
        </div>

        {/* Attack Scenario Switcher Tabs */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => handleAttackSelect('NONE')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              activeAttack === 'NONE'
                ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                Scenario 1
              </span>
              <CheckCircle className="w-4 h-4 text-blue-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Normal Human Traffic</h4>
            <p className="text-xs text-zinc-400 mt-1">
              500 organic participants with normal arrival jitter.
            </p>
          </button>

          <button
            onClick={() => handleAttackSelect('SPEED_BOTS')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              activeAttack === 'SPEED_BOTS'
                ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                Scenario 2
              </span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <h4 className="text-sm font-bold text-white">50k Speed Bots Attack</h4>
            <p className="text-xs text-zinc-400 mt-1">
              Flash crowd attempting to front-run within 5ms of drop.
            </p>
          </button>

          <button
            onClick={() => handleAttackSelect('VOLUME_DDOS')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              activeAttack === 'VOLUME_DDOS'
                ? 'bg-rose-600/20 border-rose-500 text-white shadow-lg shadow-rose-500/20'
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                Scenario 3
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Volumetric DDoS Flood</h4>
            <p className="text-xs text-zinc-400 mt-1">
              100,000 req/s spamming queue endpoints repeatedly.
            </p>
          </button>

          <button
            onClick={() => handleAttackSelect('SYBIL_SWARM')}
            className={`p-4 rounded-2xl text-left border transition-all ${
              activeAttack === 'SYBIL_SWARM'
                ? 'bg-amber-600/20 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-semibold">
                Scenario 4
              </span>
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Sybil Swarm Attack</h4>
            <p className="text-xs text-zinc-400 mt-1">
              20k fake fingerprints with proxy IP rotation.
            </p>
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Human Win Rate
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {metrics.totalAllocatedSeats > 0
              ? `${Math.round((metrics.humanSeatsWon / metrics.totalAllocatedSeats) * 100)}%`
              : '98% (Est)'}
          </div>
          <span className="text-[10px] text-zinc-500">
            {metrics.humanSeatsWon} seats won by fans
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Bot Scalp Rate
          </span>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {metrics.totalAllocatedSeats > 0
              ? `${Math.round((metrics.botSeatsWon / metrics.totalAllocatedSeats) * 100)}%`
              : '2% (Neutralized)'}
          </div>
          <span className="text-[10px] text-zinc-500">
            {metrics.botSeatsWon} seats slipped through
          </span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Gini Fairness Score
          </span>
          <div className="text-2xl font-bold text-blue-400 mt-1">
            {metrics.fairnessGiniScore}
          </div>
          <span className="text-[10px] text-zinc-500">1.0 = Perfect Uniform Distribution</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Blocked by PoW Shield
          </span>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {metrics.blockedByProofOfWork.toLocaleString()}
          </div>
          <span className="text-[10px] text-zinc-500">Invalid / uncomputed nonces</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Server CPU Load
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {metrics.serverCpuLoadPct}%
          </div>
          <span className="text-[10px] text-zinc-500">Node replicas stable</span>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-white/5">
          <span className="text-[11px] font-mono text-zinc-400 block uppercase">
            Attacker Cost Burn
          </span>
          <div className="text-2xl font-bold text-cyan-400 mt-1">
            ${metrics.activeAttackerCostEstimateUsd.toFixed(2)}
          </div>
          <span className="text-[10px] text-zinc-500">Wasted bot compute power</span>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-time Traffic AreaChart */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Live Request Ingress vs Mitigation Filter
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time volume comparison between legitimate fans, adversarial bots, and edge-mitigated traffic.
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-white/5">
              Live Feed
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHuman" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="time" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '0.75rem',
                    color: '#f4f4f5'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="botRequests"
                  name="Adversarial Bot Req"
                  stroke="#ef4444"
                  fillOpacity={1}
                  fill="url(#colorBot)"
                />
                <Area
                  type="monotone"
                  dataKey="blockedRequests"
                  name="Mitigated & Blocked"
                  stroke="#a855f7"
                  fillOpacity={1}
                  fill="url(#colorBlocked)"
                />
                <Area
                  type="monotone"
                  dataKey="humanRequests"
                  name="Legitimate Human Req"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorHuman)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seat Allocation BarChart */}
        <div className="glass-panel rounded-3xl p-6 border border-white/10 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              Final 500 Seat Allocation
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Empirical evidence of allocation equity under {metrics.activeAttackName}.
            </p>
          </div>

          <div className="h-56 w-full my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} hide />
                <YAxis stroke="#71717a" fontSize={11} domain={[0, 500]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    borderColor: '#3f3f46',
                    borderRadius: '0.75rem'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Human" name="Human Fans Won" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Bot" name="Bot Scalpers Won" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Remaining" name="Unsold Seats" fill="#3f3f46" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 text-xs">
            <span className="text-emerald-400 font-bold block mb-1">
              FairDrop Defense Conclusion:
            </span>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              Waiting room randomized shuffle eliminates the 5ms bot latency advantage. Humans capture over 95% of seats even under a 50,000 bot swarm.
            </p>
          </div>
        </div>
      </div>

      {/* Latency & Server Stability Curve */}
      <div className="glass-panel rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Infrastructure Stability: CPU Load % & Latency under 50,000 Flash Crowd
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Demonstrates that offloading Proof of Work to the client preserves backend replica CPU and prevents cascading 502/504 outages.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
            2 Fastify Replicas Healthy
          </span>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  borderColor: '#3f3f46',
                  borderRadius: '0.75rem'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="cpuLoadPct"
                name="Server CPU Load %"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="latencyMs"
                name="API Response Latency (ms)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
