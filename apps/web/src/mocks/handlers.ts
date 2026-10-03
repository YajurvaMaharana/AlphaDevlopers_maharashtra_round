import { http, HttpResponse } from 'msw';
import {
  RegisterResponse,
  VerifyOtpResponse,
  UserStateResponse,
  PoWChallenge,
  SolvePoWResponse,
  DropJoinResponse,
  DropCommitmentResponse,
  DropProofResponse,
  CheckoutReserveResponse,
  CheckoutPayResponse,
  ReceiptResponse,
  AdminDefensesResponse,
  AdminDropStartResponse,
  AdminDropResetResponse,
  AdminBotLabRunResponse,
  AdminInvariantsResponse,
  AdminChaosResponse,
  LiveMetricsPayload
} from '@fairdrop/shared';

// Simulated state store for MSW
const mockDb = {
  defensesEnabled: true,
  rateLimiting: true,
  powRequired: true,
  powDifficulty: 4,
  tarpitting: false,
  strictFingerprinting: true,
  totalSeats: 500,
  soldSeats: 142,
  heldSeats: 28,
  dropPhase: 'WAITING_ROOM' as 'UPCOMING' | 'WAITING_ROOM' | 'SHUFFLE' | 'ACTIVE' | 'SOLD_OUT',
  users: new Map<string, { email: string; token: string }>(),
  receipts: new Map<string, ReceiptResponse>()
};

