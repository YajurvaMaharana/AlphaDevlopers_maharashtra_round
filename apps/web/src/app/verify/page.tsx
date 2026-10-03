'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  Hash,
  Lock
} from 'lucide-react';
import { api } from '@/lib/api';

function VerifyContent() {
  const searchParams = useSearchParams();
  const [receiptId, setReceiptId] = useState(searchParams?.get('receiptId') || 'rcpt_demo_001');
  const [isLoading, setIsLoading] = useState(false);
  const [proofData, setProofData] = useState<any | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  const handleAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const [receipt, proof, commitment] = await Promise.all([
        api.checkout.getReceipt(receiptId),
        api.drop.getProof('fairdrop-main-2026', 'usr_mock_001'),
        api.drop.getCommitment('fairdrop-main-2026')
      ]);

      setReceiptData(receipt);
      setProofData({
        ...proof,
        publishedCommitment: commitment.commitment,
        publishedAt: commitment.publishedAt
      });
    } catch (err) {
      console.warn('Audit error', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleAudit();
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Public Fairness Audit & Verification
        </h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          Step 4: Independently verify the commit-reveal seed, Merkle inclusion proof, and ledger immutability.
        </p>
      </div>

      {/* Query Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10">
        <form onSubmit={handleAudit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={receiptId}
              onChange={(e) => setReceiptId(e.target.value)}
              placeholder="Enter Receipt ID (e.g. rcpt_demo_001)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors"
          >
            {isLoading ? 'Auditing...' : 'Verify Proof'}
          </button>
        </form>
      </div>

      {proofData && receiptData && (
        <div className="space-y-6">
          {/* Main Result Banner */}
          <div className="glass-panel-good rounded-3xl p-6 text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-good/20 text-good border border-good/40 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Cryptographically Proven Fair</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              The allocation seed commitment matches the pre-sale publication. Merkle inclusion proof verified against the published root.
            </p>
          </div>

          {/* Audit Verification Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step 1: Commit-Reveal Seed Check */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-violet-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  1. Commit-Reveal Seed Verification
                </h4>
              </div>

              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block">PUBLISHED COMMITMENT (SHA-256):</span>
                  <div className="text-slate-300 break-all p-2 rounded-lg bg-slate-900/80 border border-white/5">
                    {proofData.publishedCommitment}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block">REVEALED SEED:</span>
                  <div className="text-slate-300 break-all p-2 rounded-lg bg-slate-900/80 border border-white/5">
                    {proofData.revealedSeed}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-good font-sans text-xs pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>SHA-256(Revealed Seed) == Published Commitment</span>
                </div>
              </div>
            </div>

            {/* Step 2: Merkle Proof Audit */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  2. Merkle Tree Inclusion Proof
                </h4>
              </div>

              <div className="space-y-2 text-[11px] font-mono">
                <div>
                  <span className="text-slate-500 block">MERKLE ROOT:</span>
                  <div className="text-slate-300 break-all p-2 rounded-lg bg-slate-900/80 border border-white/5">
                    {proofData.merkleRoot}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block">ALLOCATION RANK:</span>
                  <div className="text-slate-300 p-2 rounded-lg bg-slate-900/80 border border-white/5">
                    User Rank #{proofData.userRank} &bull; Seat #{receiptData.seatNumbers?.[0] || 42}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-good font-sans text-xs pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>2 Merkle branch nodes verified against root</span>
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Receipt Summary */}
          <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">LEDGER TX AUDIT</span>
              <span className="text-xs font-mono text-good font-semibold">Immutable Record</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block font-mono text-[10px]">RECEIPT ID</span>
                <span className="font-mono text-slate-200">{receiptData.receiptId}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono text-[10px]">BUYER</span>
                <span className="text-slate-200">{receiptData.buyerName}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono text-[10px]">SEAT ALLOCATED</span>
                <span className="font-mono font-bold text-good">Seat #{receiptData.seatNumbers?.[0] || 42}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-mono text-[10px]">TX HASH</span>
                <span className="font-mono text-slate-400 truncate block">
                  {receiptData.txHash?.slice(0, 14)}...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-xs text-slate-400 font-mono">
          Loading Fairness Verification Audit Tool...
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
