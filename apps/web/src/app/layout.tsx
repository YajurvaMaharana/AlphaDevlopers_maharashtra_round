import type { Metadata } from 'next';
import './globals.css';
import { MswProvider } from '../components/MswProvider';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import Link from 'next/link';
import { ShieldCheck, Activity, Users, Ticket, CheckCircle2, ShieldAlert, Cpu, Layers } from 'lucide-react';

export const metadata: Metadata = {
  title: 'FairDrop — High-Demand Sale Platform (500 Seats / 50k Fans)',
  description: 'Anti-bot flash crowd sale and registration engine with cryptographic fairness guarantees.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1';

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen flex flex-col bg-[#070c1e] text-slate-100 selection:bg-violet-500/30 selection:text-violet-200"
      >
        <MswProvider>
          <ServiceWorkerRegister />
          {/* Top Global Navigation */}
          <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 lg:px-8 py-3 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Brand */}
              <Link href="/" className="flex items-center gap-3 group">
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
                        MSW Mock ON
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* Navigation Links */}
              <nav className="flex items-center flex-wrap gap-1 text-xs font-medium">
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-violet-400" />
                  1. Register
                </Link>
                <Link
                  href="/waiting"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                >
                  <Ticket className="w-3.5 h-3.5 text-blue-400" />
                  2. Waiting Room
                </Link>
                <Link
                  href="/checkout"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  3. Checkout
                </Link>
                <Link
                  href="/verify"
                  className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  4. Verify Proof
                </Link>

                <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

                <Link
                  href="/admin/lab"
                  className="px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30 transition-all flex items-center gap-1.5"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Bot Lab
                </Link>
                <Link
                  href="/admin/compare"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-all flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Compare
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Dashboard
                </Link>
              </nav>
            </div>
          </header>

          {/* Main Body */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Global Footer */}
          <footer className="border-t border-white/5 py-6 px-4 text-center text-xs text-slate-500 font-mono">
            FairDrop &bull; 500 Seats / 50,000 Fans &bull; Next.js 14 App Router &bull; TypeScript & Tailwind Design System
          </footer>
        </MswProvider>
      </body>
    </html>
  );
}
