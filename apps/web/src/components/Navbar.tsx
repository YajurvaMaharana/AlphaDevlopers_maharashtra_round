'use client';

import React from 'react';
import { ShieldCheck, Activity, Users, RotateCcw, Radio } from 'lucide-react';
import { DropPhase } from '@fairdrop/shared';

interface NavbarProps {
  phase: DropPhase;
  remainingSeats: number;
  totalSeats: number;
  activeView: 'waiting_room' | 'botlab';
  onViewChange: (view: 'waiting_room' | 'botlab') => void;
  onResetSession: () => void;
  isSSEConnected: boolean;
}

export function Navbar({
  phase,
  remainingSeats,
  totalSeats,
  activeView,
  onViewChange,
  onResetSession,
  isSSEConnected
}: NavbarProps) {
  const phaseColors: Record<DropPhase, string> = {
    UPCOMING: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    WAITING_ROOM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    SHUFFLE: 'bg-purple-500/10 text-purple-400 border-purple-500/30 animate-pulse',
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    SOLD_OUT: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                FairDrop
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v1.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Anti-Bot High Demand Sale Engine • 500 Seats / 50k Fans
            </p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {/* Phase Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border flex items-center gap-2 ${phaseColors[phase]}`}>
            <span className="h-2 w-2 rounded-full bg-current"></span>
            <span>PHASE: {phase.replace('_', ' ')}</span>
          </div>

          {/* Seat Inventory */}
          <div className="px-3 py-1 rounded-full text-xs font-mono bg-zinc-900/80 text-zinc-300 border border-white/10 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-emerald-400 font-bold">{remainingSeats}</span>
            <span className="text-zinc-500">/</span>
            <span>{totalSeats} Left</span>
          </div>

          {/* SSE Live Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-500/20">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>{isSSEConnected ? 'SSE Live' : 'Resilient Mesh'}</span>
          </div>
        </div>

        {/* View Switcher and Controls */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-zinc-900 border border-white/10 flex items-center gap-1">
            <button
              onClick={() => onViewChange('waiting_room')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'waiting_room'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Fan Drop UI
            </button>
            <button
              onClick={() => onViewChange('botlab')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeView === 'botlab'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              BotLab Telemetry
            </button>
          </div>

          <button
            onClick={onResetSession}
            title="Reset Session and Clear Cache"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
