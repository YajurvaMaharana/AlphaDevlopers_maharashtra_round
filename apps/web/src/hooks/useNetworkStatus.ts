'use client';

import { useState, useEffect } from 'react';
import { SSEConnectionStatus } from '@/lib/sse-client';

export interface NetworkStatus {
  isOnline: boolean;
  sseStatus: SSEConnectionStatus;
  isReconnecting: boolean;
  isDegraded: boolean;
  lastOnlineAt: number | null;
  lastOfflineAt: number | null;
}

export function useNetworkStatus(sseStatus: SSEConnectionStatus = 'connected'): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [lastOfflineAt, setLastOfflineAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(Date.now());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(Date.now());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveSseStatus: SSEConnectionStatus = !isOnline ? 'offline' : sseStatus;
  const isReconnecting = isOnline && (sseStatus === 'connecting' || sseStatus === 'reconnecting');
  const isDegraded = !isOnline || isReconnecting;

  return {
    isOnline,
    sseStatus: effectiveSseStatus,
    isReconnecting,
    isDegraded,
    lastOnlineAt,
    lastOfflineAt,
  };
}
