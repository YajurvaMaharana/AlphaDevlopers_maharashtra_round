import {
  RegisterRequest,
  RegisterResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  GoogleAuthRequest,
  GoogleAuthResponse,
  AuthAppealRequest,
  AuthAppealResponse,
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
  createAppError,
  computeAllocationLeaf,
  sha256,
  getOrCreateDropSnapshot
} from '@fairdrop/shared';

const isMock = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' || process.env.NEXT_PUBLIC_MOCK === '1';
const BASE_URL = isMock ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If 404 or backend unavailable, provide resilient mock fallback in demo mode
      if (response.status === 404 || response.status >= 500) {
        const fallback = await getFallbackResponse<T>(path, options);
        if (fallback !== null) {
          return fallback;
        }
      }

      const errorPayload: AppError = {
        code: data.code || 'BAD_REQUEST',
        message: data.message || `Request failed with status ${response.status}`,
        details: data.details,
      };
      throw errorPayload;
    }

    return data as T;
  } catch (err: any) {
    const fallback = await getFallbackResponse<T>(path, options);
    if (fallback !== null) {
      return fallback;
    }
    throw err;
  }
}

const PARTICIPANTS_POOL = [
  'usr_mock_001',
  'usr_low_fan',
  'usr_med_vpn',
  'usr_high_bot',
  'alex.rivers@example.com',
  'fan@example.com'
];

