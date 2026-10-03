'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HoldState } from '@fairdrop/shared';

export interface HoldCountdownResult {
  remainingSeconds: number;
  formattedTime: string;
  isExpired: boolean;
  progressPercent: number; // 0 to 100
}

/**
 * High-precision Hold Countdown Hook with clock-drift correction
 * Detects expiration while tab was inactive, minimized, or offline.
 */
export function useHoldCountdown(
  hold: HoldState | null,
  totalWindowSeconds = 120,
  onExpired?: () => void
): HoldCountdownResult {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!hold) return 0;
    const diff = Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
    return diff;
  });

  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const expiredFiredRef = useRef(false);

  const calculateRemaining = useCallback(() => {
    if (!hold) return 0;
    const now = Date.now();
    const diff = Math.floor((hold.expiresAt - now) / 1000);
    return Math.max(0, diff);
  }, [hold]);

  useEffect(() => {
    if (!hold) {
      setRemainingSeconds(0);
      expiredFiredRef.current = false;
      return;
    }

    expiredFiredRef.current = false;
    const initial = calculateRemaining();
    setRemainingSeconds(initial);

    if (initial <= 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpiredRef.current?.();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        clearInterval(interval);
        onExpiredRef.current?.();
      }
    }, 500);

    // Also recalculate immediately on page visibility change or online resume
    const handleVisibilityOrResume = () => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        clearInterval(interval);
        onExpiredRef.current?.();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrResume);
    window.addEventListener('focus', handleVisibilityOrResume);
    window.addEventListener('online', handleVisibilityOrResume);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityOrResume);
      window.removeEventListener('focus', handleVisibilityOrResume);
      window.removeEventListener('online', handleVisibilityOrResume);
    };
  }, [hold, calculateRemaining]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isExpired = !hold || remainingSeconds <= 0;
  const progressPercent = hold
    ? Math.min(100, Math.max(0, (remainingSeconds / totalWindowSeconds) * 100))
    : 0;

  return {
    remainingSeconds,
    formattedTime,
    isExpired,
    progressPercent,
  };
}
