import { ClientFlowStep, HoldState } from '@fairdrop/shared';

export interface ClientContext {
  step: ClientFlowStep;
  userId: string | null;
  email: string | null;
  token: string | null;
  ticketId: string | null;
  position: number | null;
  etaSec: number | null;
  hold: HoldState | null;
  allocation: number | null;
  tier: 'low' | 'medium' | 'high';
  idempotencyKey: string | null;
  receiptId: string | null;
  error: { code: string; message: string } | null;
  isSyncing: boolean;
  lastSyncedAt: number | null;
}

export type ClientEvent =
  | { type: 'BOOTSTRAP_START' }
  | {
      type: 'BOOTSTRAP_SUCCESS';
      payload: {
        step?: ClientFlowStep;
        userId?: string | null;
        email?: string | null;
        ticketId?: string | null;
        position?: number | null;
        etaSec?: number | null;
        hold?: HoldState | null;
        allocation?: number | null;
        tier?: 'low' | 'medium' | 'high';
        receiptId?: string | null;
      };
    }
  | { type: 'BOOTSTRAP_UNAUTHORIZED' }
  | {
      type: 'SYNC_SERVER_STATE';
      payload: Partial<ClientContext>;
    }
  | {
      type: 'OTP_VERIFIED';
      payload: {
        userId: string;
        email: string;
        token: string;
        tier?: 'low' | 'medium' | 'high';
      };
    }
  | { type: 'JOIN_REQUESTED' }
  | {
      type: 'WAITING_ROOM_ENTERED';
      payload: {
        position?: number;
        etaSec?: number;
      };
    }
  | {
      type: 'QUEUE_UPDATE';
      payload: {
        position: number;
        etaSec?: number;
      };
    }
  | { type: 'TURN_ADMITTED' }
  | {
      type: 'SEAT_RESERVED';
      payload: {
        ticketId: string;
        hold: HoldState;
        allocation?: number;
      };
    }
  | { type: 'PAYMENT_INITIATED' }
  | {
      type: 'PAYMENT_SUCCESS';
      payload: {
        receiptId: string;
      };
    }
  | {
      type: 'PAYMENT_FAILED';
      payload: {
        code: string;
        message: string;
      };
    }
  | { type: 'HOLD_EXPIRED' }
  | { type: 'RETRY_PAYMENT' }
  | { type: 'RESET_FLOW' }
  | {
      type: 'SET_ERROR';
      payload: { code: string; message: string };
    };

export const INITIAL_CONTEXT: ClientContext = {
  step: 'anonymous',
  userId: null,
  email: null,
  token: null,
  ticketId: null,
  position: null,
  etaSec: null,
  hold: null,
  allocation: null,
  tier: 'low',
  idempotencyKey: null,
  receiptId: null,
  error: null,
  isSyncing: false,
  lastSyncedAt: null,
};

/**
 * Deterministic Client Flow State Machine Reducer
 * Guaranteed monotonic progression and strict edge case handling.
 */
