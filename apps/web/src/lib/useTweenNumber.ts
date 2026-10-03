'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseTweenNumberOptions {
  durationMs?: number;
  easing?: (t: number) => number;
  decimals?: number;
}

// Cubic ease-out
const defaultEaseOut = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * useTweenNumber
 * Smoothly interpolates a numeric value toward targetValue using requestAnimationFrame.
 * Honors monotonic honest updates without sudden jumps.
 */
export function useTweenNumber(
  targetValue: number,
  options: UseTweenNumberOptions = {}
): number {
  const { durationMs = 800, easing = defaultEaseOut, decimals = 0 } = options;

  const [displayValue, setDisplayValue] = useState<number>(targetValue);
  const startValueRef = useRef<number>(targetValue);
  const targetValueRef = useRef<number>(targetValue);
  const startTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // If the target has changed, initiate new tween from current display value
    if (targetValue === targetValueRef.current) return;

    startValueRef.current = displayValue;
    targetValueRef.current = targetValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(1, Math.max(0, elapsed / durationMs));
      const easedProgress = easing(progress);

      const nextVal =
        startValueRef.current +
        (targetValueRef.current - startValueRef.current) * easedProgress;

      const factor = Math.pow(10, decimals);
      const rounded = Math.round(nextVal * factor) / factor;
      setDisplayValue(rounded);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValueRef.current);
      }
    };

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [targetValue, durationMs, easing, decimals, displayValue]);

  return displayValue;
}
