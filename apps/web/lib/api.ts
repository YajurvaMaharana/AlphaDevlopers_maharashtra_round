import {
  RegisterRequest,
  RegisterResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  UserStateResponse,
  CreatePoWChallengeRequest,
  PoWChallenge,
  SolvePoWRequest,
  SolvePoWResponse,
  DropJoinRequest,
  DropJoinResponse,
  DropCommitmentResponse,
  DropProofResponse,
  DropStreamEvent,
  CheckoutReserveRequest,
  CheckoutReserveResponse,
  CheckoutPayRequest,
  CheckoutPayResponse,
  ReceiptResponse,
  LiveMetricsPayload,
  AdminDefensesRequest,
  AdminDefensesResponse,
  AdminDropStartRequest,
  AdminDropStartResponse,
  AdminDropResetRequest,
  AdminDropResetResponse,
  AdminBotLabRunRequest,
  AdminBotLabRunResponse,
  AdminInvariantsResponse,
  AdminChaosRequest,
  AdminChaosResponse,
  AppError,
  createAppError
} from '@fairdrop/shared';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorPayload: AppError = {
      code: data.code || 'BAD_REQUEST',
      message: data.message || `Request failed with status ${response.status}`,
      details: data.details,
    };
    throw errorPayload;
  }

  return data as T;
}

export const api = {
  baseUrl: BASE_URL,

  auth: {
    register: (body: RegisterRequest): Promise<RegisterResponse> =>
      request<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    verify: (body: VerifyOtpRequest): Promise<VerifyOtpResponse> =>
      request<VerifyOtpResponse>('/auth/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getState: (token?: string): Promise<UserStateResponse> =>
      request<UserStateResponse>('/me/state', {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }),

    createPoWChallenge: (body: CreatePoWChallengeRequest): Promise<PoWChallenge> =>
      request<PoWChallenge>('/pow/challenge', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    solvePoW: (body: SolvePoWRequest): Promise<SolvePoWResponse> =>
      request<SolvePoWResponse>('/pow/solve', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  drop: {
    join: (body: DropJoinRequest): Promise<DropJoinResponse> =>
      request<DropJoinResponse>('/drop/join', {
        method: 'POST',
        headers: { 'Idempotency-Key': body.idempotencyKey },
        body: JSON.stringify(body),
      }),

    getCommitment: (dropId: string): Promise<DropCommitmentResponse> =>
      request<DropCommitmentResponse>(`/drop/commitment?dropId=${encodeURIComponent(dropId)}`, {
        method: 'GET',
      }),

    getProof: (dropId: string, userId: string): Promise<DropProofResponse> =>
      request<DropProofResponse>(
        `/drop/proof?dropId=${encodeURIComponent(dropId)}&userId=${encodeURIComponent(userId)}`,
        { method: 'GET' }
      ),

    getStreamUrl: (dropId: string, token?: string): string => {
      const url = new URL(`${BASE_URL.replace(/\/$/, '')}/drop/stream`);
      url.searchParams.set('dropId', dropId);
      if (token) url.searchParams.set('token', token);
      return url.toString();
    },

    subscribeStream: (
      dropId: string,
      onEvent: (event: DropStreamEvent) => void,
      onError?: (err: unknown) => void
    ): (() => void) => {
      const url = api.drop.getStreamUrl(dropId);
      const eventSource = new EventSource(url);

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEvent(parsed as DropStreamEvent);
        } catch (err) {
          console.warn('Failed to parse SSE event', err);
        }
      };

      eventSource.onerror = (e) => {
        if (onError) onError(e);
      };

      return () => {
        eventSource.close();
      };
    },
  },

  checkout: {
    reserve: (body: CheckoutReserveRequest): Promise<CheckoutReserveResponse> =>
      request<CheckoutReserveResponse>('/checkout/reserve', {
        method: 'POST',
        headers: { 'Idempotency-Key': body.idempotencyKey },
        body: JSON.stringify(body),
      }),

    pay: (body: CheckoutPayRequest): Promise<CheckoutPayResponse> =>
      request<CheckoutPayResponse>('/checkout/pay', {
        method: 'POST',
        headers: { 'Idempotency-Key': body.idempotencyKey },
        body: JSON.stringify(body),
      }),

    getReceipt: (id: string): Promise<ReceiptResponse> =>
      request<ReceiptResponse>(`/receipt/${encodeURIComponent(id)}`, {
        method: 'GET',
      }),
  },

  metrics: {
    getStreamUrl: (interval = 2000): string => {
      const url = new URL(`${BASE_URL.replace(/\/$/, '')}/metrics/stream`);
      url.searchParams.set('interval', interval.toString());
      return url.toString();
    },

    subscribeStream: (
      onEvent: (payload: LiveMetricsPayload) => void,
      onError?: (err: unknown) => void
    ): (() => void) => {
      const url = api.metrics.getStreamUrl();
      const eventSource = new EventSource(url);

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && typeof parsed === 'object' && 'data' in parsed) {
            onEvent(parsed.data as LiveMetricsPayload);
          } else {
            onEvent(parsed as LiveMetricsPayload);
          }
        } catch (err) {
          console.warn('Failed to parse metrics event', err);
        }
      };

      eventSource.onerror = (e) => {
        if (onError) onError(e);
      };

      return () => {
        eventSource.close();
      };
    },
  },

  admin: {
    toggleDefenses: (body: AdminDefensesRequest): Promise<AdminDefensesResponse> =>
      request<AdminDefensesResponse>('/admin/defenses', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    startDrop: (body: AdminDropStartRequest): Promise<AdminDropStartResponse> =>
      request<AdminDropStartResponse>('/admin/drop/start', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    resetDrop: (body: AdminDropResetRequest): Promise<AdminDropResetResponse> =>
      request<AdminDropResetResponse>('/admin/drop/reset', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    runBotLab: (body: AdminBotLabRunRequest): Promise<AdminBotLabRunResponse> =>
      request<AdminBotLabRunResponse>('/admin/botlab/run', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    getInvariants: (): Promise<AdminInvariantsResponse> =>
      request<AdminInvariantsResponse>('/admin/invariants', {
        method: 'GET',
      }),

    triggerChaos: (body: AdminChaosRequest): Promise<AdminChaosResponse> =>
      request<AdminChaosResponse>('/admin/chaos', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
};

export default api;
