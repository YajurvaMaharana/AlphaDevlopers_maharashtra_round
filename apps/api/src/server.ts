import Fastify from 'fastify';
import { env } from './env';
import { redis } from './redis';
import { pool } from './db';
import { jwtVerifyPlugin } from './plugins/jwt';
import { authRoutes } from './routes/auth';
import { dropRoutes } from './routes/drop';
import { adminRoutes } from './routes/admin';
import { startDropWorker } from './services/drop';

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
    `);
    
    fastify.log.info('Migrations verified/run successfully');
  } catch (err) {
    fastify.log.error(err, 'Postgres migration error');
    throw err;
  } finally {
    client.release();
  }
}

// Register plugins
fastify.register(jwtVerifyPlugin);

// Register routes
fastify.register(authRoutes, { prefix: '/auth' });
fastify.register(dropRoutes, { prefix: '/drop' });
fastify.register(adminRoutes, { prefix: '/admin' });

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
    
    // Start fastify listener
    await fastify.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
