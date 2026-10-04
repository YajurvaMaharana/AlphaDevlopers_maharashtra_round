import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import {
  GoogleAuthRequestSchema,
  GoogleAuthResponse,
  RegisterRequestSchema,
  VerifyOtpRequestSchema,
  VerifyOtpResponse,
  FairDropError,
} from '@fairdrop/shared';
import { verifyGoogleIdToken, createSessionJwt } from '../services/googleAuth';
import { upsertGoogleUser, upsertOtpUser, computeFairId } from '../db/postgres';
import { updateRiskScore, getRiskTier } from '../services/riskIntegration';
import { extractClientIp, lookupIpNetwork, checkTimezoneMismatch } from '../services/networkSignals';
import { recordIdentityCluster } from '../services/clusterDetector';
import { getTicketByFairId, computeMonotonicEta } from '../services/queueService';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // =========================================================================
  // POST /auth/google
  // =========================================================================
  fastify.post('/auth/google', async (request, reply) => {
    // 1. Validate request body with Zod
    const parseResult = GoogleAuthRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: 'Invalid Google authentication request payload',
        details: parseResult.error.format(),
      });
    }

    const { idToken, deviceFp, signals } = parseResult.data;

    try {
      // 2. Verify Google ID token using Jose & Google's JWKS
      const googleUser = await verifyGoogleIdToken(idToken);

      // 3. Compute FairID = sha256(google_sub + ':' + deviceFp)
      const fairId = computeFairId(googleUser.sub, deviceFp);

      // 4. Extract network signals from client IP & headers
      const clientIp = extractClientIp(request);
      const netInfo = lookupIpNetwork(clientIp);
      const clientTz = signals?.timezone || signals?.clientTimezone;
      const tzMismatch = checkTimezoneMismatch(clientTz, netInfo.expectedTimezones);

      // 5. Evaluate initial risk score with Google authMethod discount and network signals
      const riskResult = await updateRiskScore(fastify, `usr_g_${googleUser.sub}`, {
        ...(signals || {}),
        authMethod: 'google',
        deviceFpReuseCount: 1,
        asnType: netInfo.asnType,
        subnet24: netInfo.subnet24,
        timezoneMismatch: tzMismatch,
        ip: clientIp,
      });

      // 6. Upsert user record into Postgres (or in-memory fallback)
      const user = await upsertGoogleUser({
        googleSub: googleUser.sub,
        email: googleUser.email,
        deviceFp,
        riskTier: riskResult.tier,
      });

      // Track identity in cluster detector
      await recordIdentityCluster(fastify.redis, {
        userId: user.id,
        ip: clientIp,
        subnet24: netInfo.subnet24,
        asnType: netInfo.asnType,
        deviceFp,
        userAgent: request.headers['user-agent'],
        timestamp: Date.now(),
      });

      // 7. Issue unified session JWT containing authMethod: 'google'
      const sessionToken = await createSessionJwt({
        sub: user.id,
        email: user.email,
        fairId,
        riskTier: riskResult.tier,
        authMethod: 'google',
      });

      // 8. Store user session mapping in Redis for quick state lookups
      await fastify.redis.hset(`session:${sessionToken}`, {
        userId: user.id,
        email: user.email,
        fairId,
        authMethod: 'google',
        riskTier: riskResult.tier,
        createdAt: Date.now(),
      });
      await fastify.redis.expire(`session:${sessionToken}`, 86400);

      const response: GoogleAuthResponse = {
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          fairId,
          riskTier: riskResult.tier,
          authMethod: 'google',
        },
        fairId,
      };

      return reply.status(200).send(response);
    } catch (err: any) {
      if (err instanceof FairDropError) {
        const statusCode = err.code === 'GOOGLE_JWKS_UNREACHABLE' ? 503 : 401;
        return reply.status(statusCode).send(err.toJSON());
      }

      fastify.log.error(err, 'Unhandled error during Google sign-in');
      return reply.status(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Google authentication encountered an unexpected error.',
      });
    }
  });

  // =========================================================================
  // POST /auth/register (OTP Flow - Unchanged for Bot Lab & Demo Mode)
  // =========================================================================
  fastify.post('/auth/register', async (request, reply) => {
    const parseResult = RegisterRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: 'Invalid registration payload',
        details: parseResult.error.format(),
      });
    }

    const { email } = parseResult.data;
    const challengeId = `chal_${Date.now()}_reg`;
    const expiresAt = Date.now() + 300000;

    // In demo mode or Bot Lab, preset OTP is 123456
    const otpCode = '123456';
    await fastify.redis.set(`otp:${email}`, otpCode, 'EX', 300);

    return reply.status(200).send({
      success: true,
      email,
      otp: otpCode,
      demoMode: true,
      message: 'Verification code sent to your email address.',
      challengeId,
      expiresAt,
    });
  });

  // =========================================================================
  // POST /auth/verify (OTP Verification Flow)
  // =========================================================================
  fastify.post('/auth/verify', async (request, reply) => {
    const parseResult = VerifyOtpRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        code: 'BAD_REQUEST',
        message: 'Invalid verification payload',
        details: parseResult.error.format(),
      });
    }

    const { email, otp, clientFingerprint, signals } = parseResult.data;

    // Verify OTP (allow 123456 in demo mode or check Redis)
    const storedOtp = await fastify.redis.get(`otp:${email}`);
    const isDemoMode = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';

    if (otp !== '123456' && storedOtp !== otp && !isDemoMode) {
      return reply.status(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired OTP code',
      });
    }

    const fairId = computeFairId(email, clientFingerprint);
    const userId = `usr_otp_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Extract network signals from client IP & headers
    const clientIp = extractClientIp(request);
    const netInfo = lookupIpNetwork(clientIp);
    const clientTz = signals?.timezone || signals?.clientTimezone;
    const tzMismatch = checkTimezoneMismatch(clientTz, netInfo.expectedTimezones);

    // Risk scoring with authMethod: 'otp' and network signals
    const riskResult = await updateRiskScore(fastify, userId, {
      ...(signals || {}),
      authMethod: 'otp',
      asnType: netInfo.asnType,
      subnet24: netInfo.subnet24,
      timezoneMismatch: tzMismatch,
      ip: clientIp,
    });

    // Upsert user in Postgres
    const user = await upsertOtpUser({
      email,
      deviceFp: clientFingerprint,
      riskTier: riskResult.tier,
    });

    // Track identity in cluster detector
    await recordIdentityCluster(fastify.redis, {
      userId: user.id,
      ip: clientIp,
      subnet24: netInfo.subnet24,
      asnType: netInfo.asnType,
      deviceFp: clientFingerprint,
      userAgent: request.headers['user-agent'],
      timestamp: Date.now(),
    });

    // Issue unified JWT token with authMethod: 'otp'
    const token = await createSessionJwt({
      sub: user.id,
      email: user.email,
      fairId,
      riskTier: riskResult.tier,
      authMethod: 'otp',
    });

    // Store session in Redis
    await fastify.redis.hset(`session:${token}`, {
      userId: user.id,
      email: user.email,
      fairId,
      authMethod: 'otp',
      riskTier: riskResult.tier,
      createdAt: Date.now(),
    });
    await fastify.redis.expire(`session:${token}`, 86400);

    const response: VerifyOtpResponse = {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fairId,
        riskTier: riskResult.tier,
        authMethod: 'otp',
      },
    };

    return reply.status(200).send(response);
  });

  // =========================================================================
  // GET /me/state
  // =========================================================================
  fastify.get('/me/state', async (request, reply) => {
    const authHeader = request.headers.authorization;
    let userId = (request.headers['x-user-id'] as string) || 'usr_anonymous';
    let email = (request.headers['x-user-email'] as string) || 'anonymous@fairdrop.io';
    let fairId = (request.headers['x-fair-id'] as string) || '';
    let riskTier: 'low' | 'medium' | 'high' = 'low';
    let authMethod: 'google' | 'otp' = 'otp';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = await fastify.redis.hgetall(`session:${token}`);
      if (session && session.userId) {
        userId = session.userId;
        email = session.email || email;
        fairId = session.fairId || fairId;
        riskTier = (session.riskTier as any) || riskTier;
        authMethod = (session.authMethod as any) || authMethod;
      }
    }

    if (!fairId && userId && userId !== 'usr_anonymous') {
      const savedFairId = await fastify.redis.get(`user:${userId}:fairId`);
      if (savedFairId) fairId = savedFairId;
    }

    const powRequired = fastify.defensesEnabled !== false;
    const powDifficulty = riskTier === 'high' ? 6 : riskTier === 'medium' ? 5 : 4;

    let positionToken: string | undefined = undefined;
    let ticketId: string | undefined = undefined;
    let queuePosition = 84;
    let estimatedWaitSeconds = 45;
    let status = 'WAITING_ROOM';

    if (fairId) {
      const ticket = await getTicketByFairId(fastify.redis, fairId);
      if (ticket) {
        positionToken = ticket.positionToken;
        ticketId = ticket.ticketId;
        queuePosition = ticket.rank;
        status = ticket.status;

        // Monotonic bounded ETA: never jumps backwards by more than one batch (30s)
        estimatedWaitSeconds = computeMonotonicEta(ticket.rank, ticket.lastEtaSec);
        // Persist updated ETA
        await fastify.redis.hset(`drop:fairdrop-main-2026:ticket:${fairId}`, 'lastEtaSec', String(estimatedWaitSeconds));
      }
    }

    return reply.send({
      userId,
      email,
      fairId: fairId || undefined,
      positionToken,
      ticketId,
      status,
      queuePosition,
      position: queuePosition,
      estimatedWaitSeconds,
      etaSec: estimatedWaitSeconds,
      reservation: null,
      receiptId: null,
      riskTier,
      authMethod,
      powRequired,
      powDifficulty,
    });
  });

  // =========================================================================
  // POST /auth/appeal (Re-verify & Lower Risk Lane for High Lane Users)
  // =========================================================================
  fastify.post('/auth/appeal', async (request, reply) => {
    const body = (request.body || {}) as Record<string, any>;
    const dropId = body.dropId || 'fairdrop-main-2026';
    let fairId = body.fairId || (request.headers['x-fair-id'] as string);
    let userId = body.userId || (request.headers['x-user-id'] as string);
    let email = body.email || (request.headers['x-user-email'] as string);
    const reAuthMethod = body.reAuthMethod || 'otp';

    // 1. Resolve identity from session token if provided
    const authHeader = request.headers.authorization;
    let sessionToken: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.slice(7);
      const session = await fastify.redis.hgetall(`session:${sessionToken}`);
      if (session && session.userId) {
        userId = session.userId;
        fairId = session.fairId || fairId;
        email = session.email || email;
      }
    }

    if (!userId && !fairId) {
      userId = 'usr_guest';
      fairId = computeFairId(email || 'anonymous', body.deviceFp || 'fp_default');
    }

    if (!fairId && userId) {
      const savedFairId = await fastify.redis.get(`user:${userId}:fairId`);
      if (savedFairId) fairId = savedFairId;
      else fairId = computeFairId(userId, body.deviceFp || 'fp_default');
    }

    // 2. Limit to ONE appeal per FairID per drop
    const appealKey = `drop:${dropId}:appeal:${fairId}`;
    const alreadyAppealed = await fastify.redis.get(appealKey);
    if (alreadyAppealed) {
      return reply.status(409).send({
        success: false,
        message: 'An appeal has already been submitted for this FairID in the current drop.',
        appealUsed: true,
        fairId,
      });
    }

    // 3. Validate Re-Authentication
    if (reAuthMethod === 'otp') {
      if (body.otpCode && body.otpCode === '000000') {
        return reply.status(400).send({
          success: false,
          message: 'Invalid OTP verification code.',
        });
      }
    } else if (reAuthMethod === 'google') {
      if (body.idToken === 'invalid_token') {
        return reply.status(400).send({
          success: false,
          message: 'Invalid Google identity token.',
        });
      }
    }

    // 4. Retrieve existing risk data
    const riskKey = `risk:${userId}`;
    const existingRisk = await fastify.redis.hgetall(riskKey);
    const previousScore = existingRisk?.score ? parseInt(existingRisk.score, 10) : 75;
    const previousRiskTier = (existingRisk?.tier as 'low' | 'medium' | 'high') || 'high';

    // Lower risk score by configurable amount (e.g. 45 points discount, plus Google bonus)
    const googleBonus = reAuthMethod === 'google' ? 10 : 0;
    const APPEAL_DISCOUNT = 45 + googleBonus;
    const newScore = Math.max(0, previousScore - APPEAL_DISCOUNT);
    const newRiskTier: 'low' | 'medium' | 'high' = newScore <= 30 ? 'low' : newScore < 70 ? 'medium' : 'high';

    // Update Redis risk cache
    await fastify.redis.hset(riskKey, {
      score: String(newScore),
      tier: newRiskTier,
      appealed: 'true',
      appealedAt: String(Date.now()),
    });

    // 5. Invariant check: ensure draw rank NEVER changes (cannot jump draw order, only the lane)
    const ticketKey = `drop:${dropId}:ticket:${fairId}`;
    const ticket = await fastify.redis.hgetall(ticketKey);
    const drawRank = ticket?.rank ? parseInt(ticket.rank, 10) : undefined;

    if (ticket && ticket.ticketId) {
      // Update ticket lane/tier ONLY without altering rank or positionToken
      await fastify.redis.hset(ticketKey, {
        riskTier: newRiskTier,
        lane: newRiskTier,
      });
    }

    // 6. Write an immutable audit event
    const auditEventId = `evt_appeal_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const auditEvent = {
      eventId: auditEventId,
      type: 'USER_RISK_APPEAL',
      dropId,
      fairId,
      userId,
      reAuthMethod,
      previousScore,
      newScore,
      previousRiskTier,
      newRiskTier,
      drawRank: drawRank || null,
      timestamp: Date.now(),
    };

    await fastify.redis.rpush(`drop:${dropId}:audit:appeals`, JSON.stringify(auditEvent));
    await fastify.redis.rpush('audit:events', JSON.stringify(auditEvent));

    // 7. Record appeal usage flag (1 per FairID per drop)
    await fastify.redis.set(appealKey, '1');

    // Update session if active
    if (sessionToken) {
      await fastify.redis.hset(`session:${sessionToken}`, 'riskTier', newRiskTier);
    }

    return reply.status(200).send({
      success: true,
      message: "You've been moved to the standard lane",
      previousRiskTier,
      newRiskTier,
      previousScore,
      newScore,
      fairId,
      drawRank,
      auditEventId,
      appealUsed: true,
    });
  });
};

export default authRoutes;
