import type { Metadata } from 'next';
import './globals.css';
import { MswProvider } from '../components/MswProvider';
import { ServiceWorkerRegister } from '../components/ServiceWorkerRegister';
import { StepperNavbar } from '../components/StepperNavbar';

export const metadata: Metadata = {
  title: 'FairDrop — High-Demand Sale Platform (500 Seats / 50k Fans)',
  description: 'Anti-bot flash crowd sale and registration engine with cryptographic fairness guarantees.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="antialiased min-h-screen flex flex-col bg-[#070c1e] text-slate-100 selection:bg-violet-500/30 selection:text-violet-200"
      >
        <MswProvider>
          <ServiceWorkerRegister />
          {/* Top Global Animated Interactive Stepper Navigation */}
          <StepperNavbar />

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
