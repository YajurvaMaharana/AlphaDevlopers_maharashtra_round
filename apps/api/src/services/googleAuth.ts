import { createRemoteJWKSet, jwtVerify, SignJWT, errors } from 'jose';
import { FairDropError } from '@fairdrop/shared';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fairdrop_default_jwt_secret_dev_2026'
);

export interface GoogleVerifiedPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export interface IssuedSessionJWT {
  sub: string;
  email: string;
  fairId: string;
  riskTier: 'low' | 'medium' | 'high';
  authMethod: 'google' | 'otp';
}

/**
 * Verifies a Google ID token using Jose and Google's public JWKS endpoint.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  expectedClientId?: string
): Promise<GoogleVerifiedPayload> {
  const clientId = expectedClientId || process.env.GOOGLE_CLIENT_ID;

  // In DEMO_MODE or vitest testing, support test/demo Google tokens
  if (
    (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') &&
    idToken.startsWith('mock_google_token_')
  ) {
    const parts = idToken.split('_');
    const sub = parts[3] || 'google_sub_1092837465';
    const email = parts[4] ? `${parts[4]}@gmail.com` : 'google.fan@example.com';
    return {
      sub,
      email,
      emailVerified: true,
      name: 'Google Verified Fan',
    };
  }

  try {
    const { payload } = await jwtVerify(idToken, googleJWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId ? clientId : undefined,
    });

    if (!payload.email_verified) {
      throw new FairDropError(
        'EMAIL_NOT_VERIFIED',
        'Google account email is not verified. Please verify your email with Google.'
      );
    }

    if (!payload.sub || !payload.email) {
      throw new FairDropError('INVALID_TOKEN', 'Google token missing required claims (sub, email)');
    }

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name as string | undefined,
      picture: payload.picture as string | undefined,
    };
  } catch (err: any) {
    if (err instanceof FairDropError) {
      throw err;
    }

    // Check for network failure / JWKS unreachable
    const isNetworkError =
      err?.code === 'ERR_JWKS_FETCH_FAILED' ||
      err?.name === 'JWKSFetchFailed' ||
      err?.message?.includes('fetch') ||
      err?.message?.includes('ENOTFOUND') ||
      err?.message?.includes('getaddrinfo') ||
      err?.message?.includes('network');

    if (isNetworkError) {
      throw new FairDropError(
        'GOOGLE_JWKS_UNREACHABLE',
        'Google OAuth certificates are temporarily unreachable. You can continue with email OTP authentication.',
        { originalError: err?.message }
      );
    }

    if (err instanceof errors.JWTExpired) {
      throw new FairDropError('INVALID_TOKEN', 'Google ID token has expired. Please sign in again.');
    }

    if (err instanceof errors.JWTClaimValidationFailed || err instanceof errors.JWTInvalid) {
      throw new FairDropError(
        'INVALID_TOKEN',
        `Google token validation failed: ${err.message}`
      );
    }

    throw new FairDropError(
      'GOOGLE_AUTH_FAILED',
      `Google authentication verification failed: ${err.message}`
    );
  }
}

/**
 * Issues a signed application session JWT with identical shape for both Google and OTP authentication.
 */
export async function createSessionJwt(payload: IssuedSessionJWT): Promise<string> {
  const jwt = await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    fairId: payload.fairId,
    riskTier: payload.riskTier,
    authMethod: payload.authMethod,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  return jwt;
}