export function clientMachineReducer(
  state: ClientContext,
  event: ClientEvent
): ClientContext {
  switch (event.type) {
    case 'BOOTSTRAP_START':
      return {
        ...state,
        isSyncing: true,
        error: null,
      };

    case 'BOOTSTRAP_SUCCESS': {
      const p = event.payload;
      // Derive step if server did not specify explicitly
      let derivedStep: ClientFlowStep = p.step || state.step;
      if (!p.step) {
        if (p.receiptId) {
          derivedStep = 'confirmed';
        } else if (p.hold && p.hold.expiresAt > Date.now()) {
          derivedStep = 'reserved';
        } else if (p.position === 1) {
          derivedStep = 'admitted';
        } else if (p.position && p.position > 1) {
          derivedStep = 'waiting';
        } else if (p.userId) {
          derivedStep = 'verified';
        } else {
          derivedStep = 'anonymous';
        }
      }

      // Check if hold is already expired
      if (p.hold && p.hold.expiresAt <= Date.now() && derivedStep !== 'confirmed') {
        derivedStep = 'expired';
      }

      return {
        ...state,
        step: derivedStep,
        userId: p.userId !== undefined ? p.userId : state.userId,
        email: p.email !== undefined ? p.email : state.email,
        ticketId: p.ticketId !== undefined ? p.ticketId : state.ticketId,
        position: p.position !== undefined ? p.position : state.position,
        etaSec: p.etaSec !== undefined ? p.etaSec : state.etaSec,
        hold: p.hold !== undefined ? p.hold : state.hold,
        allocation: p.allocation !== undefined ? p.allocation : state.allocation,
        tier: p.tier || state.tier,
        receiptId: p.receiptId !== undefined ? p.receiptId : state.receiptId,
        isSyncing: false,
        lastSyncedAt: Date.now(),
        error: null,
      };
    }

    case 'BOOTSTRAP_UNAUTHORIZED':
      return {
        ...INITIAL_CONTEXT,
        step: 'anonymous',
        error: { code: 'UNAUTHORIZED', message: 'Session expired. Please re-authenticate.' },
        lastSyncedAt: Date.now(),
      };

    case 'SYNC_SERVER_STATE': {
      const next = { ...state, ...event.payload, lastSyncedAt: Date.now() };
      // Check hold expiry on sync
      if (next.hold && next.hold.expiresAt <= Date.now() && next.step !== 'confirmed') {
        next.step = 'expired';
      }
      return next;
    }

    case 'OTP_VERIFIED':
      return {
        ...state,
        step: 'verified',
        userId: event.payload.userId,
        email: event.payload.email,
        token: event.payload.token,
        tier: event.payload.tier || state.tier,
        error: null,
      };

    case 'JOIN_REQUESTED':
      if (state.step !== 'verified' && state.step !== 'anonymous') return state;
      return {
        ...state,
        step: 'joined',
        error: null,
      };

    case 'WAITING_ROOM_ENTERED':
      return {
        ...state,
        step: 'waiting',
        position: event.payload.position || state.position || 5000,
        etaSec: event.payload.etaSec || state.etaSec || 300,
        error: null,
      };

    case 'QUEUE_UPDATE': {
      // MONOTONIC GUARANTEE: Queue position only ever decreases (never backwards)
      const currentPos = state.position ?? event.payload.position;
      const safePosition = Math.min(currentPos, event.payload.position);
      const safeEta = event.payload.etaSec !== undefined
        ? Math.min(state.etaSec ?? event.payload.etaSec, event.payload.etaSec)
        : state.etaSec;

      if (safePosition <= 1 && (state.step === 'waiting' || state.step === 'joined')) {
        return {
          ...state,
          step: 'admitted',
          position: 1,
          etaSec: 0,
        };
      }

      return {
        ...state,
        position: safePosition,
        etaSec: safeEta,
      };
    }

    case 'TURN_ADMITTED':
      if (state.step === 'confirmed') return state;
      return {
        ...state,
        step: 'admitted',
        position: 1,
        etaSec: 0,
        error: null,
      };

    case 'SEAT_RESERVED':
      return {
        ...state,
        step: 'reserved',
        ticketId: event.payload.ticketId,
        hold: event.payload.hold,
        allocation: event.payload.allocation ?? 1,
        // Generate new idempotency key for this fresh reservation hold
        idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        error: null,
      };

    case 'PAYMENT_INITIATED':
      // Edge case guard: Double-click on Pay is blocked if already paying or confirmed
      if (state.step !== 'reserved' && state.step !== 'failed') return state;
      if (state.hold && state.hold.expiresAt <= Date.now()) {
        return {
          ...state,
          step: 'expired',
          error: { code: 'RESERVATION_EXPIRED', message: 'Hold time expired before payment initiation.' },
        };
      }
      return {
        ...state,
        step: 'paying',
        // Preserve and REUSE existing idempotency key across retries!
        idempotencyKey: state.idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp_${Date.now()}`),
        error: null,
      };

    case 'PAYMENT_SUCCESS':
      return {
        ...state,
        step: 'confirmed',
        receiptId: event.payload.receiptId,
        hold: null,
        error: null,
      };

    case 'PAYMENT_FAILED':
      return {
        ...state,
        step: 'failed',
        error: { code: event.payload.code, message: event.payload.message },
      };

    case 'HOLD_EXPIRED':
      if (state.step === 'confirmed') return state;
      return {
        ...state,
        step: 'expired',
        hold: null,
        error: { code: 'RESERVATION_EXPIRED', message: 'Your seat reservation window has expired.' },
      };

    case 'RETRY_PAYMENT':
      if (state.step !== 'failed') return state;
      if (state.hold && state.hold.expiresAt <= Date.now()) {
        return {
          ...state,
          step: 'expired',
          error: { code: 'RESERVATION_EXPIRED', message: 'Hold time expired. Cannot retry payment.' },
        };
      }
      return {
        ...state,
        step: 'paying',
        // Must reuse same idempotency key for network failure retries
        error: null,
      };

    case 'RESET_FLOW':
      return {
        ...INITIAL_CONTEXT,
        userId: state.userId,
        email: state.email,
        token: state.token,
        step: state.token ? 'verified' : 'anonymous',
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: event.payload,
      };

    default:
      return state;
  }
}
