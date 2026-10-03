'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Dice5,
  Lock,
  ArrowRight,
  Cpu,
  BarChart3,
  CheckCircle2,
  Users,
  AlertTriangle
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden glass-panel-violet rounded-3xl p-8 sm:p-12 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30 text-xs font-mono">
            <Dice5 className="w-3.5 h-3.5" />
            Randomized Join-Window Lottery Engine
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            500 Seats. 50,000 Fans.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-300">
              Zero Bot Advantages.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Traditional drops reward whoever is 5 milliseconds faster. FairDrop randomizes the waiting room queue, neutralizes bot farms via browser Proof of Work, and guarantees atomic seat allocation.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-600/30 flex items-center gap-2 transition-all"
            >
              Start Fan Drop Flow
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/admin/lab"
              className="px-6 py-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-sm font-medium border border-white/10 flex items-center gap-2 transition-all"
            >
              <Cpu className="w-4 h-4 text-violet-400" />
              Open Adversarial Bot Lab
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Pillars of FairDrop */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          whileHover={{ y: -4 }}
          className="glass-panel rounded-2xl p-6 border border-white/10"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center mb-4">
            <Dice5 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            1. Speed Irrelevance
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All users who join during the waiting room window are shuffled using a deterministic seeded Fisher-Yates lottery. Being 5ms faster yields zero rank advantage.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="glass-panel rounded-2xl p-6 border border-white/10"
        >
          <div className="w-10 h-10 rounded-xl bg-good/10 text-good border border-good/20 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            2. Multi-Layer Defense
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Client-side WebCrypto SHA-256 Proof of Work equalizes request volume. A human computes 1 challenge in 200ms; an attacker running 50,000 bots exhausts CPU capacity.
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="glass-panel rounded-2xl p-6 border border-white/10"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            3. Provable Correctness
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Before the draw, SHA-256 commitments are published. After the draw, seeds and Merkle roots are revealed so users and judges can independently audit the allocation.
          </p>
        </motion.div>
      </section>

      {/* Flow Stage Cards */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-400" />
          Demonstration Navigation Pages
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/register"
            className="glass-panel rounded-2xl p-5 hover:border-violet-500/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-violet-400 uppercase font-semibold">Stage 1</span>
            <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors mt-1">
              /register
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              User identity, fingerprinting, OTP verification & risk tier scoring.
            </p>
          </Link>

          <Link
            href="/waiting"
            className="glass-panel rounded-2xl p-5 hover:border-violet-500/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-blue-400 uppercase font-semibold">Stage 2</span>
            <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors mt-1">
              /waiting
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Proof-of-Work solver, uniform waiting room shuffle & live queue updates.
            </p>
          </Link>

          <Link
            href="/checkout"
            className="glass-panel rounded-2xl p-5 hover:border-good/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-good uppercase font-semibold">Stage 3</span>
            <h4 className="text-base font-bold text-white group-hover:text-good transition-colors mt-1">
              /checkout
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Guaranteed 120-second seat hold, idempotent payment & digital receipt pass.
            </p>
          </Link>

          <Link
            href="/verify"
            className="glass-panel rounded-2xl p-5 hover:border-amber-500/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-amber-400 uppercase font-semibold">Stage 4</span>
            <h4 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mt-1">
              /verify
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Audit the cryptographic seed commitment, revealed hash & Merkle proof.
            </p>
          </Link>

          <Link
            href="/admin/lab"
            className="glass-panel rounded-2xl p-5 hover:border-violet-500/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-violet-400 uppercase font-semibold">Adversarial Lab</span>
            <h4 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors mt-1">
              /admin/lab
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Simulate 50k speed bots, DDoS flooding & measure Defenses ON vs OFF.
            </p>
          </Link>

          <Link
            href="/admin/dashboard"
            className="glass-panel rounded-2xl p-5 hover:border-blue-500/40 transition-all group"
          >
            <span className="text-[11px] font-mono text-blue-400 uppercase font-semibold">Telemetry</span>
            <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors mt-1">
              /admin/dashboard
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Real-time Recharts analytics, Gini coefficient & inventory conservation check.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
