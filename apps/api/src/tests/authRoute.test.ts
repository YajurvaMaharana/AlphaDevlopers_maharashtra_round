import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server';
import { FastifyInstance } from 'fastify';

describe('Fastify Auth Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    process.env.NODE_ENV = 'test';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/google should authenticate valid Google ID token and return unified session JWT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        idToken: 'mock_google_token_sub987654_bobsmtih',
        deviceFp: 'device_canvas_fingerprint_001',
        signals: { requestsPerMin: 2, behaviorScore: 0.95 },
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.success).toBe(true);
    expect(json.token).toBeDefined();
    expect(json.user.email).toBe('bobsmtih@gmail.com');
    expect(json.user.authMethod).toBe('google');
    expect(json.user.fairId).toBeDefined();
    expect(json.fairId).toBeDefined();
    expect(json.user.riskTier).toBe('low');
  });

  it('POST /auth/google should reject empty / missing payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json.code).toBe('BAD_REQUEST');
  });

  it('POST /auth/register and POST /auth/verify should keep OTP flow functioning', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'otpuser@example.com',
        clientFingerprint: 'device_fingerprint_otp_002',
      },
    });

    expect(regRes.statusCode).toBe(200);
    const regJson = regRes.json();
    expect(regJson.success).toBe(true);
    expect(regJson.otp).toBe('123456');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/auth/verify',
      payload: {
        email: 'otpuser@example.com',
        otp: '123456',
        clientFingerprint: 'device_fingerprint_otp_002',
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyJson = verifyRes.json();
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.user.authMethod).toBe('otp');
    expect(verifyJson.user.fairId).toBeDefined();
  });
});
