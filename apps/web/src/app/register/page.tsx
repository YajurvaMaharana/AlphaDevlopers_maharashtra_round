'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Key, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('fan@example.com');
  const [step, setStep] = useState<'REGISTER' | 'VERIFY' | 'SUCCESS'>('REGISTER');
  const [otp, setOtp] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userResult, setUserResult] = useState<{ id: string; email: string; riskTier: string; token: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.auth.register({
        email,
        clientFingerprint: `fp-${Math.random().toString(36).slice(2, 10)}-${navigator.language || 'en'}`
      });
      setStep('VERIFY');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.auth.verify({
        email,
        otp,
        clientFingerprint: `fp-${Math.random().toString(36).slice(2, 10)}-${navigator.language || 'en'}`
      });

      setUserResult({
        ...res.user,
        token: res.token
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Fan Registration & Verification
        </h2>
        <p className="text-xs text-slate-400">
          Step 1: Authenticate identity and generate risk scoring tier.
        </p>
      </div>

      <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-4">
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
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400">
              <span className="text-violet-400 font-semibold block mb-0.5">Automated Bot Defense:</span>
              Device entropy and browser fingerprint tokens are generated to eliminate bulk bot registration.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Challenge...
                </>
              ) : (
                <>
                  Send Verification OTP
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {step === 'VERIFY' && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-slate-300">
              Enter the 6-digit OTP code sent to <strong className="text-white">{email}</strong>. (In demo/mock mode, code is <code className="text-violet-300">123456</code>).
            </div>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                6-DIGIT VERIFICATION CODE
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-sm font-mono tracking-widest text-center focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isLoading ? 'Verifying Code...' : 'Confirm OTP & Authenticate'}
            </button>
          </form>
        )}

        {step === 'SUCCESS' && userResult && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-good/20 border border-good/40 text-good flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white">Identity Verified</h3>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">User ID:</span>
                <span className="font-mono text-slate-200">{userResult.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-200">{userResult.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Risk Assessment:</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                    userResult.riskTier === 'low'
                      ? 'bg-good/20 text-good border border-good/30'
                      : 'bg-bad/20 text-bad border border-bad/30'
                  }`}
                >
                  {userResult.riskTier.toUpperCase()} RISK
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push('/waiting')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
            >
              Proceed to Waiting Room
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
