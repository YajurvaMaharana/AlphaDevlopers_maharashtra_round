'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Ticket,
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  Layers,
  Award,
  Hash,
  Fingerprint,
  Calendar,
  Sparkles,
  Download
} from 'lucide-react';
import { ReceiptResponse } from '@fairdrop/shared';
import { QRCodeDisplay } from './QRCodeDisplay';

interface ReceiptCardProps {
  receipt: ReceiptResponse;
  onSimulateAnother?: () => void;
}

export function ReceiptCard({ receipt, onSimulateAnother }: ReceiptCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const seatCount = receipt.seatNumbers?.length || 1;
  const primarySeat = receipt.seatNumbers?.[0] || 42;
  const allocationId = receipt.allocationId || `alloc_fd_${receipt.receiptId.slice(-8)}`;
  const queueBatch = receipt.queueBatch || 'Batch #1 (Window A)';
  const rank = receipt.rank || 42;
  const riskTier = receipt.riskTier || 'Tier 1: Low Risk (Human 99.4%)';
  const commitment =
    receipt.commitment ||
    '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca';
  const merkleRoot =
    receipt.merkleRoot ||
    '4c99ae1210c44cef692ae0010f5a121fbce47035b9a765436ee4380eae1ca39e';
  const txHash =
    receipt.txHash ||
    '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069';

  // Construct verification URL
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://fairdrop.dev';
  const verifyUrl = `${origin}/verify?receipt=${encodeURIComponent(receipt.receiptId)}`;

  const copyToClipboard = (text: string, key: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const truncateHash = (str: string, lead = 8, trail = 6) => {
    if (!str || str.length <= lead + trail) return str;
    return `${str.slice(0, lead)}...${str.slice(-trail)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Outer Holographic Card */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-zinc-950/90 border border-emerald-500/30 shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] backdrop-blur-xl overflow-hidden">
        {/* Glow Accents */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wider uppercase">
                  OFFICIAL ALLOCATION RECEIPT
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                  <Sparkles className="w-3 h-3" />
                  CONFIRMED
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                FairDrop Arena 2026 Pass
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-mono text-zinc-500 block uppercase">
              ORDER TOTAL
            </span>
            <span className="text-lg font-bold font-mono text-white">
              ${((receipt.amountCents || 9900) / 100).toFixed(2)}{' '}
              <span className="text-xs text-zinc-400 font-normal">{receipt.currency || 'USD'}</span>
            </span>
          </div>
        </div>

        {/* Primary Ticket Visual Stub */}
        <div className="mt-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-5">
          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 1. Seat Count */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Ticket className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[10px] uppercase">SEAT COUNT</span>
              </div>
              <div className="text-lg font-bold font-mono text-white">
                {seatCount} {seatCount === 1 ? 'Seat' : 'Seats'}
              </div>
              <span className="text-[11px] font-mono text-emerald-400 block font-semibold">
                Seat #{primarySeat}
              </span>
            </div>

            {/* 2. Allocation ID */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Fingerprint className="w-3.5 h-3.5 text-violet-400" />
                <span className="font-mono text-[10px] uppercase">ALLOCATION ID</span>
              </div>
              <div className="text-xs font-mono text-white truncate pt-1 font-bold">
                {allocationId}
              </div>
              <span className="text-[10px] text-zinc-500 block truncate">
                ID: {receipt.receiptId.slice(0, 14)}...
              </span>
            </div>

            {/* 3. Queue Batch */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-mono text-[10px] uppercase">QUEUE BATCH</span>
              </div>
              <div className="text-xs font-mono font-bold text-white pt-1">
                {queueBatch}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Window 00:00 - 00:02
              </span>
            </div>

            {/* 4. Rank */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono text-[10px] uppercase">SHUFFLE RANK</span>
              </div>
              <div className="text-lg font-bold font-mono text-amber-400">
                #{rank}
              </div>
              <span className="text-[10px] text-zinc-500 block">
                of 50,000 entrants
              </span>
            </div>
          </div>

          {/* Plain-English Audit Explanation Banner */}
          {receipt.explanation && (
            <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-500/30 flex items-center gap-2.5 text-xs font-mono text-violet-200">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
              <span>{receipt.explanation}</span>
            </div>
          )}

          {/* Attendee & Risk Tier Strip */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase block">ATTENDEE</span>
              <div className="text-zinc-200 font-semibold">
                {receipt.buyerName || 'Verified Fan'}{' '}
                {receipt.emailHash ? (
                  <span className="text-zinc-400 font-mono text-[10px]">(Hash: {truncateHash(receipt.emailHash, 6, 4)})</span>
                ) : receipt.buyerEmail ? (
                  <span className="text-zinc-400 font-normal">({receipt.buyerEmail})</span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 text-xs font-mono font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{riskTier}</span>
              </div>
            </div>
          </div>

          {/* Short Hashes with Instant Copy Buttons */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span className="uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-violet-400" />
                CRYPTOGRAPHIC AUDIT HASHES
              </span>
              <span className="text-[10px] text-zinc-500">Click to copy full hash</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {/* FairHash */}
              {receipt.fairHash && (
                <div className="p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/30 flex items-center justify-between gap-2 sm:col-span-2">
                  <div className="truncate">
                    <span className="text-[10px] text-violet-400 font-bold block">FAIRHASH (ALLOCATION + BATCH + LANE + COMMITMENT + TIME)</span>
                    <span className="text-violet-200 text-[11px]">{truncateHash(receipt.fairHash, 14, 10)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(receipt.fairHash!, 'fairHash')}
                    className="p-1.5 rounded-lg bg-violet-900/60 hover:bg-violet-800 text-violet-300 hover:text-white transition-colors"
                    title="Copy FairHash"
                  >
                    {copiedKey === 'fairHash' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
              {/* Transaction Hash */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-zinc-500 block">LEDGER TX HASH</span>
                  <span className="text-zinc-300 text-[11px]">{truncateHash(txHash, 10, 8)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(txHash, 'txHash')}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Transaction Hash"
                >
                  {copiedKey === 'txHash' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Seed Commitment Hash */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-zinc-500 block">SEED COMMITMENT (SHA-256)</span>
                  <span className="text-zinc-300 text-[11px]">
                    {truncateHash(commitment, 10, 8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(commitment, 'commitment')}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Seed Commitment Hash"
                >
                  {copiedKey === 'commitment' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Merkle Root */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-zinc-500 block">MERKLE ROOT</span>
                  <span className="text-zinc-300 text-[11px]">
                    {truncateHash(merkleRoot, 10, 8)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(merkleRoot, 'merkleRoot')}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Merkle Root"
                >
                  {copiedKey === 'merkleRoot' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Allocation ID */}
              <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-white/5 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="text-[10px] text-zinc-500 block">ALLOCATION RECORD</span>
                  <span className="text-zinc-300 text-[11px]">
                    {truncateHash(allocationId, 10, 6)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(allocationId, 'allocId')}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                  title="Copy Allocation ID"
                >
                  {copiedKey === 'allocId' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* QR Code and Independent Verification Bar */}
          <div className="pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div className="sm:col-span-1 flex justify-center">
              <QRCodeDisplay
                value={verifyUrl}
                size={120}
                label="VERIFY PROOF QR"
                sublabel="Links to /verify?receipt=ID"
                showLink={false}
              />
            </div>

            <div className="sm:col-span-2 space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Mathematical Public Proof
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Anyone can inspect this allocation on our public zero-trust audit tool.
                  Your browser will recompute the commit-reveal hash, verify the Fisher-Yates
                  lottery shuffle, and check the Merkle inclusion path.
                </p>
              </div>

              <Link
                href={`/verify?receipt=${encodeURIComponent(receipt.receiptId)}`}
                className="inline-flex w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all group"
              >
                <span>Launch Browser WebCrypto Audit</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5 text-xs">
          <div className="flex items-center gap-2 text-zinc-500 font-mono text-[11px]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Recorded: {new Date(receipt.paidAt || Date.now()).toUTCString()}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Print / Save Pass</span>
            </button>

            {onSimulateAnother && (
              <button
                type="button"
                onClick={onSimulateAnother}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 transition-colors"
              >
                Simulate Another Fan Drop
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
