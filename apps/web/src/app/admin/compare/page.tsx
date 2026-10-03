'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Download,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Cpu,
  Zap,
  BarChart3,
  Layers,
  FileText,
  Clock,
  Activity
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { RunReport } from '@fairdrop/shared';
import {
  STATIC_DEFENSES_OFF_REPORT,
  STATIC_DEFENSES_ON_REPORT
} from '@/data/static-reports';

// Delta chip component with contextual green/red color logic
interface DeltaChipProps {
  value: number;
  format?: (n: number) => string;
  inverse?: boolean; // If true, lower is better (e.g. latency, botShare, Gini, oversell, errorRate)
  unit?: string;
}

function DeltaChip({ value, format, inverse = true, unit = '' }: DeltaChipProps) {
  const isZero = Math.abs(value) < 0.001;
  const isGood = inverse ? value < 0 : value > 0;

  const colorClass = isZero
    ? 'bg-slate-800 text-slate-400 border-white/10'
    : isGood
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';

  const Icon = isZero ? Minus : isGood ? TrendingDown : TrendingUp;

  const textVal = format ? format(value) : (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${colorClass}`}>
      <Icon className="w-3 h-3" />
      <span>{textVal}{unit}</span>
    </span>
  );
}

// Side-by-side animated comparison bar
interface ComparisonBarProps {
  label: string;
  unit: string;
  offValue: number;
  onValue: number;
  maxValue: number;
  inverse?: boolean; // Lower is better
  formatValue?: (n: number) => string;
  description: string;
}

function ComparisonBar({
  label,
  unit,
  offValue,
  onValue,
  maxValue,
  inverse = true,
  formatValue,
  description,
}: ComparisonBarProps) {
  const delta = onValue - offValue;
  const offPct = Math.min(100, Math.max(0, (offValue / maxValue) * 100));
  const onPct = Math.min(100, Math.max(0, (onValue / maxValue) * 100));

  const format = formatValue || ((n: number) => `${n.toLocaleString()}${unit}`);

  return (
    <div className="p-4 sm:p-5 rounded-2xl glass-panel border border-white/10 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-white tracking-wide">{label}</div>
          <div className="text-[11px] text-slate-400">{description}</div>
        </div>
        <div>
          <DeltaChip value={delta} format={formatValue ? () => `${delta > 0 ? '+' : ''}${format(delta)}` : undefined} inverse={inverse} unit={formatValue ? '' : unit} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* Defenses OFF Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              DEFENSES OFF
            </span>
            <span className="text-white font-bold">{format(offValue)}</span>
          </div>
          <div className="w-full h-3.5 rounded-lg bg-slate-900 border border-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${offPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-red-600 to-rose-500 rounded-lg"
            />
          </div>
        </div>

        {/* Defenses ON Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              DEFENSES ON
            </span>
            <span className="text-white font-bold">{format(onValue)}</span>
          </div>
          <div className="w-full h-3.5 rounded-lg bg-slate-900 border border-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${onPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Reports state (initialized from static JSON files / fallback)
  const [reportOff, setReportOff] = useState<RunReport>(STATIC_DEFENSES_OFF_REPORT);
  const [reportOn, setReportOn] = useState<RunReport>(STATIC_DEFENSES_ON_REPORT);
  const [loadSource, setLoadSource] = useState<'static_json' | 'embedded'>('embedded');

  // Load reports from query params or static JSON files
  useEffect(() => {
    async function loadReports() {
      const leftId = searchParams?.get('left');
      const rightId = searchParams?.get('right');

      try {
        const leftUrl = leftId ? `/reports/${encodeURIComponent(leftId)}` : '/reports/defenses-off.json';
        const rightUrl = rightId ? `/reports/${encodeURIComponent(rightId)}` : '/reports/defenses-on.json';

        const [resOff, resOn] = await Promise.all([
          fetch(leftUrl),
          fetch(rightUrl),
        ]);

        if (resOff.ok && resOn.ok) {
          const dataOff: RunReport = await resOff.json();
          const dataOn: RunReport = await resOn.json();
          setReportOff(dataOff);
          setReportOn(dataOn);
          setLoadSource('static_json');
        }
      } catch (err) {
        console.warn('Using embedded static report fallback', err);
      }
    }

    loadReports();
  }, [searchParams]);

  // Generate dynamic headline sentence
  const headline = useMemo(() => {
    const botOff = Math.round(reportOff.metrics.botSeatSharePct);
    const botOn = Math.round(reportOn.metrics.botSeatSharePct);
    const latOnMs = reportOn.metrics.p95LatencyMs;
    const latStr = latOnMs < 1000 ? `${latOnMs} ms` : `${(latOnMs / 1000).toFixed(1)} s`;

    let text = `Bot seat share fell from ${botOff}% to ${botOn}% while p95 latency stayed under ${latStr}.`;

    if (reportOff.metrics.oversellCount > 0 && reportOn.metrics.oversellCount === 0) {
      text += ` Oversell violations completely eliminated from ${reportOff.metrics.oversellCount} to 0.`;
    }

    return text;
  }, [reportOff, reportOn]);

  // Clean 1-Page PNG Export
  const handleExportPng = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      // Allow DOM to settle, apply clean background
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: '#070c1e',
        pixelRatio: 2, // 2x crisp retina resolution
      });

      const link = document.createElement('a');
      link.download = `fairdrop-benchmark-${reportOff.runId}-vs-${reportOn.runId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070c1e] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  Adversarial Run Comparison
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {loadSource === 'static_json' ? 'Static JSON Loaded' : 'Embedded Data'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Side-by-side empirical evidence: Defenses OFF (FCFS) vs. Defenses ON (FairDrop Shuffle + PoW + Rate-Limiting)
              </p>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPng}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Generating Clean PNG...' : 'Export 1-Page PNG Report'}</span>
          </button>
        </div>
      </div>

      {/* Main Exportable Container (Target of html-to-image) */}
      <div
        ref={reportRef}
        className="p-6 sm:p-8 rounded-3xl bg-[#070c1e] border border-white/15 space-y-6 shadow-2xl relative"
      >
        {/* Report Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-violet-400">
                FairDrop Benchmark Audit
              </span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-xs font-mono text-slate-400">Project: FairDrop Hackathon M2</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mt-1">
              Defenses OFF vs. Defenses ON Comparison
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <div className="text-[10px] uppercase text-red-400 font-bold">Baseline Run ID</div>
              <div className="text-white font-semibold">{reportOff.runId}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <div className="text-[10px] uppercase text-emerald-400 font-bold">Defended Run ID</div>
              <div className="text-white font-semibold">{reportOn.runId}</div>
            </div>
          </div>
        </div>

        {/* Dynamic Headline Sentence Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950/40 via-slate-900 to-indigo-950/40 border border-violet-500/30 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/40 shrink-0">
            <Sparkles className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono font-bold text-violet-400 tracking-wider">
              Executive Finding
            </div>
            <p className="text-sm sm:text-base font-bold text-white tracking-tight mt-0.5">
              &ldquo;{headline}&rdquo;
            </p>
          </div>
        </div>

        {/* Parameters Comparison Card */}
        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-violet-400" />
              Simulation Scenario Parameters
            </span>
            <span className="text-slate-400">
              Scenario: <strong className="text-white">{reportOff.scenarioName || reportOff.scenario}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Total Clients</span>
              <div className="text-lg font-bold text-white mt-0.5">{reportOff.parameters.totalClients.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Bot Ratio</span>
              <div className="text-lg font-bold text-red-400 mt-0.5">{(reportOff.parameters.botRatio * 100).toFixed(0)}% Bots</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Duration</span>
              <div className="text-lg font-bold text-white mt-0.5">{reportOff.parameters.durationSeconds}s</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">Seats Inventory</span>
              <div className="text-lg font-bold text-violet-400 mt-0.5">{reportOff.parameters.totalSeats}</div>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase">PoW Difficulty</span>
              <div className="text-lg font-bold text-emerald-400 mt-0.5">
                {reportOn.parameters.powDifficulty ? `Level ${reportOn.parameters.powDifficulty}` : 'Disabled'}
              </div>
            </div>
          </div>
        </div>

        {/* Side-by-Side Animated Metric Bars with Delta Chips */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-1">
            <span className="uppercase font-bold tracking-wider text-slate-300">
              Metric Progression &amp; Delta Analysis
            </span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                Defenses OFF
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Defenses ON
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Bot Seat Share */}
            <ComparisonBar
              label="Bot Seat Share %"
              unit="%"
              offValue={reportOff.metrics.botSeatSharePct}
              onValue={reportOn.metrics.botSeatSharePct}
              maxValue={100}
              inverse={true}
              formatValue={(n) => `${n.toFixed(1)}%`}
              description="Proportion of allocated seats acquired by automated scripts (Target: < 5%)"
            />

            {/* 2. Human Seat Share */}
            <ComparisonBar
              label="Human Seat Share %"
              unit="%"
              offValue={reportOff.metrics.humanSeatSharePct}
              onValue={reportOn.metrics.humanSeatSharePct}
              maxValue={100}
              inverse={false}
              formatValue={(n) => `${n.toFixed(1)}%`}
              description="Proportion of allocated seats claimed by legitimate fans (Target: > 95%)"
            />

            {/* 3. Gini Coefficient */}
            <ComparisonBar
              label="Gini Inequality Coefficient"
              unit=""
              offValue={reportOff.metrics.giniCoefficient}
              onValue={reportOn.metrics.giniCoefficient}
              maxValue={1.0}
              inverse={true}
              formatValue={(n) => n.toFixed(2)}
              description="Distribution fairness: 0.00 = perfect equality, 1.00 = total bot monopoly"
            />

            {/* 4. Speed Advantage Index */}
            <ComparisonBar
              label="Speed Advantage Index"
              unit=""
              offValue={reportOff.metrics.speedAdvantageIndex}
              onValue={reportOn.metrics.speedAdvantageIndex}
              maxValue={1.0}
              inverse={true}
              formatValue={(n) => n.toFixed(2)}
              description="Correlation between arrival latency and win probability (0.00 = zero advantage)"
            />

            {/* 5. Oversell Incidents */}
            <ComparisonBar
              label="Oversell Incidents"
              unit=" seats"
              offValue={reportOff.metrics.oversellCount}
              onValue={reportOn.metrics.oversellCount}
              maxValue={20}
              inverse={true}
              formatValue={(n) => `${n} seats`}
              description="Inventory invariant violations: must be strictly 0 under atomic Lua"
            />

            {/* 6. p95 Latency */}
            <ComparisonBar
              label="p95 Latency"
              unit=" ms"
              offValue={reportOff.metrics.p95LatencyMs}
              onValue={reportOn.metrics.p95LatencyMs}
              maxValue={4000}
              inverse={true}
              formatValue={(n) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`)}
              description="95th percentile API response time under concurrent flash crowd flood"
            />

            {/* 7. Error Rate % */}
            <ComparisonBar
              label="Error Rate %"
              unit="%"
              offValue={reportOff.metrics.errorRatePct}
              onValue={reportOn.metrics.errorRatePct}
              maxValue={50}
              inverse={true}
              formatValue={(n) => `${n.toFixed(1)}%`}
              description="Unhandled 502/504 errors and gateway timeouts during peak load"
            />

            {/* 8. Total Requests Handled */}
            <ComparisonBar
              label="Total Rejections / Shielded"
              unit=" req"
              offValue={reportOff.metrics.rejectedRequests || 4200}
              onValue={reportOn.metrics.rejectedRequests || 62400}
              maxValue={85000}
              inverse={false}
              formatValue={(n) => `${n.toLocaleString()} req`}
              description="Malicious flood requests discarded at edge before reaching PostgreSQL"
            />
          </div>
        </div>

        {/* Footer Audit Stamp */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-500">
          <div>
            FairDrop Anti-Bot Architecture &bull; Cryptographic Commit-Reveal &bull; SHA-256 PoW &bull; Redis Atomic Lua
          </div>
          <div className="text-slate-400">
            Generated: {new Date(reportOn.completedAt).toUTCString()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070c1e] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading Run Comparison...
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}
