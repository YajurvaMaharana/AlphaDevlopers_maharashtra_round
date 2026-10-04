import { Pool } from 'pg';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  email: string;
  google_sub?: string | null;
  fair_id: string;
  auth_method: 'google' | 'otp';
  risk_tier: 'low' | 'medium' | 'high';
  created_at: Date;
  updated_at: Date;
}

// In-memory fallback map for environments without a live PostgreSQL instance
const inMemoryUsers = new Map<string, UserRecord>();
const inMemoryByGoogleSub = new Map<string, UserRecord>();
const inMemoryByEmail = new Map<string, UserRecord>();

let pool: Pool | null = null;
let isConnected = false;

export function getPostgresPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });
    return pool;
  } catch (err) {
    console.warn('[Postgres] Failed to initialize pool, using in-memory store fallback');
    return null;
  }
}

export async function initPostgres(): Promise<boolean> {
  const p = getPostgresPool();
  if (!p) {
    console.info('[Postgres] No database URL found, using in-memory user repository');
    return false;
  }

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          google_sub VARCHAR(255) UNIQUE,
          fair_id VARCHAR(64) UNIQUE,
          auth_method VARCHAR(20) NOT NULL DEFAULT 'otp' CHECK (auth_method IN ('google', 'otp')),
          risk_tier VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (risk_tier IN ('low', 'medium', 'high')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
        CREATE INDEX IF NOT EXISTS idx_users_fair_id ON users(fair_id);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
      isConnected = true;
      console.info('[Postgres] Initialized database and applied migration 001');
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn(`[Postgres] Connection failed (${err.message}), using in-memory user repository fallback`);
    isConnected = false;
    return false;
  }
}

/**
 * Computes FairID: SHA-256(google_sub or email + ':' + deviceFp)
 * One FairID = one lottery ticket
 */
export function computeFairId(identifier: string, deviceFp: string): string {
  return crypto.createHash('sha256').update(`${identifier}:${deviceFp}`).digest('hex');
}

/**
 * Upserts a user authenticated via Google
 */
export async function upsertGoogleUser(params: {
  googleSub: string;
  email: string;
  deviceFp: string;
  riskTier?: 'low' | 'medium' | 'high';
}): Promise<UserRecord> {
  const { googleSub, email, deviceFp, riskTier = 'low' } = params;
  const fairId = computeFairId(googleSub, deviceFp);
  const p = getPostgresPool();

  if (p && isConnected) {
    try {
      const generatedId = `usr_g_${crypto.randomBytes(8).toString('hex')}`;
      const query = `
        INSERT INTO users (id, email, google_sub, fair_id, auth_method, risk_tier, updated_at)
        VALUES ($1, $2, $3, $4, 'google', $5, NOW())
        ON CONFLICT (google_sub) DO UPDATE SET
          email = EXCLUDED.email,
          fair_id = EXCLUDED.fair_id,
          auth_method = 'google',
          risk_tier = EXCLUDED.risk_tier,
          updated_at = NOW()
        RETURNING id, email, google_sub, fair_id, auth_method, risk_tier, created_at, updated_at;
      `;
      const res = await p.query(query, [generatedId, email, googleSub, fairId, riskTier]);
      return res.rows[0] as UserRecord;
    } catch (err) {
      console.warn('[Postgres] Query failed, falling back to in-memory store', err);
    }
  }

  // In-memory fallback
  let user = inMemoryByGoogleSub.get(googleSub);
  if (user) {
    user.email = email;
    user.fair_id = fairId;
    user.auth_method = 'google';
    user.risk_tier = riskTier;
    user.updated_at = new Date();
  } else {
    user = {
      id: `usr_g_${crypto.randomBytes(8).toString('hex')}`,
      email,
      google_sub: googleSub,
      fair_id: fairId,
      auth_method: 'google',
      risk_tier: riskTier,
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryUsers.set(user.id, user);
    inMemoryByGoogleSub.set(googleSub, user);
    inMemoryByEmail.set(email, user);
  }
  return user;
}

/**
 * Upserts a user authenticated via OTP
 */
export async function upsertOtpUser(params: {
  email: string;
  deviceFp: string;
  riskTier?: 'low' | 'medium' | 'high';
}): Promise<UserRecord> {
  const { email, deviceFp, riskTier = 'low' } = params;
  const fairId = computeFairId(email, deviceFp);
  const p = getPostgresPool();

  if (p && isConnected) {
    try {
      const generatedId = `usr_otp_${crypto.createHash('md5').update(email).digest('hex').slice(0, 16)}`;
      const query = `
        INSERT INTO users (id, email, fair_id, auth_method, risk_tier, updated_at)
        VALUES ($1, $2, $3, 'otp', $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          fair_id = EXCLUDED.fair_id,
          auth_method = 'otp',
          risk_tier = EXCLUDED.risk_tier,
          updated_at = NOW()
        RETURNING id, email, google_sub, fair_id, auth_method, risk_tier, created_at, updated_at;
      `;
      const res = await p.query(query, [generatedId, email, fairId, riskTier]);
      return res.rows[0] as UserRecord;
    } catch (err) {
      console.warn('[Postgres] Query failed, falling back to in-memory store', err);
    }
  }

  // In-memory fallback
  let user = inMemoryByEmail.get(email);
  if (user) {
    user.fair_id = fairId;
    user.auth_method = 'otp';
    user.risk_tier = riskTier;
    user.updated_at = new Date();
  } else {
    user = {
      id: `usr_otp_${crypto.createHash('md5').update(email).digest('hex').slice(0, 16)}`,
      email,
      google_sub: null,
      fair_id: fairId,
      auth_method: 'otp',
      risk_tier: riskTier,
      created_at: new Date(),
      updated_at: new Date(),
    };
    inMemoryUsers.set(user.id, user);
    inMemoryByEmail.set(email, user);
  }
  return user;
}
