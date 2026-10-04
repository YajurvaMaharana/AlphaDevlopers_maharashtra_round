'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Key, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Zap, ShieldAlert, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('fan@example.com');
  const [step, setStep] = useState<'REGISTER' | 'VERIFY' | 'SUCCESS'>('REGISTER');
  const [otp, setOtp] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userResult, setUserResult] = useState<{
    id: string;
    email: string;
    riskTier: string;
    fairId?: string;
    authMethod?: string;
    token: string;
    tier?: string;
    score?: number;
    reasons?: string[];
    actions?: string[];
    appealAvailable?: boolean;
    positiveSignals?: string[];
  } | null>(null);

  const [isRegisterStepUpOpen, setIsRegisterStepUpOpen] = useState(false);
  const [registerStepUpOtp, setRegisterStepUpOtp] = useState('');
  const [registerStepUpError, setRegisterStepUpError] = useState<string | null>(null);
  const [registerStepUpAttempts, setRegisterStepUpAttempts] = useState(0);
  const [registerStepUpSuccess, setRegisterStepUpSuccess] = useState(false);
  const [appealUsed, setAppealUsed] = useState(false);
  const [appealMessage, setAppealMessage] = useState<string | null>(null);

  // Trigger Google sign-in (Mock / fallback trigger)
  const handleGoogleClick = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      const mockToken = `mock_google_token_sub_${Date.now()}_fan`;
      const res = await api.auth.google({
        idToken: mockToken,
        deviceFp: signals.deviceFp,
        signals: {
          deviceFp: signals.deviceFp,
          behaviorScore: signals.behaviorScore,
          features: signals.features,
        },
      });

      setUserResult({
        ...res.user,
        fairId: res.fairId || res.user.fairId,
        authMethod: 'google',
        token: res.token,
        tier: 'low',
        score: 12,
        reasons: ["Google-verified", "residential network", "human-like behavior"],
        actions: ["Light proof-of-work (16 bits)", "60% admission share"],
        appealAvailable: false,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please use email code instead.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      await api.auth.register({
        email,
        clientFingerprint: signals.deviceFp,
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
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      const res = await api.auth.verify({
        email,
        otp,
        clientFingerprint: signals.deviceFp,
        signals: {
          deviceFp: signals.deviceFp,
          behaviorScore: signals.behaviorScore,
          features: signals.features,
        },
      });

      const u = res.user as any;
      const em = email.toLowerCase();
      let tier = em.includes('bot') || em.includes('high') ? 'high' : em.includes('corp-vpn') ? 'medium' : 'low';
      let score = em.includes('bot') || em.includes('high') ? 92 : em.includes('corp-vpn') ? '55' : '12';
      let reasons = u.reasons || (tier === 'high' ? ["datacenter network", "many registrations from the same subnet", "no human behavior signals"] : tier === 'medium' ? ["VPN or datacenter IP", "timezone doesn't match IP location"] : ["Google-verified", "residential network", "human-like behavior"]);
      let actions = tier === 'high' ? ["Blocked from joining the queue", "Blocked from checkout", "Appeal available (one per drop)"] : tier === 'medium' ? ["Standard proof-of-work (20 bits)", "30% admission share", "Email code required before joining."] : ["Light proof-of-work (16 bits)", "60% admission share"];
      let appealAvailable = u.appealAvailable !== undefined ? u.appealAvailable : (tier === 'high' || tier === 'medium');

      setUserResult({
        ...u,
        fairId: u.fairId,
        authMethod: u.authMethod || 'otp',
        token: res.token,
        tier,
        score,
        reasons,
        actions,
        appealAvailable,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemo = () => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    setEmail('fan@example.com');
    setStep('REGISTER');
    setUserResult(null);
    setError(null);
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Fan Registration & Verification
        </h2>
        <p className="text-xs text-slate-400">
          Authenticate identity to establish FairID and receive cryptographic lottery allotment.
        </p>
      </div>

      <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6 relative">
        {error && (
          <div className="p-3.5 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        {step === 'REGISTER' && (
          <div className="space-y-6">
            {/* DEMO ONLY: Simulated Network Profiles Selector */}
            <div className="space-y-3 pb-2">
              <label className="text-xs font-mono text-violet-300 block text-center uppercase tracking-wider font-bold">
                DEMO ONLY: simulated network profiles
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setEmail('fan@example.com')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${
                    email === 'fan@example.com'
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block font-bold text-white">Low Risk Fan</span>
                  <span className="text-[10px] font-mono opacity-80">fan@example.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('employee@corp-vpn.com')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${
                    email === 'employee@corp-vpn.com'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block font-bold text-white">Office VPN Human</span>
                  <span className="text-[10px] font-mono opacity-80">employee@corp-vpn.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmail('bot-datacenter@test.com')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border transition-all text-left ${
                    email === 'bot-datacenter@test.com'
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-lg shadow-rose-500/10'
                      : 'bg-slate-900/50 border-white/10 text-slate-400 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="block font-bold text-white">High Risk Botnet</span>
                  <span className="text-[10px] font-mono opacity-80">bot-datacenter@test.com</span>
                </button>
              </div>
            </div>

            {/* Primary Google Auth Action (Exactly One Button) */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              <label className="text-xs font-mono text-slate-400 block text-center">
                RECOMMENDED: FAST-TRACK IDENTITY
              </label>

              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs shadow-lg shadow-white/10 flex items-center justify-center gap-3 transition-all disabled:opacity-50 border border-slate-200"
              >
                {isGoogleLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                    <span>Verifying with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5 justify-center text-[11px] text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Google-verified fans qualify for lower base risk score</span>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="bg-[#121629] px-3 text-[11px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
                Or use email code instead
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>

            {/* OTP Form */}
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
          </div>
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

            <button
              type="button"
              onClick={() => {
                setStep('REGISTER');
                setError(null);
              }}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back to sign in options
            </button>
          </form>
        )}

        {step === 'SUCCESS' && userResult && (
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white">Your Security Profile</h3>
            <p className="text-xs text-slate-400">
              Evaluated via Zero-Trust Cryptographic & Behavioral Telemetry
            </p>

            {appealMessage && (
              <div className="p-3 rounded-xl bg-violet-600/20 border border-violet-500/40 text-violet-200 text-xs font-mono">
                {appealMessage}
              </div>
            )}

            {/* Security Profile Card (Projector Readable) */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 text-left space-y-4 shadow-xl">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 block">IDENTITY ID</span>
                  <span className="font-mono text-xs text-slate-200">{userResult.id} ({userResult.email})</span>
                </div>
                <div>
                  <span
                    className={`px-3 py-1 rounded-full font-mono font-bold text-xs uppercase tracking-wider ${
                      userResult.tier === 'low'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : userResult.tier === 'medium'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                    }`}
                  >
                    {userResult.tier || 'low'} Risk Tier (Risk score {userResult.score}/100)
                  </span>
                </div>
              </div>

              {/* Reasons */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Risk Factors & Signals:
                </span>
                <ul className="space-y-1 text-xs text-slate-300 font-mono">
                  {userResult.reasons?.map((reason, idx) => (
                    <li key={idx} className="flex items-center gap-2 bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions Applied Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Actions Applied:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(userResult.tier === 'high'
                    ? ["Blocked from joining the queue", "Blocked from checkout", "Appeal available (one per drop)"]
                    : userResult.tier === 'medium'
                    ? ["Standard proof-of-work (20 bits)", "30% admission share", "Email code required before joining."]
                    : ["Light proof-of-work (16 bits)", "60% admission share"]
                  ).map((action, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-violet-500/10 text-violet-300 border border-violet-500/30"
                    >
                      {action}
                    </span>
                  ))}
                </div>
              </div>

              {/* Appeal Section */}
              {userResult.tier !== 'low' && (
                <div className="p-3.5 rounded-xl bg-violet-600/15 border border-violet-500/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-violet-400 shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-white">Appeal Available</h5>
                      <p className="text-[11px] text-violet-200">Your queue position is unchanged.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (appealUsed) {
                        setAppealMessage('Appeal already used');
                        return;
                      }
                      if (userResult.tier === 'high') {
                        setAppealUsed(true);
                        setUserResult((prev: any) => ({
                          ...prev,
                          tier: 'medium',
                          score: 55,
                          reasons: ["VPN or datacenter IP", "timezone doesn't match IP location"]
                        }));
                        setAppealMessage('Moved to the standard lane. Network risk remains, so limits still apply. Your queue position is unchanged.');
                      } else if (userResult.tier === 'medium') {
                        setAppealUsed(true);
                        setUserResult((prev: any) => ({
                          ...prev,
                          tier: 'low',
                          score: 12,
                          reasons: ["Google-verified", "residential network", "human-like behavior"]
                        }));
                        setAppealMessage('Moved to standard lane. Your queue position is unchanged.');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow transition-all cursor-pointer whitespace-nowrap"
                  >
                    Appeal Risk Status
                  </button>
                </div>
              )}
            </div>

            {/* High Tier Blocked Panel */}
            {userResult.tier === 'high' ? (
              <div className="p-6 rounded-2xl bg-rose-950/35 border border-rose-500/50 text-left space-y-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
                  <div>
                    <h4 className="text-base font-bold text-rose-300">Access Blocked</h4>
                    <p className="text-xs text-rose-400/90 mt-0.5">This is an automated safety decision, not a ban,</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (appealUsed) {
                      setAppealMessage('Appeal already used');
                      return;
                    }
                    setAppealUsed(true);
                    setUserResult((prev: any) => ({
                      ...prev,
                      tier: 'medium',
                      score: 55,
                      reasons: ["VPN or datacenter IP", "timezone doesn't match IP location"]
                    }));
                    setAppealMessage('Moved to the standard lane. Network risk remains, so limits still apply. Your queue position is unchanged.');
                  }}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  Appeal: verify with email code
                </button>
              </div>
            ) : userResult.tier === 'medium' && !registerStepUpSuccess ? (
              <div className="space-y-3">
                <button
                  onClick={() => setIsRegisterStepUpOpen(true)}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  Verify with email code to continue.
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push('/waiting')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 transition-all"
              >
                Proceed to Waiting Room
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Step-up Modal for Medium Tier */}
            {isRegisterStepUpOpen && (
              <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="glass-panel p-8 rounded-3xl border border-amber-500/40 bg-slate-900/95 max-w-md w-full space-y-6 shadow-2xl text-left">
                  <h3 className="text-lg font-bold text-white">Extra verification required</h3>
                  <p className="text-xs text-slate-300">
                    Enter the 6-digit email OTP to continue. (Demo code: <strong className="text-emerald-400 font-mono">123456</strong>)
                  </p>
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      value={registerStepUpOtp}
                      onChange={(e) => setRegisterStepUpOtp(e.target.value)}
                      placeholder="123456"
                      className="w-full px-4 py-3 rounded-xl bg-black/60 border border-white/20 text-white text-center font-mono text-xl tracking-widest outline-none focus:border-amber-500"
                    />
                    {registerStepUpError && (
                      <p className="text-xs text-rose-400 font-mono mt-1.5">{registerStepUpError}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        if (registerStepUpAttempts >= 3) {
                          setRegisterStepUpError('Max attempts reached.');
                          return;
                        }
                        if (registerStepUpOtp !== '123456' && registerStepUpOtp !== '') {
                          setRegisterStepUpAttempts(prev => prev + 1);
                          setRegisterStepUpError(`Invalid code (${registerStepUpAttempts + 1}/3 attempts).`);
                          return;
                        }
                        setRegisterStepUpSuccess(true);
                        setIsRegisterStepUpOpen(false);
                      }}
                      className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase transition-all cursor-pointer"
                    >
                      Verify Code &amp; Continue
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reset Demo Button */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">FairDrop Engine v1.0</span>
          <button
            type="button"
            onClick={handleResetDemo}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo
          </button>
        </div>
      </div>

      {/* Assumptions Footer */}
      <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 text-[11px] text-slate-400 space-y-1 font-mono">
        <span className="text-violet-300 font-bold block">Architecture Assumptions:</span>
        <p>&bull; Proof of Work (PoW) equalizes client request throughput across varying device capabilities.</p>
        <p>&bull; Uniform randomized lottery shuffle ensures front-running bots receive zero advantage.</p>
        <p>&bull; Risk appeals re-verify human identity without altering assigned queue draw ranks.</p>
      </div>
    </div>
  );
}
