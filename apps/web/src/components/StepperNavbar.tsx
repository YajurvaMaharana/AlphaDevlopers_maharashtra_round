'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck, Check, Users, Ticket, CheckCircle2, ShieldAlert, Cpu, Layers, Activity } from 'lucide-react';

export function StepperNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [transitioningStep, setTransitioningStep] = useState<number | null>(null);

  // Determine current active step based on usePathname()
  let currentStep = 1;
  if (pathname === '/waiting' || pathname === '/drop') {
    currentStep = 2;
  } else if (pathname.startsWith('/checkout')) {
    currentStep = 3;
  } else if (pathname.startsWith('/verify') || pathname.startsWith('/receipt')) {
    currentStep = 4;
  } else if (pathname === '/register' || pathname === '/') {
    currentStep = 1;
  }

  // Smooth micro-transition on step click
  const handleStepClick = (stepNumber: number, targetHref: string) => {
    if (stepNumber === currentStep) return;
    setTransitioningStep(stepNumber);
    setTimeout(() => {
      setTransitioningStep(null);
      router.push(targetHref);
    }, 600);
  };

  const steps = [
    { number: 1, label: '1. Register', href: '/register', icon: Users },
    { number: 2, label: '2. Waiting Room', href: '/waiting', icon: Ticket },
    { number: 3, label: '3. Checkout', href: '/checkout', icon: CheckCircle2 },
    { number: 4, label: '4. Verify Proof', href: '/verify', icon: ShieldAlert },
  ];

  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1';
  const progressPercent = (currentStep / steps.length) * 100;

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3 backdrop-blur-xl relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center justify-between w-full xl:w-auto">
          <Link href="/" prefetch={true} className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-blue-600 shadow-lg shadow-violet-500/25 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">FairDrop</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  500 Seats
                </span>
                {isMock && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    MSW Mock
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Animated Interactive Stepper Workflow (No intersecting center line) */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 max-w-full no-scrollbar">
          <div className="relative flex items-center gap-3 sm:gap-6 px-3 py-1.5 rounded-2xl bg-zinc-950/40 border border-white/10 shadow-inner">
            {steps.map((step) => {
              const isCompleted = step.number < currentStep;
              const isActive = step.number === currentStep || transitioningStep === step.number;
              const StepIcon = step.icon;

              return (
                <button
                  key={step.number}
                  onClick={() => handleStepClick(step.number, step.href)}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all group ${
                    isCompleted
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                      : isActive
                      ? 'bg-violet-600/20 text-white border border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.6)] animate-pulse'
                      : 'opacity-50 text-slate-400 hover:opacity-80 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {/* Step Circle / Badge */}
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold transition-transform group-hover:scale-110 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/50'
                        : isActive
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-500/50 animate-bounce'
                        : 'bg-zinc-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      step.number
                    )}
                  </div>

                  <span className="whitespace-nowrap flex items-center gap-1.5">
                    <StepIcon className="w-3.5 h-3.5 opacity-70" />
                    {step.label}
                  </span>

                  {/* Transition micro-pulse effect */}
                  {transitioningStep === step.number && (
                    <span className="absolute inset-0 rounded-xl bg-violet-400/20 animate-ping pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right-Side Utility Links (Intact and Aligned to the Right) */}
        <div className="flex items-center gap-2">
          <Link
            href="/admin/lab"
            prefetch={true}
            className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30 transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <Cpu className="w-3.5 h-3.5" />
            Bot Lab
          </Link>
          <Link
            href="/admin/compare"
            prefetch={true}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <Layers className="w-3.5 h-3.5" />
            Compare
          </Link>
          <Link
            href="/admin/dashboard"
            prefetch={true}
            className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-1.5 text-xs font-medium"
          >
            <Activity className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>

      {/* Discrete Horizontal Progress Track at the Very Bottom Edge of Header */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] w-full bg-slate-800">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-violet-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(139,92,246,0.6)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </header>
  );
}
