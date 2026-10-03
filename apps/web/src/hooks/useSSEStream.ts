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
    url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/drop/stream`,
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
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const client = new ResilientSSEClient({
      url,
      headers,
      baseDelayMs: 1000,
      maxDelayMs: 25000,
      onStatusChange: handleStatusChange,
      onMessage: handleMessage,
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.destroy();
      clientRef.current = null;
    };
  }, [url, autoConnect, handleStatusChange, handleMessage]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    status,
    lastEventId,
    lastMessage,
    reconnect,
    disconnect,
  };
}
