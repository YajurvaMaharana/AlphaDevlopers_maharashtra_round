'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ResilientSSEClient, SSEConnectionStatus, SSEMessage } from '@/lib/sse-client';

export interface UseSSEStreamOptions {
  url?: string;
  autoConnect?: boolean;
  onQueueUpdate?: (position: number, etaSec?: number) => void;
  onAdmitted?: () => void;
  onHoldUpdate?: (hold: { holdId: string; expiresAt: number }) => void;
  onStatusChange?: (status: SSEConnectionStatus) => void;
}

export function useSSEStream(options: UseSSEStreamOptions = {}) {
  const {
    url = (process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1') 
      ? '/drop/stream' 
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/drop/stream`,
    autoConnect = true,
    onQueueUpdate,
    onAdmitted,
    onHoldUpdate,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<SSEConnectionStatus>('connecting');
  const [lastEventId, setLastEventId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<SSEMessage | null>(null);

  const clientRef = useRef<ResilientSSEClient | null>(null);
  const callbacksRef = useRef({ onQueueUpdate, onAdmitted, onHoldUpdate, onStatusChange });
  callbacksRef.current = { onQueueUpdate, onAdmitted, onHoldUpdate, onStatusChange };

  const handleMessage = useCallback((msg: SSEMessage) => {
    setLastMessage(msg);
    if (msg.id) setLastEventId(msg.id);

    // Map common SSE events to application callbacks
    switch (msg.event) {
      case 'QUEUE_UPDATE':
      case 'QUEUE_POSITION': {
        const pos = msg.data?.position ?? msg.data?.rank;
        const eta = msg.data?.etaSec ?? msg.data?.estimatedWaitSeconds;
        if (typeof pos === 'number') {
          callbacksRef.current.onQueueUpdate?.(pos, eta);
        }
        break;
      }
      case 'ADMITTED':
      case 'TURN_READY':
        callbacksRef.current.onAdmitted?.();
        break;

      case 'HOLD_UPDATE':
      case 'RESERVATION_HOLD':
        if (msg.data?.holdId && msg.data?.expiresAt) {
          callbacksRef.current.onHoldUpdate?.({
            holdId: msg.data.holdId,
            expiresAt: msg.data.expiresAt,
          });
        }
        break;

      default:
        break;
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: SSEConnectionStatus) => {
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  useEffect(() => {
    if (!autoConnect || typeof window === 'undefined') return;

    const token = localStorage.getItem('fairdrop_auth_token');
    
    let streamUrl = url;
    if (token) {
      // Add token to query param for EventSource
      const u = new URL(url, window.location.origin);
      u.searchParams.set('token', token);
      streamUrl = u.toString();
    }

    const eventSource = new EventSource(streamUrl);
    handleStatusChange('connecting');

    eventSource.onopen = () => {
      handleStatusChange('connected');
    };

    const handleEvent = (eventName: string) => (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        handleMessage({
          id: e.lastEventId,
          event: eventName,
          data: parsed,
          raw: e.data
        });
      } catch (err) {}
    };

    eventSource.onmessage = handleEvent('message');
    eventSource.addEventListener('QUEUE_UPDATE', handleEvent('QUEUE_UPDATE'));
    eventSource.addEventListener('QUEUE_POSITION', handleEvent('QUEUE_POSITION'));
    eventSource.addEventListener('ADMITTED', handleEvent('ADMITTED'));
    eventSource.addEventListener('TURN_READY', handleEvent('TURN_READY'));
    eventSource.addEventListener('HOLD_UPDATE', handleEvent('HOLD_UPDATE'));
    eventSource.addEventListener('RESERVATION_HOLD', handleEvent('RESERVATION_HOLD'));
    eventSource.addEventListener('DROP_STATUS', handleEvent('DROP_STATUS'));

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        handleStatusChange('offline');
      } else {
        handleStatusChange('reconnecting');
      }
    };

    (clientRef as any).current = {
      disconnect: () => eventSource.close(),
      connect: () => {} // EventSource auto-reconnects
    };

    return () => {
      eventSource.close();
    };
  }, [url, autoConnect, handleStatusChange, handleMessage]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      (clientRef.current as any).disconnect();
      // Re-triggering useEffect might require a state toggle if we wanted manual reconnect, 
      // but EventSource auto-reconnects.
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      (clientRef.current as any).disconnect();
    }
  }, []);

  return {
    status,
    lastEventId,
    lastMessage,
    reconnect,
    disconnect,
  };
}
