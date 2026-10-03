'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Timer,
  CreditCard,
  User,
  Mail,
  AlertCircle,
  CheckCircle,
  Ticket
} from 'lucide-react';
import { CheckoutRequestSchema, CheckoutResponse } from '@fairdrop/shared';
import { formatSeconds, formatPrice } from '../lib/utils';
import { apiClient } from '../lib/api-client';

interface ReservationCheckoutModalProps {
  isOpen: boolean;
  seatNumber: number;
  reservationToken: string;
  expiresAt: number;
  idempotencyKey: string;
  priceCents: number;
  currency: string;
  onSuccess: (receipt: CheckoutResponse) => void;
  onExpire: () => void;
}

export function ReservationCheckoutModal({
  isOpen,
  seatNumber,
  reservationToken,
  expiresAt,
  idempotencyKey,
  priceCents,
  currency,
  onSuccess,
  onExpire
}: ReservationCheckoutModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
  );
  const [fullName, setFullName] = useState('Alex Rivers');
  const [email, setEmail] = useState('alex.rivers@example.com');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('888');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Countdown timer for 120s guaranteed lock
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, expiresAt, onExpire]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate with Zod
    const payload = {
      eventId: 'fairdrop-main-2026',
      reservationToken,
      idempotencyKey,
      fullName,
      email,
      paymentMethod: 'card' as const,
      cardNumber: cardNumber.replace(/\D/g, '').padEnd(16, '4'),
      cardExpiry,
      cardCvc
    };

    const validation = CheckoutRequestSchema.safeParse(payload);
    if (!validation.success) {
      setErrorMessage(validation.error.errors[0]?.message || 'Please check your form inputs.');
      return;
    }

    try {
      setIsSubmitting(true);
      const receipt = await apiClient.checkout(validation.data);
      onSuccess(receipt);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String(err.message)
        : 'Payment processing error. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isUrgent = secondsRemaining < 30;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg glass-panel-glow rounded-3xl p-6 sm:p-8 bg-zinc-950/90 border border-indigo-500/30 shadow-2xl relative overflow-hidden"
        >
          {/* Top lock banner */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Seat #{seatNumber} Reserved for You
                </h3>
                <span className="text-xs text-zinc-400 font-mono">Exclusive Lock Active</span>
              </div>
            </div>

            {/* Countdown badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                isUrgent
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{formatSeconds(secondsRemaining)}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-mono text-zinc-400 block mb-1">
                FULL NAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-zinc-400 block mb-1">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <label className="text-xs font-mono text-zinc-400 block mb-1">
                PAYMENT DETAILS
              </label>
              <div className="relative mb-2">
                <CreditCard className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  readOnly
                  value={cardNumber}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-900/60 border border-white/10 text-zinc-300 text-sm font-mono focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  readOnly
                  value={cardExpiry}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900/60 border border-white/10 text-zinc-300 text-sm font-mono text-center focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={cardCvc}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900/60 border border-white/10 text-zinc-300 text-sm font-mono text-center focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400 font-mono block">TOTAL DUE</span>
                <span className="text-xl font-bold text-white">
                  {formatPrice(priceCents, currency)}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || secondsRemaining <= 0}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Lock className="w-4 h-4 animate-spin" />
                    Confirming Reservation...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Purchase
                  </>
                )}
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 text-center font-mono">
              Protected by Idempotency Key: {idempotencyKey.slice(0, 18)}...
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