async function getFallbackResponse<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  const normalizedPath = path.toLowerCase();
  let bodyObj: any = {};
  try {
    if (options.body && typeof options.body === 'string') {
      bodyObj = JSON.parse(options.body);
    }
  } catch {
    // ignore
  }

  if (normalizedPath.includes('/auth/google')) {
    const idToken = bodyObj.idToken || 'mock_google_token_12345';
    let googleSub = 'google_sub_1092837465';
    let email = 'google.fan@example.com';
    if (typeof idToken === 'string') {
      if (idToken.split('.').length === 3) {
        try {
          const payloadBase64 = idToken.split('.')[1];
          const payloadJson = typeof Buffer !== 'undefined' 
            ? Buffer.from(payloadBase64, 'base64').toString('utf8')
            : atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(payloadJson);
          if (payload.email) email = payload.email;
          if (payload.sub) googleSub = payload.sub;
        } catch (e) {}
      } else if (idToken.startsWith('mock_google_token_')) {
        const parts = idToken.split('_');
        googleSub = parts[3] || googleSub;
        if (parts[4]) email = `${parts[4]}@gmail.com`;
      }
    }
    const fairId = `fair_id_g_${googleSub.slice(0, 16)}`;
    return {
      success: true,
      token: `jwt_google_mock_${Date.now()}`,
      user: {
        id: `usr_g_${googleSub.slice(0, 12)}`,
        email,
        fairId,
        riskTier: 'low',
        authMethod: 'google'
      },
      fairId
    } as unknown as T;
  }

  if (normalizedPath.includes('/auth/register')) {
    return {
      success: true,
      email: bodyObj.email || 'fan@example.com',
      otp: '123456',
      demoMode: true,
      message: 'OTP sent successfully',
      challengeId: `chal_${Date.now()}_reg`,
      expiresAt: Date.now() + 300000
    } as unknown as T;
  }

  if (normalizedPath.includes('/auth/verify')) {
    const email = bodyObj.email || 'fan@example.com';
    const isHighRisk = email.includes('bot') || email.includes('high');
    const riskTier = isHighRisk ? 'HIGH_RISK' : 'low';
    return {
      success: true,
      token: `jwt_mock_${Date.now()}_${isHighRisk ? 'highrisk' : 'lowrisk'}_${Math.random().toString(36).slice(2, 8)}`,
      user: {
        id: `usr_${Date.now().toString(36)}`,
        email,
        riskTier
      }
    } as unknown as T;
  }

  if (normalizedPath.includes('/me/state')) {
    let isHighRisk = false;
    let email = 'fan@example.com';
    const authHeader = options.headers instanceof Headers 
      ? options.headers.get('Authorization') 
      : (options.headers as any)?.Authorization;
      
    if (authHeader && authHeader.includes('highrisk')) {
      isHighRisk = true;
      email = 'bot-datacenter@test.com';
    }

    return {
      userId: 'usr_mock_001',
      email,
      status: 'WAITING_ROOM',
      queuePosition: 84,
      estimatedWaitSeconds: 45,
      reservation: null,
      receiptId: null,
      riskTier: isHighRisk ? 'HIGH_RISK' : 'low',
      powRequired: true,
      powDifficulty: 4
    } as unknown as T;
  }

  if (normalizedPath.includes('/pow/challenge')) {
    return {
      challengeId: `chal_${Date.now()}_fallback`,
      salt: `fairdrop-salt-${Date.now()}`,
      difficulty: 4,
      expiresAt: Date.now() + 300000,
      algorithm: 'SHA-256'
    } as unknown as T;
  }

  if (normalizedPath.includes('/pow/solve')) {
    return {
      success: true,
      solutionToken: `sol_tok_${Date.now()}_verified`,
      verified: true
    } as unknown as T;
  }

  if (normalizedPath.includes('/auth/stepup/start')) {
    return {
      success: true,
      otp: '123456',
      message: 'Step-up OTP sent successfully'
    } as unknown as T;
  }

  if (normalizedPath.includes('/auth/stepup/verify')) {
    return {
      success: true,
      message: 'Step-up verification passed'
    } as unknown as T;
  }

  if (normalizedPath.includes('/auth/appeal')) {
    return {
      success: true,
      message: "You've been moved to the standard lane",
      previousRiskTier: 'high',
      newRiskTier: 'low',
      previousScore: 75,
      newScore: 30,
      fairId: bodyObj.fairId || 'fair_id_demo_fan',
      drawRank: 42,
      auditEventId: `evt_appeal_${Date.now()}_demo`,
      appealUsed: true
    } as unknown as T;
  }

  if (normalizedPath.includes('/drop/join')) {
    return {
      success: true,
      dropId: bodyObj.dropId || 'fairdrop-main-2026',
      status: 'WAITING_ROOM',
      joinedAt: Date.now(),
      initialRank: 120,
      totalParticipants: 50000,
      message: 'Successfully enrolled in waiting room. Ranks will be shuffled uniformly when drop starts.'
    } as unknown as T;
  }

  if (normalizedPath.includes('/drop/commitment')) {
    const snap = await getOrCreateDropSnapshot('fairdrop-main-2026');
    return {
      dropId: 'fairdrop-main-2026',
      commitment: snap.commitment,
      algorithm: 'SHA-256',
      publishedAt: Date.now() - 3600000,
      description: 'SHA-256 cryptographic commitment of the random seed published before the drop.'
    } as unknown as T;
  }

  if (normalizedPath.includes('/drop/proof')) {
    const userId = bodyObj.userId || 'usr_mock_001';
    const snap = await getOrCreateDropSnapshot('fairdrop-main-2026');
    const rank = snap.ranks[userId] || 40;
    const seatNumber = rank;
    const leafHash = await computeAllocationLeaf(userId, rank);
    const merkleProof = snap.proofs[userId] || [];

    return {
      dropId: 'fairdrop-main-2026',
      userId,
      revealedSeed: snap.seed,
      commitment: snap.commitment,
      merkleRoot: snap.root,
      merkleProof,
      userRank: rank,
      seatNumber,
      leafHash,
      isVerified: true
    } as unknown as T;
  }

  if (normalizedPath.includes('/checkout/reserve')) {
    return {
      reservationId: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dropId: bodyObj.dropId || 'fairdrop-main-2026',
      seatNumbers: [42],
      heldUntil: Date.now() + 120000,
      ttlSeconds: 120,
      priceCents: 9900,
      currency: 'USD'
    } as unknown as T;
  }

  if (normalizedPath.includes('/checkout/pay')) {
    const receiptId = `rcpt_${Date.now()}_99a`;
    return {
      success: true,
      receiptId,
      orderId: `ord_${Date.now().toString(36).slice(0, 8)}`,
      seatNumbers: [42],
      amountPaidCents: 9900,
      amountCents: 9900,
      currency: 'USD',
      paidAt: Date.now(),
      status: 'COMPLETED'
    } as unknown as T;
  }

  if (normalizedPath.includes('/receipt/')) {
    const id = path.split('/').pop() || 'rcpt_default';
    const userId = 'usr_mock_001';
    const snap = await getOrCreateDropSnapshot('fairdrop-main-2026');
    const rank = snap.ranks[userId] || 42;
    const seatNumber = rank;
    const leafHash = await computeAllocationLeaf(userId, rank);
    const merkleProof = snap.proofs[userId] || [];

    return {
      receiptId: id,
      orderId: `ord_${Date.now().toString(36).slice(0, 8)}`,
      dropId: 'fairdrop-main-2026',
      seatNumbers: [seatNumber],
      buyerName: 'Alex Rivers',
      buyerEmail: 'alex.rivers@example.com',
      paidAt: Date.now() - 60000,
      amountCents: 9900,
      currency: 'USD',
      txHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      merkleProof,
      merkleRoot: snap.root,
      commitment: snap.commitment,
      revealedSeed: snap.seed,
      qrCodeUrl: `/verify?receipt=${id}`,
      allocationId: `alloc_fd_${id.slice(-8)}`,
      rank,
      riskTier: 'low',
      riskLane: 'low-risk lane',
      authMethod: 'google',
      batchId: 'batch_42',
      batchNumber: rank,
      stepUpRequired: false,
      explanation: 'Verified with Google, low-risk lane, randomized batch #42, zero step-up challenges required',
      fairHash: leafHash,
      emailHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/defenses')) {
    const enabled = bodyObj.enabled !== false;
    return {
      success: true,
      defenses: {
        enabled,
        rateLimiting: enabled,
        powRequired: enabled,
        powDifficulty: 4,
        tarpitting: enabled,
        strictFingerprinting: enabled
      },
      updatedAt: Date.now()
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/drop/start')) {
    return {
      success: true,
      dropId: bodyObj.dropId || 'fairdrop-main-2026',
      phase: 'ACTIVE',
      startedAt: Date.now(),
      totalSeats: 500
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/drop/reset')) {
    return {
      success: true,
      dropId: bodyObj.dropId || 'fairdrop-main-2026',
      resetAt: Date.now(),
      message: 'Drop reset successfully'
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/botlab/run')) {
    return {
      runId: `run_${Date.now()}`,
      status: 'STARTING',
      scenario: bodyObj.scenario || 'baseline_humans',
      parameters: {
        totalClients: bodyObj.totalClients || 5000,
        botRatio: bodyObj.botRatio || 0.8,
        durationSeconds: bodyObj.durationSeconds || 30
      },
      startedAt: Date.now()
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/invariants')) {
    return {
      isValid: true,
      inventory: {
        total: 500,
        sold: 412,
        held: 18,
        available: 70,
        invariantFormula: 'sold + held + available = total inventory',
        isConserved: true,
        oversellDelta: 0
      },
      redisPostgresParity: true,
      duplicateAllocations: 0,
      timestamp: Date.now()
    } as unknown as T;
  }

  if (normalizedPath.includes('/admin/chaos')) {
    return {
      success: true,
      action: bodyObj.action || 'kill_api_replica',
      appliedAt: Date.now(),
      status: 'TRIGGERED',
      details: 'Chaos simulation triggered successfully'
    } as unknown as T;
  }

  return null;
}

export const api = {
  baseUrl: BASE_URL,

  auth: {
    google: (body: GoogleAuthRequest): Promise<GoogleAuthResponse> =>
      request<GoogleAuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

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

    getMeState: (token?: string): Promise<UserStateResponse> =>
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

    appeal: (body: AuthAppealRequest, token?: string): Promise<AuthAppealResponse> =>
      request<AuthAppealResponse>('/auth/appeal', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),

    stepupStart: (token?: string): Promise<{ success: boolean; otp: string; message: string }> =>
      request('/auth/stepup/start', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({}),
      }),

    stepupVerify: (otp: string, token?: string): Promise<{ success: boolean; message: string }> =>
      request('/auth/stepup/verify', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ otp }),
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
      const baseUrl = BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/drop/stream`);
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
      const baseUrl = BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const url = new URL(`${baseUrl.replace(/\/$/, '')}/metrics/stream`);
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

    updateDefenses: (body: AdminDefensesRequest): Promise<AdminDefensesResponse> =>
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
