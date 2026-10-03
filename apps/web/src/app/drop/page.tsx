'use client';

import React, { Suspense } from 'react';
import { WaitingRoom } from '@/components/waiting/WaitingRoom';

export default function DropPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#120F4A] flex items-center justify-center p-6 text-center text-xs font-mono text-zinc-400">
          Loading FairDrop Waiting Room...
        </div>
      }
    >
      <WaitingRoom />
    </Suspense>
  );
}
