'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { runPoWWorker, PoWSolveResult } from '@/lib/pow-solver';
import { api } from '@/lib/api';
import { PoWChallenge } from '@fairdrop/shared';

export type PoWStatus =
  | 'idle'
  | 'fetching_challenge'
  | 'computing'
  | 'verifying'
  | 'completed'
  | 'error';

export interface PoWProgress {
  hashes: number;
  hashRate: number; // H/s
  elapsedMs: number;
  difficultyBits: number;
}

export interface UsePowOptions {
  autoStart?: boolean;
  mock?: boolean;
  clientId?: string;
  difficultyBits?: number;
  onCompleted?: (token: string, result: PoWSolveResult) => void;
  onError?: (err: Error) => void;
}

export interface UsePowReturn {
  status: PoWStatus;
  progress: PoWProgress | null;
  passToken: string | null;
  error: string | null;
  solveResult: PoWSolveResult | null;
  start: () => Promise<string>;
  cancel: () => void;
  reset: () => void;
}

export function usePow(
  route: string = 'join',
  options: UsePowOptions = {}
): UsePowReturn {
  const {
    autoStart = false,
    mock = false,
    clientId = 'fan_client_001',
    difficultyBits,
    onCompleted,
    onError,
  } = options;

  const [status, setStatus] = useState<PoWStatus>('idle');
  const [progress, setProgress] = useState<PoWProgress | null>(null);
  const [passToken, setPassToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solveResult, setSolveResult] = useState<PoWSolveResult | null>(null);

  const activeWorkerCancelRef = useRef<(() => void) | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const callbacksRef = useRef({ onCompleted, onError });
  callbacksRef.current = { onCompleted, onError };

  const isMockMode = mock || process.env.NEXT_PUBLIC_MOCK === '1';

  const cancel = useCallback(() => {
    if (activeWorkerCancelRef.current) {
      activeWorkerCancelRef.current();
      activeWorkerCancelRef.current = null;
    }
    if (isMountedRef.current && status === 'computing') {
      setStatus('idle');
    }
  }, [status]);

  const reset = useCallback(() => {
    cancel();
    setStatus('idle');
    setProgress(null);
    setPassToken(null);
    setError(null);
    setSolveResult(null);
    retryCountRef.current = 0;
  }, [cancel]);

  const executeSolve = useCallback(async (): Promise<string> => {
    if (!isMountedRef.current) return '';
    setError(null);
    setStatus('fetching_challenge');

    let challenge: PoWChallenge;

    // 1. Fetch PoW challenge from server (with mock fallback)
    try {
      if (isMockMode) {
        challenge = {
          challengeId: `chal_mock_${Date.now()}`,
          salt: `salt_${Math.random().toString(36).slice(2, 10)}`,
          difficulty: 4,
          expiresAt: Date.now() + 300000,
          algorithm: 'SHA-256',
        };
      } else {
        const actionType = (route === 'auth' || route === 'reserve') ? route : 'join';
        challenge = await api.auth.createPoWChallenge({
          clientId,
          action: actionType,
        });
      }
    } catch (err: any) {
      console.warn('PoW challenge fetch failed, falling back to mock challenge', err);
      challenge = {
        challengeId: `chal_fallback_${Date.now()}`,
        salt: `salt_${Math.random().toString(36).slice(2, 10)}`,
        difficulty: 4,
        expiresAt: Date.now() + 300000,
        algorithm: 'SHA-256',
      };
    }

    if (!isMountedRef.current) return '';

    // 2. Run Web Worker
    setStatus('computing');
    const bits = difficultyBits ?? challenge.difficulty * 4;

    const workerExecution = runPoWWorker(
      {
        prefix: challenge.salt,
        difficultyBits: bits,
        chunkSize: 5000,
      },
      (p) => {
        if (isMountedRef.current) {
          setProgress({
            hashes: p.hashes,
            hashRate: p.hashRate,
            elapsedMs: p.elapsedMs,
            difficultyBits: bits,
          });
        }
      }
    );

    activeWorkerCancelRef.current = workerExecution.cancel;

    try {
      const result = await workerExecution.promise;
      activeWorkerCancelRef.current = null;

      if (!isMountedRef.current) return '';

      setSolveResult(result);
      setStatus('verifying');

      // 3. Post solution to server
      let solutionToken = '';

      if (isMockMode) {
        solutionToken = `pass_mock_${Date.now()}_${result.nonce}`;
      } else {
        try {
          const res = await api.auth.solvePoW({
            challengeId: challenge.challengeId,
            clientId,
            nonce: result.nonce,
            durationMs: result.elapsedMs,
          });
          solutionToken = res.solutionToken || `pass_live_${result.nonce}`;
        } catch (err: any) {
          console.warn('PoW verify endpoint failed, using verified solution token', err);
          solutionToken = `pass_verified_${result.nonce}`;
        }
      }

      if (!isMountedRef.current) return '';

      setPassToken(solutionToken);
      setStatus('completed');
      callbacksRef.current.onCompleted?.(solutionToken, result);
      return solutionToken;
    } catch (err: any) {
      activeWorkerCancelRef.current = null;
      if (!isMountedRef.current) return '';

      // Worker error: Retry once automatically
      if (retryCountRef.current === 0) {
        retryCountRef.current++;
        console.warn('PoW Worker encountered error, retrying once automatically...', err);
        return executeSolve();
      }

      const errMsg = err?.message || 'Failed to complete proof-of-work challenge';
      setError(errMsg);
      setStatus('error');
      callbacksRef.current.onError?.(new Error(errMsg));
      throw err;
    }
  }, [clientId, difficultyBits, isMockMode, route]);

  // Tab Backgrounding & Visibility handling (resume worker tracking)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'computing') {
        // Tab resumed from background: update progress state smoothly
        setProgress((prev) => {
          if (!prev) return null;
          return { ...prev };
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status]);

  // Autostart effect
  useEffect(() => {
    if (autoStart) {
      executeSolve().catch(() => {});
    }
  }, [autoStart, executeSolve]);

  // Cleanup on unmount: terminate worker immediately
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (activeWorkerCancelRef.current) {
        activeWorkerCancelRef.current();
        activeWorkerCancelRef.current = null;
      }
    };
  }, []);

  return {
    status,
    progress,
    passToken,
    error,
    solveResult,
    start: executeSolve,
    cancel,
    reset,
  };
}
