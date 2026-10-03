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
      setReceipt(res);
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
        <div className="glass-panel-good rounded-3xl p-6 sm:p-8 space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-good/20 text-good border border-good/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white">Payment Confirmed!</h3>
            <p className="text-xs text-slate-400 mt-1">
              Seat #{receipt.seatNumbers?.[0] || seatNumber} has been atomically recorded in the ledger.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Order ID:</span>
              <span className="font-mono text-slate-200">{receipt.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Receipt ID:</span>
              <span className="font-mono text-slate-200">{receipt.receiptId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="font-mono font-bold text-good">COMPLETED</span>
            </div>
          </div>

          <Link
            href={`/verify?receiptId=${receipt.receiptId}`}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Fairness Receipt on Independent Audit Tool
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
