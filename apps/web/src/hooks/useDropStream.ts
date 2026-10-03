'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSSEStream } from './useSSEStream';

export type DropStreamState =
  | 'SCHEDULED'
  | 'JOIN_WINDOW'
  | 'DRAWING'
  | 'ADMITTING'
  | 'ADMITTED'
  | 'SOLD_OUT';

export interface UseDropStreamReturn {
  state: DropStreamState;
  position: number | null;
  etaSec: number | null;
  admitted: boolean;
  total: number;
  connected: boolean;
  reconnecting: boolean;
  isMock: boolean;
  admittedCountdownSec: number;
}

export function useDropStream(options: { mockOverride?: boolean } = {}): UseDropStreamReturn {
  const searchParams = useSearchParams();
  const isMock =
    options.mockOverride ??
    (searchParams?.get('mock') === '1' || process.env.NEXT_PUBLIC_MOCK === '1');

  // Authoritative State
  const [state, setState] = useState<DropStreamState>('JOIN_WINDOW');
  const [position, setPosition] = useState<number | null>(412);
  const [etaSec, setEtaSec] = useState<number | null>(180);
  const [admitted, setAdmitted] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(50000);
  const [connected, setConnected] = useState<boolean>(true);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [admittedCountdownSec, setAdmittedCountdownSec] = useState<number>(600); // 10:00

  // Real SSE connection when NOT purely in mock mode
  const { status: sseStatus, lastMessage } = useSSEStream({
    autoConnect: !isMock,
    onQueueUpdate: (pos, eta) => {
      setPosition((prev) => {
        // Honest monotonic check: never jump backwards by more than real server value
        if (prev !== null && pos > prev + 5) return prev;
        return pos;
      });
      if (eta !== undefined) setEtaSec(eta);
    },
    onAdmitted: () => {
      setAdmitted(true);
      setState('ADMITTED');
    },
    onStatusChange: (status) => {
      if (status === 'connected') {
        setConnected(true);
        setReconnecting(false);
      } else if (status === 'connecting' || status === 'reconnecting') {
        setConnected(false);
        setReconnecting(true);
      } else {
        setConnected(false);
        setReconnecting(false);
      }
    }
  });

  // Handle incoming drop phase changes from SSE
  useEffect(() => {
    if (!lastMessage || isMock) return;
    if (lastMessage.event === 'DROP_PHASE' || lastMessage.event === 'STATE_CHANGE') {
      const serverPhase = lastMessage.data?.phase || lastMessage.data?.state;
      if (serverPhase && ['SCHEDULED', 'JOIN_WINDOW', 'DRAWING', 'ADMITTING', 'ADMITTED', 'SOLD_OUT'].includes(serverPhase)) {
        setState(serverPhase as DropStreamState);
      }
    }
    if (lastMessage.data?.total) {
      setTotal(lastMessage.data.total);
    }
  }, [lastMessage, isMock]);

  // Mock Mode: Feeds simulated stream (50,000 total, position decreasing, state transitions)
  useEffect(() => {
    if (!isMock) return;

    let mounted = true;
    let currentPos = 450;
    let timer: NodeJS.Timeout;

    // Simulate state transitions if desired: SCHEDULED -> JOIN_WINDOW -> DRAWING -> ADMITTING
    // We start at JOIN_WINDOW by default for immediate waiting-room delight
    const stepSimulation = () => {
      if (!mounted) return;

      currentPos = Math.max(1, currentPos - Math.floor(Math.random() * 8 + 4));
      setPosition(currentPos);

      // ETA scales with position: ~2.5s per rank
      const newEta = Math.max(10, Math.round(currentPos * 0.45));
      setEtaSec(newEta);

      if (currentPos <= 5) {
        setAdmitted(true);
        setState('ADMITTED');
      }

      timer = setTimeout(stepSimulation, 1500);
    };

    timer = setTimeout(stepSimulation, 1500);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isMock]);

  // Admitted countdown timer: 10:00 countdown to choose seats
  useEffect(() => {
    if (state !== 'ADMITTED') return;
    const interval = setInterval(() => {
      setAdmittedCountdownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [state]);

  return {
    state,
    position,
    etaSec,
    admitted,
    total,
    connected: isMock ? true : connected,
    reconnecting: isMock ? false : reconnecting,
    isMock,
    admittedCountdownSec
  };
}
