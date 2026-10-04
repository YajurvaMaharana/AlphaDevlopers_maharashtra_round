'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Key, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Zap, Globe } from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_GOOGLE_CLIENT_ID = '857434670407-mf6tg4rh3jgkvt20psujr2jqg3d6640m.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('fan@example.com');
  const [step, setStep] = useState<'REGISTER' | 'VERIFY' | 'SUCCESS'>('REGISTER');
  const [otp, setOtp] = useState('123456');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [isNonLocalhost, setIsNonLocalhost] = useState(false);
  const [userResult, setUserResult] = useState<{
    id: string;
    email: string;
    riskTier: string;
    fairId?: string;
    authMethod?: string;
    token: string;
  } | null>(null);

  const googleButtonContainerRef = useRef<HTMLDivElement>(null);

  // Check window origin to detect iframe / Cloud Run environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (!origin.includes('localhost:3000') && !origin.includes('127.0.0.1:3000')) {
        setIsNonLocalhost(true);
      }
    }
  }, []);

  // Load Google Identity Services (GIS)
  useEffect(() => {
    const googleClientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;

    // Handler for credential response from Google
    const handleCredentialResponse = async (response: { credential?: string }) => {
      if (!response.credential) {
        setGoogleError('No credential received from Google sign-in.');
        return;
      }
      await processGoogleAuth(response.credential);
    };

    // Load GIS script dynamically
    const scriptId = 'google-gis-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initializeGis = () => {
      if (window.google?.accounts?.id && googleButtonContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          window.google.accounts.id.renderButton(googleButtonContainerRef.current, {
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 340,
          });
        } catch (err) {
          console.warn('Google Identity Services initialization notice:', err);
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGis;
      document.body.appendChild(script);
    } else if (window.google?.accounts?.id) {
      initializeGis();
    }
  }, []);

  // Process Google token through POST /auth/google
  const processGoogleAuth = async (idToken: string) => {
    setIsGoogleLoading(true);
    setError(null);
    setGoogleError(null);

    try {
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      const res = await api.auth.google({
        idToken,
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
        authMethod: res.user.authMethod || 'google',
        token: res.token,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      const errMsg = err?.message || 'Google sign-in failed. Please use email code instead.';
      setGoogleError(errMsg);
      setError('Google authentication was unsuccessful. You can continue below with email verification or Instant Demo FairID.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Instant Demo FairID Sign-in (handles cross-origin iframe / demo test environments)
  const handleInstantDemoSignIn = async () => {
    setIsLoading(true);
    setError(null);
    setGoogleError(null);

    try {
      const { collectSignals } = await import('@/lib/signals');
      const signals = await collectSignals();

      const res = await api.auth.verify({
        email: 'demo.fan@fairdrop.io',
        otp: '123456',
        clientFingerprint: signals.deviceFp,
        signals: {
          deviceFp: signals.deviceFp,
          behaviorScore: signals.behaviorScore,
          features: signals.features,
        },
      });

      setUserResult({
        ...res.user,
        fairId: res.user.fairId,
        authMethod: 'otp',
        token: res.token,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err?.message || 'Instant demo authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger Google sign-in (Mock / fallback trigger)
  const handleGoogleClick = async () => {
    const mockToken = `mock_google_token_sub_${Date.now()}_fan`;
    await processGoogleAuth(mockToken);
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

      setUserResult({
        ...res.user,
        fairId: res.user.fairId,
        authMethod: res.user.authMethod || 'otp',
        token: res.token,
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
          Authenticate identity to establish FairID and receive lottery allotment.
        </p>
      </div>

      <div className="glass-panel-violet rounded-3xl p-6 sm:p-8 space-y-6">
        {/* Environment / Cross-Origin Testing Banner */}
        {isNonLocalhost && step === 'REGISTER' && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-amber-300 font-semibold">
              <Globe className="w-4 h-4 shrink-0" />
              <span>Preview / Cloud Environment Detected</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Google OAuth restricts popups from third-party preview iframes. You can use instant demo sign-in to test complete FairID lottery flows without OAuth restrictions:
            </p>
            <button
              type="button"
              onClick={handleInstantDemoSignIn}
              disabled={isLoading || isGoogleLoading}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-current" />
              Sign in with Demo FairID (Instant OTP 123456)
            </button>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-bad/10 border border-bad/30 text-bad text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{error}</p>
              {googleError && (
                <p className="text-[11px] opacity-90 mt-0.5">{googleError}</p>
              )}
            </div>
          </div>
        )}

        {step === 'REGISTER' && (
          <div className="space-y-6">
            {/* Primary Google Auth Action */}
            <div className="space-y-3">
              <label className="text-xs font-mono text-slate-400 block text-center">
                RECOMMENDED: FAST-TRACK IDENTITY
              </label>

              {/* Rendered Google Identity Services Button */}
              <div ref={googleButtonContainerRef} className="flex justify-center empty:hidden" />

              {/* Native / Mock Google Button */}
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
                disabled={isLoading || isGoogleLoading}
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
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-good/20 border border-good/40 text-good flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white">Identity Verified</h3>

            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-left space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">User ID:</span>
                <span className="font-mono text-slate-200">{userResult.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-200">{userResult.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Auth Method:</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 capitalize">
                  {userResult.authMethod || 'google'}
                </span>
              </div>
              {userResult.fairId && (
                <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                  <span className="text-slate-400 text-[10px] font-mono">DETERMINISTIC FAIRID:</span>
                  <span className="font-mono text-[10px] text-slate-300 break-all bg-black/40 p-1.5 rounded-lg border border-white/5">
                    {userResult.fairId}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-white/5">
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
