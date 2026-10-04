'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  Copy,
  Check,
  Laptop,
  ArrowRight,
  ShieldAlert,
  Flame,
  KeyRound,
  RotateCcw
} from 'lucide-react';
import { useClientMachine } from '@/hooks/useClientMachine';
import { useHoldCountdown } from '@/hooks/useHoldCountdown';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSSEStream } from '@/hooks/useSSEStream';
import { NetworkBanner } from '@/components/NetworkBanner';
import { ClientFlowStep } from '@fairdrop/shared';
import { api } from '@/lib/api';

const STEPS_ORDER: ClientFlowStep[] = [
  'anonymous',
  'verified',
  'joined',
  'waiting',
  'admitted',
  'reserved',
  'paying',
  'confirmed',
];

export function ClientFlowController() {
  const {
    state,
    bootstrap,
    verifyOtp,
    requestJoin,
    enterWaitingRoom,
    updateQueue,
    admitTurn,
    reserveSeat,
    initiatePayment,
    confirmPayment,
    failPayment,
    expireHold,
    retryPayment,
    resetFlow,
  } = useClientMachine();

  const [copiedHash, setCopiedHash] = useState(false);
  const [demoActionLoading, setDemoActionLoading] = useState(false);

  const [isAppealModalOpen, setIsAppealModalOpen] = useState(false);
  const [appealOtp, setAppealOtp] = useState('123456');
  const [isAppealing, setIsAppealing] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  const [isStepUpModalOpen, setIsStepUpModalOpen] = useState(false);
  const [stepUpOtp, setStepUpOtp] = useState('');
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [stepUpAttempts, setStepUpAttempts] = useState(0);
  const [stepUpSuccess, setStepUpSuccess] = useState(false);
  const [isVerifyingStepUp, setIsVerifyingStepUp] = useState(false);

  const handleStepUpVerify = async () => {
    if (stepUpAttempts >= 3) {
      setStepUpError('Max 3 attempts reached. Please request a new OTP.');
      return;
    }
    setIsVerifyingStepUp(true);
    setStepUpError(null);
    try {
      const token = localStorage.getItem('fairdrop_auth_token') || undefined;
      await api.auth.stepupVerify(stepUpOtp || '123456', token);
      setStepUpSuccess(true);
      // Emit event to dashboard
      const channel = new BroadcastChannel('fairdrop_tab_sync_v1');
      channel.postMessage({
        type: 'DASHBOARD_EVENT',
        event: {
          type: 'APPEAL_GRANTED',
          message: 'Step-up verification passed',
          ipMasked: `192.0.2.${Math.floor(10 + Math.random() * 200)}`,
          asnType: 'VPN',
          severity: 'good'
        }
      });
      channel.close();

      setTimeout(() => {
        bootstrap();
      }, 1000);
    } catch (e: any) {
      setStepUpAttempts((prev) => prev + 1);
      setStepUpError(e?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsVerifyingStepUp(false);
    }
  };

  // SSE Stream hook
  const sse = useSSEStream({
    autoConnect: state.step === 'waiting' || state.step === 'joined',
    onQueueUpdate: (pos, eta) => updateQueue(pos, eta),
    onAdmitted: () => admitTurn(),
    onHoldUpdate: (hold) => {
      reserveSeat(state.ticketId || 'tkt_demo_001', hold);
    },
  });

  // Network and offline status hook
  const network = useNetworkStatus(sse.status);

  // Hold countdown hook with drift correction and offline detection
  const countdown = useHoldCountdown(state.hold, 120, () => {
    expireHold();
  });

  const handleCopyCommitment = () => {
    const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Safe payment execution with double-click guard and idempotency key reuse
  const handlePay = async () => {
    if (state.step !== 'reserved' && state.step !== 'failed') return;
    if (countdown.isExpired) {
      expireHold();
      return;
    }

    initiatePayment();
    setDemoActionLoading(true);

    try {
      // Simulate/call checkout pay endpoint reusing idempotency key
      const key = state.idempotencyKey || crypto.randomUUID();
      const res = await api.checkout.pay({
        reservationId: state.hold?.holdId || 'res_demo_001',
        paymentMethod: 'mock_card',
        idempotencyKey: key,
      });

      confirmPayment(res.receiptId || `rcpt_${Date.now()}`);
    } catch (err: any) {
      failPayment(err?.code || 'PAYMENT_FAILED', err?.message || 'Payment processor declined card.');
    } finally {
      setDemoActionLoading(false);
    }
  };

  const handleAppealSubmit = async () => {
    setIsAppealing(true);
    try {
      const token = localStorage.getItem('fairdrop_auth_token') || undefined;
      const res = await api.auth.appeal({
        dropId: 'fairdrop-main-2026',
        fairId: localStorage.getItem('fairdrop_fair_id') || 'fair_id_test',
        email: state.email || 'bot-datacenter@test.com',
        reAuthMethod: 'otp',
        otpCode: appealOtp,
        deviceFp: 'test-fp'
      }, token);

      setAppealSuccess(true);
      setIsAppealModalOpen(false);

      // Emit to dashboard via BroadcastChannel
      const channel = new BroadcastChannel('fairdrop_tab_sync_v1');
      channel.postMessage({
        type: 'DASHBOARD_EVENT',
        event: {
          type: 'APPEAL_GRANTED',
          message: `User downgraded High -> Standard lane tier (Score: ${res.newScore || 30})`,
          ipMasked: `73.4.${Math.floor(10 + Math.random() * 200)}.xx`,
          asnType: 'RESIDENTIAL',
          severity: 'good'
        }
      });
      channel.close();
      
      // Update local state by forcing a bootstrap
      setTimeout(() => {
         bootstrap();
      }, 1000);
      
    } catch (e) {
      console.error('Appeal failed', e);
    } finally {
      setIsAppealing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* High Risk Blocked Card */}
      {(state.gate === 'blocked' || state.tier === 'high') && !appealSuccess && (
        <div className="glass-panel p-8 rounded-3xl border border-red-500/50 bg-red-950/20 space-y-6 text-center max-w-2xl mx-auto shadow-2xl shadow-red-500/20">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest">
              RISK_BLOCKED (403)
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">Access Blocked by Risk Gate</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              This is an automated safety decision, not a ban.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-red-500/20 text-left space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-red-300">Detected Risk Signals:</div>
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 font-mono">
              <li>datacenter network</li>
              <li>many registrations from the same subnet</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsAppealModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-xl shadow-red-600/30 transition-all cursor-pointer"
            >
              Appeal: verify with email code
            </button>
          </div>
        </div>
      )}

      {/* Medium Risk Stepup Required Modal */}
      {(state.gate === 'stepup_required' || isStepUpModalOpen) && !stepUpSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-8 rounded-3xl border border-blue-500/40 bg-slate-900/95 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Extra verification required</h3>
                <p className="text-xs text-slate-400">Medium risk tier step-up challenge</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Please enter the 6-digit OTP sent to your verified device or email to pass the security checkpoint. (Demo Code: <strong className="text-emerald-400 font-mono">123456</strong>)
            </p>

            <div className="space-y-3">
              <input
                type="text"
                maxLength={6}
                value={stepUpOtp}
                onChange={(e) => setStepUpOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-3.5 rounded-xl bg-black/60 border border-white/20 text-white text-center font-mono text-2xl tracking-widest focus:border-blue-500 outline-none"
              />
              {stepUpError && (
                <div className="text-xs text-red-400 font-mono bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  {stepUpError}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleStepUpVerify}
                disabled={isVerifyingStepUp || stepUpAttempts >= 3}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifyingStepUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Verify Step-Up OTP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Offline & Reconnecting Glassmorphism Banner */}
      <NetworkBanner
        network={network}
        queuePosition={state.position}
        holdExpiresAt={state.hold?.expiresAt}
        onForceReconnect={sse.reconnect}
      />

      {/* 2. Top Flow Progress Stepper */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-violet-400">
                Client Finite State Machine
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Step: {state.step}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Source of Truth: Server /me/state
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => bootstrap()}
              disabled={state.isSyncing}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${state.isSyncing ? 'animate-spin text-violet-400' : ''}`} />
              Resync /me/state
            </button>
            <button
              onClick={resetFlow}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Visual Stepper */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {STEPS_ORDER.map((stepKey, idx) => {
            const isCurrent = state.step === stepKey;
            const isPassed = STEPS_ORDER.indexOf(state.step) > idx;

            return (
              <div
                key={stepKey}
                className={`p-2.5 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? 'bg-violet-600/25 border-violet-500 text-white shadow-lg shadow-violet-500/20'
                    : isPassed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-white/[0.02] border-white/5 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-mono opacity-70 mb-0.5">0{idx + 1}</div>
                <div className="text-xs font-semibold capitalize truncate">{stepKey}</div>
                <div className="mt-1 flex justify-center">
                  {isPassed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Terminal/Special States Badge */}
        {(state.step === 'failed' || state.step === 'expired') && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between text-xs text-red-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>
                <strong>Terminal State:</strong>{' '}
                {state.step === 'expired'
                  ? 'Reservation hold timed out. Seat returned to pool.'
                  : `Payment failed (${state.error?.code || 'DECLINED'}).`}
              </span>
            </div>
            {state.step === 'failed' && (
              <button
                onClick={retryPayment}
                className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-white font-medium"
              >
                Retry with Same Idempotency Key
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Main State Content View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active State Action Card */}
        <div className="lg:col-span-2 space-y-6">
          {/* STATE: ANONYMOUS */}
          {state.step === 'anonymous' && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Step 1: Anonymous / Unverified</h4>
                  <p className="text-xs text-slate-400">Complete verification to enter waiting room.</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Fans must authenticate via single-use email OTP. Cryptographic client signals and risk score are
                evaluated upon verification.
              </p>
              <button
                onClick={() => verifyOtp('usr_demo_101', 'fan@example.com', 'mock_jwt_token_2026', 'low')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-violet-600/30"
              >
                <span>Verify Fan Account (OTP)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE: VERIFIED */}
          {state.step === 'verified' && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Step 2: Account Verified</h4>
                  <p className="text-xs text-slate-400">{state.email} (Risk Tier: {state.tier})</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                You are authenticated and ready to solve the proof-of-work puzzle to enroll in the FairDrop queue.
              </p>
              <button
                onClick={() => {
                  requestJoin();
                  setTimeout(() => enterWaitingRoom(142, 45), 600);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/30"
              >
                <span>Solve PoW &amp; Join Waiting Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE: WAITING OR JOINED */}
          {(state.step === 'waiting' || state.step === 'joined') && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5 relative overflow-hidden">
              {(String(state.tier) === 'HIGH_RISK' || state.tier === 'high') && !appealSuccess && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                    <div>
                      <h5 className="text-sm font-bold text-red-300">High Risk Network Signals Detected</h5>
                      <p className="text-xs text-red-400/80 mt-0.5">Extra verification required to retain queue position.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAppealModalOpen(true)}
                    className="shrink-0 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                  >
                    Appeal Risk Status
                  </button>
                </div>
              )}
              {appealSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-emerald-300">Appeal Successful</h5>
                    <p className="text-xs text-emerald-400/80 mt-0.5">You've been moved to the standard lane. Queue position maintained.</p>
                  </div>
                </div>
              )}

              {isAppealModalOpen && (
                <div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col justify-center border border-white/10 m-0">
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <ShieldAlert className="w-6 h-6 text-red-400" />
                      <h4 className="text-lg font-bold text-white">Risk Status Appeal</h4>
                    </div>
                    <p className="text-xs text-slate-300">
                      Enter the 6-digit verification code sent to your email to prove human presence and lower your risk tier.
                    </p>
                    <div>
                      <input
                        type="text"
                        value={appealOtp}
                        onChange={(e) => setAppealOtp(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white text-center font-mono tracking-widest focus:border-violet-500 outline-none"
                        placeholder="123456"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIsAppealModalOpen(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/5 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAppealSubmit}
                        disabled={isAppealing}
                        className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
                      >
                        {isAppealing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Submit Appeal'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Users className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Step 3: In Waiting Room / Queue</h4>
                    <p className="text-xs text-slate-400">Stream connected via Server-Sent Events</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Position #{state.position ?? 142}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center font-mono">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Queue Position</div>
                  <div className="text-2xl font-bold text-violet-400 mt-0.5">#{state.position ?? 142}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Estimated ETA</div>
                  <div className="text-2xl font-bold text-blue-400 mt-0.5">{state.etaSec ?? 45}s</div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-400 uppercase">Last SSE Event ID</div>
                  <div className="text-xs font-bold text-slate-300 truncate mt-2">{sse.lastEventId || 'evt_live_001'}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQueue(Math.max(1, (state.position || 50) - 15), Math.max(5, (state.etaSec || 30) - 5))}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 border border-white/10 cursor-pointer"
                >
                  Step Queue Forward (-15)
                </button>
                <button
                  onClick={admitTurn}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white cursor-pointer shadow-md shadow-violet-600/30"
                >
                  Admit Turn (Simulate Rank #1)
                </button>
              </div>
            </div>
          )}

          {/* STATE: ADMITTED */}
          {state.step === 'admitted' && (
            <div className="glass-panel p-6 rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-950/30 to-slate-900/50 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-violet-400 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Step 4: Turn Admitted!</h4>
                  <p className="text-xs text-violet-300">You are at the front of the queue. Claim your seat hold.</p>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Click below to atomically reserve an inventory slot. The server grants an exclusive 120-second hold.
              </p>
              <button
                onClick={() =>
                  reserveSeat('tkt_seat_042', {
                    holdId: `hld_${Date.now()}`,
                    expiresAt: Date.now() + 120000,
                  }, 1)
                }
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/40"
              >
                <span>Reserve Seat #42 Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STATE: RESERVED OR PAYING */}
          {(state.step === 'reserved' || state.step === 'paying') && (
            <div className="glass-panel p-6 rounded-2xl border border-emerald-500/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {state.step === 'paying' ? 'Processing Checkout...' : 'Step 5: Seat Held & Reserved'}
                    </h4>
                    <p className="text-xs text-slate-400">Hold ID: {state.hold?.holdId}</p>
                  </div>
                </div>

                {/* Monotonic Hold Countdown */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  <span className="text-slate-400">HOLD:</span>
                  <span className={`font-bold ${countdown.remainingSeconds < 30 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                    {countdown.formattedTime}
                  </span>
                </div>
              </div>

              {/* Hold progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    countdown.remainingSeconds < 30 ? 'bg-red-500' : 'bg-amber-400'
                  }`}
                  style={{ width: `${countdown.progressPercent}%` }}
                />
              </div>

              {/* Idempotency Protection Indicator */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 space-y-1 font-mono">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>SINGLE-FLIGHT IDEMPOTENCY KEY:</span>
                  <span className="text-emerald-400">Double-Click Protected</span>
                </div>
                <div className="text-[11px] text-slate-200 truncate">{state.idempotencyKey}</div>
              </div>

              {/* Pay Button: disabled when paying or expired */}
              <button
                onClick={handlePay}
                disabled={state.step === 'paying' || countdown.isExpired || demoActionLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {state.step === 'paying' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Payment (Single-Flight Lock Active)...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay $99.00 USD (Seat #42)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* STATE: CONFIRMED */}
          {state.step === 'confirmed' && (
            <div className="glass-panel p-6 rounded-2xl border border-emerald-500/50 bg-gradient-to-br from-emerald-950/20 to-slate-900/60 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Purchase Confirmed!</h4>
                <p className="text-xs text-slate-300">
                  Receipt ID: <span className="font-mono text-emerald-300">{state.receiptId}</span>
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Your ticket allocation is secured on the immutable ledger. You can inspect the Merkle inclusion proof
                on the audit page.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={`/verify?receiptId=${state.receiptId}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Verify Cryptographic Proof
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Multi-Tab, Seed Commitment, & Invariants */}
        <div className="space-y-4">
          {/* Multi-Tab Sync Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Laptop className="w-4 h-4 text-violet-400" />
              <span>Multi-Tab BroadcastChannel</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open this page in a second browser tab. Changes in step, queue position, or hold countdown sync in real
              time with zero drift.
            </p>
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Active Channel:</span>
                <span className="text-violet-300">fairdrop_tab_sync_v1</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Last Broadcast:</span>
                <span className="text-slate-200">
                  {state.lastSyncedAt ? `${Math.floor((Date.now() - state.lastSyncedAt) / 1000)}s ago` : 'Live'}
                </span>
              </div>
            </div>
          </div>

          {/* Seed Commitment Box */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Seed Commitment
              </span>
              <button
                onClick={handleCopyCommitment}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                title="Copy SHA-256 Hash"
              >
                {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-slate-300 break-all">
              e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Published prior to drop start. Seed reveal unlocks uniform Fisher-Yates verification after sale.
            </p>
          </div>

          {/* Edge Case Simulation Box */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Edge Case Test Lab
            </span>
            <div className="space-y-2">
              <button
                onClick={() => {
                  localStorage.removeItem('fairdrop_auth_token');
                  bootstrap();
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                Simulate 401 JWT Expiry
              </button>
              <button
                onClick={() => {
                  if (state.hold) {
                    reserveSeat(state.ticketId || 'tkt_001', {
                      holdId: state.hold.holdId,
                      expiresAt: Date.now() - 5000,
                    });
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                Simulate Offline Hold Expiration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
