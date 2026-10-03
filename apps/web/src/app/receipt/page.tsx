'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ReceiptDetailPage from './[id]/page';

function ReceiptSearchWrapper() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') || searchParams?.get('receiptId') || 'rcpt_demo_001';

  return <ReceiptDetailPage />;
}

export default function ReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400 font-mono">
          Loading allocation receipt...
        </div>
      }
    >
      <ReceiptSearchWrapper />
    </Suspense>
  );
}
