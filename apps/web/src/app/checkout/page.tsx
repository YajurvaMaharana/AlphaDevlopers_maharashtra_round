'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Timer,
  Lock,
  Ticket,
  CreditCard,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { ReceiptCard } from '@/components/ReceiptCard';

export default function CheckoutPage() {
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [seatNumber, setSeatNumber] = useState<number>(42);
  const [reservationId, setReservationId] = useState<string>('res_mock_42');
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [name, setName] = useState('Alex Rivers');
  const [email, setEmail] = useState('alex.rivers@example.com');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  // 120s Hold Timer
  useEffect(() => {
    if (receipt) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [receipt]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secondsRemaining <= 0) {
      setError('Reservation hold has expired. Please rejoin queue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await api.checkout.pay({
        reservationId,
        idempotencyKey,
        paymentMethod: 'mock_card',
        attendee: {
          name,
          email
        }
      });
      const finalReceiptId = res.receiptId || `rcpt_${Date.now()}_99a`;
      setReceipt({
        receiptId: finalReceiptId,
        orderId: res.orderId,
        dropId: 'fairdrop-main-2026',
        seatNumbers: res.seatNumbers || [seatNumber],
        buyerName: name,
        buyerEmail: email,
        paidAt: res.paidAt || Date.now(),
        amountCents: res.amountPaidCents || 9900,
        currency: res.currency || 'USD',
        txHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        allocationId: `alloc_fd_${finalReceiptId.slice(-8)}`,
        queueBatch: 'Batch #1 (Window A)',
        rank: 42,
        riskTier: 'Tier 1: Minimal Risk (Human 99.4%)',
        commitment: '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
        revealedSeed: 'fairdrop_seed_10',
        merkleRoot: '4c99ae1210c44cef692ae0010f5a121fbce47035b9a765436ee4380eae1ca39e',
        qrCodeUrl: `/verify?receipt=${finalReceiptId}`
      });
    } catch (err: any) {
      setError(err?.message || 'Payment processing error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUrgent = secondsRemaining < 30;

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-good/10 border border-good/30 text-good flex items-center justify-center">
          <Ticket className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Guaranteed Seat Checkout
        </h2>
        <p className="text-xs text-slate-400">
          Step 3: Exclusive 120-second reservation hold with idempotency protection.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!receipt ? (
        <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6">
          {/* Header & Lock Timer */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase block">RESERVED SEAT</span>
              <h3 className="text-lg font-bold text-white">Seat #{seatNumber}</h3>
            </div>

            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold border transition-colors ${
                isUrgent
                  ? 'bg-bad/20 text-bad border-bad/40 animate-pulse'
                  : 'bg-good/20 text-good border-good/40'
              }`}
            >
              <Timer className="w-4 h-4" />
              <span>
                {Math.floor(secondsRemaining / 60)}:
                {(secondsRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          <form onSubmit={handlePay} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                FULL NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                PAYMENT METHOD
              </label>
              <div className="p-3 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-violet-400" />
                  <span>Mock Fast Checkout (Hackathon Demo)</span>
                </div>
                <span className="font-mono text-good font-bold">$99.00 USD</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 font-mono">
              Idempotency Key: {idempotencyKey.slice(0, 16)}... (Guarantees zero double-allocation)
            </div>

            <button
              type="submit"
              disabled={isSubmitting || secondsRemaining <= 0}
              className="w-full py-3 rounded-xl bg-good hover:bg-good-glow text-white font-semibold text-xs shadow-lg shadow-good/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Lock className="w-4 h-4 animate-spin" />
                  Locking Allocation in Ledger...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Pay $99.00
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <ReceiptCard receipt={receipt} onSimulateAnother={() => setReceipt(null)} />
      )}
    </div>
  );
}
