import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env';
import { redis } from './redis';
import { pool } from './db';
import { jwtVerifyPlugin } from './plugins/jwt';
import { abuseGuardPlugin } from './plugins/abuseGuard';
import { authRoutes } from './routes/auth';
import { dropRoutes } from './routes/drop';
import { adminRoutes } from './routes/admin';
import { checkoutRoutes } from './routes/checkout';
import { meRoutes } from './routes/me';
import { startDropWorker } from './services/drop';
import { startInventoryWorker } from './services/inventory';

// Setup Fastify with structured logging
const fastify = Fastify({
  trustProxy: true,
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  },
});

redis.on('connect', () => fastify.log.info('Connected to Redis'));
redis.on('error', (err) => fastify.log.error(err, 'Redis error'));

// Setup Postgres Migration Runner
async function runMigrations() {
  const client = await pool.connect();
  try {
    fastify.log.info('Connected to Postgres');
    
    // Create migrations and users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        device_fp VARCHAR(255) NOT NULL,
        ip_subnet VARCHAR(45) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        risk_tier VARCHAR(50) DEFAULT 'normal'
      );

      CREATE TABLE IF NOT EXISTS allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        hold_id VARCHAR(255) NOT NULL,
        qty INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        round_id INT NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        committed_at TIMESTAMP
      );

      ALTER TABLE allocations DROP CONSTRAINT IF EXISTS alloc_unique_idem;
      ALTER TABLE allocations ADD CONSTRAINT alloc_unique_idem UNIQUE (user_id, round_id, idempotency_key);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_allocations_committed ON allocations (user_id, round_id) WHERE status = 'COMMITTED';
    `);
    
    fastify.log.info('Migrations verified/run successfully');
  } catch (err) {
    fastify.log.error(err, 'Postgres migration error');
    throw err;
  } finally {
    client.release();
  }
}

// Register CORS — must be registered before routes
fastify.register(cors, {
  // Allow the Next.js dev server and any origin when DEMO_MODE is on
  origin: (origin, cb) => {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ];
    if (!origin || env.DEMO_MODE || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS: origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'Last-Event-ID',
  ],
});

// Register plugins
fastify.register(abuseGuardPlugin);
fastify.register(jwtVerifyPlugin);

// Register routes
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(dropRoutes, { prefix: '/drop' });
fastify.register(adminRoutes, { prefix: '/admin' });
fastify.register(checkoutRoutes, { prefix: '/checkout' });
fastify.register(meRoutes, { prefix: '/me' });

// Health check endpoint with replica ID
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    replica: env.REPLICA_ID
  };
});

// Start Server
async function start() {
  try {
    // Run migrations before accepting requests
    await runMigrations();
    
    // Start background worker for Drop engine (it handles locking automatically)
    startDropWorker();
    startInventoryWorker();
    
    // Start fastify listener
    await fastify.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