export const handlers = [
  // 1. POST /auth/register
  http.post('*/auth/register', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = body.email || 'fan@example.com';

    const response: RegisterResponse = {
      success: true,
      message: 'Verification code sent to your email address.',
      challengeId: `chal_${Date.now()}_reg`,
      expiresAt: Date.now() + 300000
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 2. POST /auth/verify
  http.post('*/auth/verify', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string; otp?: string };
    const email = body.email || 'fan@example.com';
    const token = `jwt_mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const response: VerifyOtpResponse = {
      success: true,
      token,
      user: {
        id: `usr_${Date.now().toString(36)}`,
        email,
        riskTier: 'low'
      }
    };
    mockDb.users.set(token, { email, token });
    return HttpResponse.json(response, { status: 200 });
  }),

  // 3. GET /me/state
  http.get('*/me/state', async () => {
    const response: UserStateResponse = {
      userId: 'usr_mock_001',
      email: 'fan@example.com',
      status: mockDb.dropPhase === 'WAITING_ROOM' ? 'WAITING_ROOM' : 'QUEUED',
      queuePosition: 84,
      estimatedWaitSeconds: 45,
      reservation: null,
      receiptId: null,
      riskTier: 'low',
      powRequired: mockDb.powRequired,
      powDifficulty: mockDb.powDifficulty
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 4. POST /pow/challenge
  http.post('*/pow/challenge', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const response: PoWChallenge = {
      challengeId: `chal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      salt: `fairdrop-salt-${Date.now()}`,
      difficulty: mockDb.powDifficulty,
      expiresAt: Date.now() + 300000,
      algorithm: 'SHA-256'
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 5. POST /pow/solve
  http.post('*/pow/solve', async () => {
    const response: SolvePoWResponse = {
      success: true,
      solutionToken: `sol_tok_${Date.now()}_verified`,
      verified: true
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 6. POST /drop/join
  http.post('*/drop/join', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { dropId?: string };
    const response: DropJoinResponse = {
      success: true,
      dropId: body.dropId || 'fairdrop-main-2026',
      status: 'WAITING_ROOM',
      joinedAt: Date.now(),
      initialRank: 120,
      totalParticipants: 50000,
      message: 'Successfully enrolled in waiting room. Ranks will be shuffled uniformly when drop starts.'
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 7. GET /drop/stream (SSE or mock heartbeat)
  http.get('*/drop/stream', () => {
    return new HttpResponse(
      `: heartbeat\nevent: DROP_STATUS\ndata: ${JSON.stringify({
        dropId: 'fairdrop-main-2026',
        phase: mockDb.dropPhase,
        remainingSeats: mockDb.totalSeats - mockDb.soldSeats - mockDb.heldSeats,
        totalSeats: mockDb.totalSeats,
        waitingRoomParticipants: 50000
      })}\n\n`,
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive'
        }
      }
    );
  }),

  // 8. GET /drop/commitment
  http.get('*/drop/commitment', () => {
    const response: DropCommitmentResponse = {
      dropId: 'fairdrop-main-2026',
      commitment: '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
      algorithm: 'SHA-256',
      publishedAt: Date.now() - 3600000,
      description: 'SHA-256 cryptographic commitment of the random seed published before the drop.'
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 9. GET /drop/proof
  http.get('*/drop/proof', async ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'usr_mock_001';

    const response: DropProofResponse = {
      dropId: 'fairdrop-main-2026',
      userId,
      revealedSeed: 'fairdrop_seed_10',
      commitment: '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
      merkleRoot: '4c99ae1210c44cef692ae0010f5a121fbce47035b9a765436ee4380eae1ca39e',
      merkleProof: [
        '158d0117b326f4683f9ba6d5e327b863eac8753dafcd7dd262768cf99030c68f',
        '7720208925e9ef8af9a819a0d2f1bd07d611bab1de06f71af6a7ec0662d4eea8',
        '364dd8bb4319f93ce984ecc5fa212d8936000099b19f52f1370251e9c3111d2f'
      ],
      userRank: 42,
      seatNumber: 42,
      leafHash: 'd29894432e70caac75c92b17533e6033a9ccc4021d605505604c2a8f39881ca9',
      isVerified: true
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 10. POST /checkout/reserve
  http.post('*/checkout/reserve', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { dropId?: string };
    const response: CheckoutReserveResponse = {
      reservationId: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dropId: body.dropId || 'fairdrop-main-2026',
      seatNumbers: [42],
      heldUntil: Date.now() + 120000,
      ttlSeconds: 120,
      priceCents: 9900,
      currency: 'USD'
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 11. POST /checkout/pay
  http.post('*/checkout/pay', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      reservationId?: string;
      attendee?: { name: string; email: string };
    };

    const receiptId = `rcpt_${Date.now()}_99a`;
    const response: CheckoutPayResponse = {
      success: true,
      receiptId,
      orderId: `ord_${Date.now().toString(36).slice(0, 8)}`,
      seatNumbers: [42],
      amountPaidCents: 9900,
      currency: 'USD',
      paidAt: Date.now(),
      status: 'COMPLETED'
    };

    mockDb.receipts.set(receiptId, {
      receiptId,
      orderId: response.orderId,
      dropId: 'fairdrop-main-2026',
      allocationId: `alloc_fd_${receiptId.slice(-8)}`,
      queueBatch: 'Batch #1 (Window A)',
      rank: 42,
      riskTier: 'Tier 1 (Low Risk - Human 99.4%)',
      seatNumbers: [42],
      buyerName: body.attendee?.name || 'Alex Rivers',
      buyerEmail: body.attendee?.email || 'alex.rivers@example.com',
      paidAt: Date.now(),
      amountCents: 9900,
      currency: 'USD',
      txHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      commitment: '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
      revealedSeed: 'fairdrop_seed_10',
      merkleRoot: '4c99ae1210c44cef692ae0010f5a121fbce47035b9a765436ee4380eae1ca39e',
      qrCodeUrl: `/verify?receipt=${receiptId}`
    });

    return HttpResponse.json(response, { status: 200 });
  }),

  // 12. GET /receipt/:id
  http.get('*/receipt/:id', ({ params }) => {
    const id = String(params.id);
    const existing = mockDb.receipts.get(id);

    const response: ReceiptResponse = existing || {
      receiptId: id,
      orderId: `ord_${id.slice(-6)}`,
      dropId: 'fairdrop-main-2026',
      allocationId: `alloc_fd_${id.slice(-8)}`,
      queueBatch: 'Batch #1 (Window A)',
      rank: 42,
      riskTier: 'Tier 1 (Low Risk - Human 99.4%)',
      seatNumbers: [42],
      buyerName: 'Alex Rivers',
      buyerEmail: 'alex.rivers@example.com',
      paidAt: Date.now() - 60000,
      amountCents: 9900,
      currency: 'USD',
      txHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      commitment: '815e1f0d09f9bb555fb4347dd2387389b08b47b7b3d35e825814e13f1b80d0ca',
      revealedSeed: 'fairdrop_seed_10',
      merkleRoot: '4c99ae1210c44cef692ae0010f5a121fbce47035b9a765436ee4380eae1ca39e',
      qrCodeUrl: `/verify?receipt=${id}`
    };

    return HttpResponse.json(response, { status: 200 });
  }),

  // 13. GET /metrics/stream
  http.get('*/metrics/stream', () => {
    const payload: LiveMetricsPayload = {
      timestamp: Date.now(),
      requestsPerSecond: 1250,
      activeConnections: 50000,
      seatsSold: mockDb.soldSeats,
      seatsHeld: mockDb.heldSeats,
      seatsRemaining: mockDb.totalSeats - mockDb.soldSeats - mockDb.heldSeats,
      totalInventory: 500,
      botSeatSharePct: mockDb.defensesEnabled ? 2.4 : 92.6,
      humanSeatSharePct: mockDb.defensesEnabled ? 97.6 : 7.4,
      giniCoefficient: mockDb.defensesEnabled ? 0.08 : 0.89,
      speedAdvantageIndex: mockDb.defensesEnabled ? -0.04 : -0.92,
      p95LatencyMs: mockDb.defensesEnabled ? 24 : 640,
      p99LatencyMs: mockDb.defensesEnabled ? 48 : 2100,
      rateLimit429Count: mockDb.defensesEnabled ? 4820 : 0,
      powBlockedCount: mockDb.defensesEnabled ? 19300 : 0,
      oversellCount: 0,
      defensesEnabled: mockDb.defensesEnabled,
      funnel: {
        waitingRoom: 48500,
        admitted: 450,
        reserved: 28,
        paid: 142
      }
    };

    return HttpResponse.json(payload, { status: 200 });
  }),

  // 14. POST /admin/defenses
  http.post('*/admin/defenses', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      enabled?: boolean;
      rateLimiting?: boolean;
      powRequired?: boolean;
      powDifficulty?: number;
      tarpitting?: boolean;
      strictFingerprinting?: boolean;
    };

    if (body.enabled !== undefined) mockDb.defensesEnabled = body.enabled;
    if (body.rateLimiting !== undefined) mockDb.rateLimiting = body.rateLimiting;
    if (body.powRequired !== undefined) mockDb.powRequired = body.powRequired;
    if (body.powDifficulty !== undefined) mockDb.powDifficulty = body.powDifficulty;
    if (body.tarpitting !== undefined) mockDb.tarpitting = body.tarpitting;
    if (body.strictFingerprinting !== undefined) mockDb.strictFingerprinting = body.strictFingerprinting;

    const response: AdminDefensesResponse = {
      success: true,
      defenses: {
        enabled: mockDb.defensesEnabled,
        rateLimiting: mockDb.rateLimiting,
        powRequired: mockDb.powRequired,
        powDifficulty: mockDb.powDifficulty,
        tarpitting: mockDb.tarpitting,
        strictFingerprinting: mockDb.strictFingerprinting
      },
      updatedAt: Date.now()
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 15. POST /admin/drop/start
  http.post('*/admin/drop/start', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { dropId?: string };
    mockDb.dropPhase = 'ACTIVE';

    const response: AdminDropStartResponse = {
      success: true,
      dropId: body.dropId || 'fairdrop-main-2026',
      phase: 'ACTIVE',
      startedAt: Date.now(),
      totalSeats: mockDb.totalSeats
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 16. POST /admin/drop/reset
  http.post('*/admin/drop/reset', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { dropId?: string };
    mockDb.soldSeats = 0;
    mockDb.heldSeats = 0;
    mockDb.dropPhase = 'WAITING_ROOM';

    const response: AdminDropResetResponse = {
      success: true,
      dropId: body.dropId || 'fairdrop-main-2026',
      resetAt: Date.now(),
      message: 'Drop reset successfully. Seats restored to 500 inventory.'
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 17. POST /admin/botlab/run
  http.post('*/admin/botlab/run', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      scenario?: string;
      totalClients?: number;
      botRatio?: number;
      durationSeconds?: number;
    };

    const response: AdminBotLabRunResponse = {
      runId: `run_${Date.now()}_lab`,
      status: 'RUNNING',
      scenario: (body.scenario as any) || 'distributed_botnet',
      parameters: {
        totalClients: body.totalClients || 5000,
        botRatio: body.botRatio ?? 0.8,
        durationSeconds: body.durationSeconds || 30
      },
      startedAt: Date.now()
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 18. GET /admin/invariants
  http.get('*/admin/invariants', () => {
    const sold = mockDb.soldSeats;
    const held = mockDb.heldSeats;
    const available = mockDb.totalSeats - sold - held;

    const response: AdminInvariantsResponse = {
      isValid: true,
      inventory: {
        total: mockDb.totalSeats,
        sold,
        held,
        available,
        invariantFormula: 'sold + held + available = total inventory',
        isConserved: sold + held + available === mockDb.totalSeats,
        oversellDelta: 0
      },
      redisPostgresParity: true,
      duplicateAllocations: 0,
      timestamp: Date.now()
    };
    return HttpResponse.json(response, { status: 200 });
  }),

  // 19. POST /admin/chaos
  http.post('*/admin/chaos', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const response: AdminChaosResponse = {
      success: true,
      action: (body.action as any) || 'kill_api_replica',
      appliedAt: Date.now(),
      status: 'TRIGGERED',
      details: 'Simulated failure injected into system. Invariant checker remains active.'
    };
    return HttpResponse.json(response, { status: 200 });
  })
];
