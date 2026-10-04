'use client';

import { useReducer, useEffect, useRef, useCallback } from 'react';
import {
  clientMachineReducer,
  INITIAL_CONTEXT,
  ClientContext,
  ClientEvent
} from '@/lib/client-machine';
import { TabSyncManager } from '@/lib/tab-sync';
import { api } from '@/lib/api';
import { HoldState } from '@fairdrop/shared';

export interface UseClientMachineReturn {
  state: ClientContext;
  dispatch: React.Dispatch<ClientEvent>;
  // Action helpers
  bootstrap: () => Promise<void>;
  verifyOtp: (userId: string, email: string, token: string, tier?: 'low' | 'medium' | 'high') => void;
  requestJoin: () => void;
  enterWaitingRoom: (position?: number, etaSec?: number) => void;
  updateQueue: (position: number, etaSec?: number) => void;
  admitTurn: () => void;
  reserveSeat: (ticketId: string, hold: HoldState, allocation?: number) => void;
  initiatePayment: () => void;
  confirmPayment: (receiptId: string) => void;
  failPayment: (code: string, message: string) => void;
  expireHold: () => void;
  retryPayment: () => void;
  resetFlow: () => void;
}

export function useClientMachine(): UseClientMachineReturn {
  const [state, dispatch] = useReducer(clientMachineReducer, INITIAL_CONTEXT);
  const tabSyncRef = useRef<TabSyncManager | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Hydrate exact server state on initial load
  const bootstrap = useCallback(async () => {
    dispatch({ type: 'BOOTSTRAP_START' });

    try {
      // 1. Check local session token if any
      const token = typeof window !== 'undefined' ? localStorage.getItem('fairdrop_auth_token') : null;

      // 2. Query GET /me/state from server
      const serverState = await api.auth.getState(token || undefined);

      // Normalize hold structure
      let holdPayload: HoldState | null = null;
      if (serverState.hold) {
        holdPayload = serverState.hold;
      } else if (serverState.reservation) {
        holdPayload = {
          holdId: serverState.reservation.reservationId,
          expiresAt: serverState.reservation.expiresAt,
        };
      }

      dispatch({
        type: 'BOOTSTRAP_SUCCESS',
        payload: {
          step: serverState.step,
          userId: serverState.userId,
          email: serverState.email,
          ticketId: serverState.ticketId || (serverState.reservation ? `tkt_${serverState.reservation.seatNumber}` : null),
          position: serverState.position ?? serverState.queuePosition ?? null,
          etaSec: serverState.etaSec ?? serverState.estimatedWaitSeconds ?? null,
          hold: holdPayload,
          allocation: serverState.allocation ?? 1,
          tier: serverState.tier || serverState.riskTier || 'low',
          gate: serverState.gate || 'open',
          receiptId: serverState.receiptId,
        },
      });
    } catch (err: any) {
      if (err?.code === 'UNAUTHORIZED' || err?.status === 401) {
        dispatch({ type: 'BOOTSTRAP_UNAUTHORIZED' });
      } else {
        // If server is temporarily unreachable, maintain cached state with warning
        dispatch({
          type: 'SET_ERROR',
          payload: {
            code: err?.code || 'NETWORK_ERROR',
            message: err?.message || 'Unable to sync state with server',
          },
        });
      }
    }
  }, []);

  // Multi-tab synchronization via BroadcastChannel
  useEffect(() => {
    tabSyncRef.current = new TabSyncManager((msg) => {
      if (msg.type === 'TAB_STATE_BROADCAST') {
        dispatch({
          type: 'SYNC_SERVER_STATE',
          payload: msg.state,
        });
      }
    });

    // Run initial bootstrap on mount
    bootstrap();

    return () => {
      tabSyncRef.current?.destroy();
    };
  }, [bootstrap]);

  // Broadcast state changes across tabs whenever critical state changes
  useEffect(() => {
    if (!state.isSyncing && tabSyncRef.current) {
      tabSyncRef.current.broadcastState(state);
    }
  }, [
    state.step,
    state.position,
    state.etaSec,
    state.hold?.holdId,
    state.hold?.expiresAt,
    state.receiptId,
    state.idempotencyKey,
  ]);

  // Handle browser back-button & page unload guards
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.step === 'reserved' || state.step === 'paying') {
        e.preventDefault();
        e.returnValue = 'You have an active seat reservation! Leaving may release your hold.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.step]);

  // Helper action dispatchers
  const verifyOtp = useCallback((userId: string, email: string, token: string, tier: 'low' | 'medium' | 'high' = 'low') => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fairdrop_auth_token', token);
    }
    dispatch({ type: 'OTP_VERIFIED', payload: { userId, email, token, tier } });
  }, []);

  const requestJoin = useCallback(() => {
    dispatch({ type: 'JOIN_REQUESTED' });
  }, []);

  const enterWaitingRoom = useCallback((position?: number, etaSec?: number) => {
    dispatch({ type: 'WAITING_ROOM_ENTERED', payload: { position, etaSec } });
  }, []);

  const updateQueue = useCallback((position: number, etaSec?: number) => {
    dispatch({ type: 'QUEUE_UPDATE', payload: { position, etaSec } });
  }, []);

  const admitTurn = useCallback(() => {
    dispatch({ type: 'TURN_ADMITTED' });
  }, []);

  const reserveSeat = useCallback((ticketId: string, hold: HoldState, allocation?: number) => {
    dispatch({ type: 'SEAT_RESERVED', payload: { ticketId, hold, allocation } });
  }, []);

  const initiatePayment = useCallback(() => {
    dispatch({ type: 'PAYMENT_INITIATED' });
  }, []);

  const confirmPayment = useCallback((receiptId: string) => {
    dispatch({ type: 'PAYMENT_SUCCESS', payload: { receiptId } });
  }, []);

  const failPayment = useCallback((code: string, message: string) => {
    dispatch({ type: 'PAYMENT_FAILED', payload: { code, message } });
  }, []);

  const expireHold = useCallback(() => {
    dispatch({ type: 'HOLD_EXPIRED' });
  }, []);

  const retryPayment = useCallback(() => {
    dispatch({ type: 'RETRY_PAYMENT' });
  }, []);

  const resetFlow = useCallback(() => {
    dispatch({ type: 'RESET_FLOW' });
  }, []);

  return {
    state,
    dispatch,
    bootstrap,
    verifyOtp,
    requestJoin,
    enterWaitingRoom,
    updateQueue,
    admitTurn,
    reserveSeat,
    initiatePayment,
    confirmPayment,
    failPayment,
    expireHold,
    retryPayment,
    resetFlow,
  };
}
