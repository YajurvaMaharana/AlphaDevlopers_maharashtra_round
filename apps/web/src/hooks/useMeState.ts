'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UserStateResponse, ClientFlowStep } from '@fairdrop/shared';

export interface UseMeStateReturn {
  user: UserStateResponse | null;
  step: ClientFlowStep;
  tier: string;
  isVerified: boolean;
  isLoading: boolean;
  isTokenExpired: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMeState(): UseMeStateReturn {
  const router = useRouter();
  const [user, setUser] = useState<UserStateResponse | null>(null);
  const [step, setStep] = useState<ClientFlowStep>('waiting');
  const [tier, setTier] = useState<string>('Tier 1: Minimal Risk');
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTokenExpired, setIsTokenExpired] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('fairdrop_auth_token') : null;
      const data = await api.auth.getState(token || undefined);

      setUser(data);
      if (data.step) setStep(data.step as ClientFlowStep);
      if (data.tier || data.riskTier) setTier(data.tier || data.riskTier || 'Tier 1: Minimal Risk');
      setIsVerified(true);
      setIsTokenExpired(false);
    } catch (err: any) {
      if (err?.code === 'UNAUTHORIZED' || err?.status === 401 || err?.message?.includes('expired')) {
        setIsTokenExpired(true);
        setIsVerified(false);
      } else {
        // Fallback for mock/demo offline resilience
        setUser({
          userId: 'usr_mock_001',
          email: 'fan@fairdrop.dev',
          step: 'waiting',
          queuePosition: 412,
          position: 412,
          etaSec: 180,
          tier: 'low',
          riskTier: 'low',
          allocation: 1
        });
        setIsVerified(true);
      }
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return {
    user,
    step,
    tier,
    isVerified,
    isLoading,
    isTokenExpired,
    error,
    refresh: fetchState
  };
}
