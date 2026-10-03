import { DropPhase, PoWSolution, CheckoutResponse } from '@fairdrop/shared';
import { generateUUID } from './utils';

export interface UserSessionState {
  clientId: string;
  fingerprint: string;
  eventId: string;
  phase: DropPhase;
  joinedWaitingRoomAt: number | null;
  powSolution: PoWSolution | null;
  queuePosition: number | null;
  totalInQueue: number;
  reservationToken: string | null;
  seatNumber: number | null;
  reservationExpiresAt: number | null;
  idempotencyKey: string;
  receipt: CheckoutResponse | null;
  lastUpdated: number;
}

const STORAGE_KEY = 'fairdrop_user_session_v1';

function computeSimpleFingerprint(): string {
  if (typeof window === 'undefined') return 'server-prerender-fingerprint';
  const nav = window.navigator;
  const screen = window.screen;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');

  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fp-${Math.abs(hash).toString(16)}-${nav.language || 'en'}`;
}

export function getInitialSessionState(eventId = 'fairdrop-main-2026'): UserSessionState {
  return {
    clientId: `usr_${generateUUID().slice(0, 12)}`,
    fingerprint: computeSimpleFingerprint(),
    eventId,
    phase: 'WAITING_ROOM',
    joinedWaitingRoomAt: null,
    powSolution: null,
    queuePosition: null,
    totalInQueue: 0,
    reservationToken: null,
    seatNumber: null,
    reservationExpiresAt: null,
    idempotencyKey: generateUUID(),
    receipt: null,
    lastUpdated: Date.now()
  };
}

export class SessionManager {
  static load(eventId = 'fairdrop-main-2026'): UserSessionState {
    if (typeof window === 'undefined') return getInitialSessionState(eventId);

    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${eventId}`);
      if (!raw) {
        const initial = getInitialSessionState(eventId);
        this.save(initial);
        return initial;
      }
      const parsed: UserSessionState = JSON.parse(raw);

      // Verify if reservation has already expired
      if (parsed.reservationExpiresAt && parsed.reservationExpiresAt < Date.now() && !parsed.receipt) {
        parsed.reservationToken = null;
        parsed.seatNumber = null;
        parsed.reservationExpiresAt = null;
      }

      return parsed;
    } catch {
      const fallback = getInitialSessionState(eventId);
      return fallback;
    }
  }

  static save(state: UserSessionState): void {
    if (typeof window === 'undefined') return;
    try {
      const toSave = { ...state, lastUpdated: Date.now() };
      localStorage.setItem(`${STORAGE_KEY}_${state.eventId}`, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save session to localStorage', e);
    }
  }

  static update(
    currentState: UserSessionState,
    patch: Partial<UserSessionState>
  ): UserSessionState {
    const updated: UserSessionState = {
      ...currentState,
      ...patch,
      lastUpdated: Date.now()
    };
    this.save(updated);
    return updated;
  }

  static reset(eventId = 'fairdrop-main-2026'): UserSessionState {
    const fresh = getInitialSessionState(eventId);
    this.save(fresh);
    return fresh;
  }
}
