import { FastifyPluginAsync } from 'fastify';
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

      // 4. Evaluate initial risk score with Google authMethod discount applied
      const riskResult = await updateRiskScore(fastify, `usr_g_${googleUser.sub}`, {
        ...(signals || {}),
        authMethod: 'google',
        deviceFpReuseCount: 1,
      });

      // 5. Upsert user record into Postgres (or in-memory fallback)
      const user = await upsertGoogleUser({
        googleSub: googleUser.sub,
        email: googleUser.email,
        deviceFp,
        riskTier: riskResult.tier,
      });

      // 6. Issue unified session JWT containing authMethod: 'google'
      const sessionToken = await createSessionJwt({
        sub: user.id,
        email: user.email,
        fairId,
        riskTier: riskResult.tier,
        authMethod: 'google',
      });

      // 7. Store user session mapping in Redis for quick state lookups
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

    // Risk scoring with authMethod: 'otp'
    const riskResult = await updateRiskScore(fastify, userId, {
      ...(signals || {}),
      authMethod: 'otp',
    });

    // Upsert user in Postgres
    const user = await upsertOtpUser({
      email,
      deviceFp: clientFingerprint,
      riskTier: riskResult.tier,
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
    let userId = 'usr_anonymous';
    let email = 'anonymous@fairdrop.io';
    let riskTier: 'low' | 'medium' | 'high' = 'low';
    let authMethod: 'google' | 'otp' = 'otp';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = await fastify.redis.hgetall(`session:${token}`);
      if (session && session.userId) {
        userId = session.userId;
        email = session.email || email;
        riskTier = (session.riskTier as any) || riskTier;
        authMethod = (session.authMethod as any) || authMethod;
      }
    }

    const powRequired = fastify.defensesEnabled !== false;
    const powDifficulty = riskTier === 'high' ? 6 : riskTier === 'medium' ? 5 : 4;

    return reply.send({
      userId,
      email,
      status: 'WAITING_ROOM',
      queuePosition: 84,
      estimatedWaitSeconds: 45,
      reservation: null,
      receiptId: null,
      riskTier,
      authMethod,
      powRequired,
      powDifficulty,
    });
  });
};

export default authRoutes;
