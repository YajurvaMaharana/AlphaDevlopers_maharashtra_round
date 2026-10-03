'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Ticket, QrCode, ShieldCheck, Download, Activity } from 'lucide-react';
import { CheckoutResponse } from '@fairdrop/shared';
import { formatPrice } from '../lib/utils';

interface OrderConfirmationCardProps {
  receipt: CheckoutResponse;
  onViewBotLab: () => void;
  onReset: () => void;
}

export function OrderConfirmationCard({
  receipt,
  onViewBotLab,
  onReset
}: OrderConfirmationCardProps) {
  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-panel-success rounded-3xl p-6 sm:p-8 bg-zinc-950/90 border border-emerald-500/40 shadow-2xl relative overflow-hidden"
      >
        {/* Glow backdrop */}
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-1">
            Order Confirmed & Cryptographically Signed
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            You Got Seat #{receipt.seatNumber}!
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Order ID: <span className="font-mono text-zinc-300">{receipt.orderId}</span>
          </p>
        </div>

        {/* Digital Ticket Pass Stub */}
        <div className="rounded-2xl bg-zinc-900/90 border border-dashed border-zinc-700 p-6 relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-[11px] font-mono text-zinc-500 block uppercase">EVENT</span>
              <h4 className="text-sm font-bold text-white">FairDrop Arena 2026</h4>
              <span className="text-xs text-zinc-400">Exclusive 500 Seat Allocation</span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-mono text-zinc-500 block uppercase">SEAT NO.</span>
              <span className="text-2xl font-black text-emerald-400 font-mono">
                #{receipt.seatNumber}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-zinc-800 text-xs">
            <div>
              <span className="text-zinc-500 block font-mono">ATTENDEE</span>
              <span className="text-zinc-200 font-semibold">{receipt.buyerName}</span>
            </div>
            <div>
              <span className="text-zinc-500 block font-mono">PRICE PAID</span>
              <span className="text-zinc-200 font-semibold">
                {formatPrice(receipt.amountCents)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>FairPlay Authenticated</span>
              </div>
              <p className="text-[10px] font-mono text-zinc-500 break-all max-w-[240px]">
                {receipt.ticketHash.slice(0, 32)}...
              </p>
            </div>

            <div className="w-16 h-16 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0">
              <QrCode className="w-full h-full text-black" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onViewBotLab}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Activity className="w-4 h-4" />
            View BotLab Telemetry Proof
          </button>

          <button
            onClick={onReset}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs border border-white/10 transition-all"
          >
            Simulate Another Fan Drop
          </button>
        </div>
      </motion.div>
    </div>
  );
}
