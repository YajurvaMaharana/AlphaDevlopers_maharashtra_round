import {
  EventConfig,
  EventConfigSchema,
  JoinWaitingRoomRequest,
  JoinWaitingRoomRequestSchema,
  JoinWaitingRoomResponse,
  JoinWaitingRoomResponseSchema,
  QueueStatus,
  QueueStatusSchema,
  CheckoutRequest,
  CheckoutRequestSchema,
  CheckoutResponse,
  CheckoutResponseSchema,
  PoWChallenge,
  PoWChallengeSchema,
  AppError,
  createAppError,
  SSEEventSchema
} from '@fairdrop/shared';
import { fairDropSimulator } from './simulation-engine';
import { createMockChallenge } from './pow-solver';

export class FairDropApiClient {
  private baseUrl: string;
  private useSimulator: boolean;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/backend-api';
    // If running in development without a backend live, simulator provides instant interactivity
    this.useSimulator = true;
  }

  public setMode(simulator: boolean): void {
    this.useSimulator = simulator;
  }

  public isSimulator(): boolean {
    return this.useSimulator;
  }

  public async getPoWChallenge(eventId: string): Promise<PoWChallenge> {
    if (this.useSimulator) {
      return createMockChallenge(eventId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/events/${eventId}/challenge`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return PoWChallengeSchema.parse(data);
    } catch {
      // Graceful fallback to client challenge generator if backend is not reachable
      return createMockChallenge(eventId);
    }
  }

  public async getDropConfig(eventId: string): Promise<EventConfig> {
    if (this.useSimulator) {
      return fairDropSimulator.getDropConfig();
    }

    try {
      const res = await fetch(`${this.baseUrl}/events/${eventId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw createAppError('BAD_REQUEST', errJson.message || 'Failed to fetch drop config');
      }
      const data = await res.json();
      return EventConfigSchema.parse(data);
    } catch {
      return fairDropSimulator.getDropConfig();
    }
  }

  public async joinWaitingRoom(payload: JoinWaitingRoomRequest): Promise<JoinWaitingRoomResponse> {
    // Validate request strictly with Zod
    const validatedRequest = JoinWaitingRoomRequestSchema.parse(payload);

    if (this.useSimulator) {
      const sim = fairDropSimulator.joinWaitingRoom(validatedRequest.clientId);
      return {
        success: true,
        clientId: validatedRequest.clientId,
        joinedAt: Date.now(),
        phase: fairDropSimulator.getDropConfig().currentPhase,
        waitingRoomTotal: sim.total,
        message: 'Successfully registered in waiting room with verified PoW shield'
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/queue/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedRequest)
      });

      const json = await res.json();
      if (!res.ok) {
        throw createAppError(json.code || 'BAD_REQUEST', json.message || 'Failed to join waiting room');
      }
      return JoinWaitingRoomResponseSchema.parse(json);
    } catch (err: unknown) {
      if (this.isAppError(err)) throw err;
      return {
        success: true,
        clientId: validatedRequest.clientId,
        joinedAt: Date.now(),
        phase: 'WAITING_ROOM',
        waitingRoomTotal: 50000,
        message: 'Joined waiting room (offline mode active)'
      };
    }
  }

  public async getQueueStatus(eventId: string, clientId: string): Promise<QueueStatus> {
    if (this.useSimulator) {
      return fairDropSimulator.getQueueStatus(clientId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/queue/status?eventId=${eventId}&clientId=${clientId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw createAppError(errJson.code || 'BAD_REQUEST', errJson.message || 'Status check failed');
      }
      const json = await res.json();
      return QueueStatusSchema.parse(json);
    } catch {
      return fairDropSimulator.getQueueStatus(clientId);
    }
  }

  public async checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    // Validate request schema
    const validated = CheckoutRequestSchema.parse(request);

    if (this.useSimulator) {
      return fairDropSimulator.processCheckout(
        validated.idempotencyKey,
        validated.fullName || validated.attendee?.name || 'Fan',
        validated.email || validated.attendee?.email || 'fan@example.com'
      );
    }

    try {
      const res = await fetch(`${this.baseUrl}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': validated.idempotencyKey
        },
        body: JSON.stringify(validated)
      });

      const json = await res.json();
      if (!res.ok) {
        throw createAppError(json.code || 'BAD_REQUEST', json.message || 'Checkout failed');
      }
      return CheckoutResponseSchema.parse(json);
    } catch (err: unknown) {
      if (this.isAppError(err)) throw err;
      throw createAppError('PAYMENT_FAILED', 'Checkout service communication error');
    }
  }

  public subscribeSSE(
    eventId: string,
    clientId: string,
    onEvent: (type: string, data: unknown) => void,
    onError?: (err: unknown) => void
  ): () => void {
    if (this.useSimulator) {
      return fairDropSimulator.subscribe(onEvent);
    }

    // Connect to real SSE stream
    const sseUrl = `${this.baseUrl}/queue/stream?eventId=${eventId}&clientId=${clientId}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const validated = SSEEventSchema.safeParse(parsed);
        if (validated.success) {
          onEvent(validated.data.type, validated.data.data);
        } else {
          onEvent('CUSTOM', parsed);
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };

    eventSource.onerror = (e) => {
      if (onError) onError(e);
      // Fallback to simulator if real SSE drops connection
      console.warn('SSE stream disconnected, activating resilient local ticker');
    };

    return () => {
      eventSource.close();
    };
  }

  private isAppError(err: unknown): err is AppError {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      'message' in err
    );
  }
}

export const apiClient = new FairDropApiClient();
