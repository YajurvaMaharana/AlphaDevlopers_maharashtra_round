import Fastify from 'fastify';
import { env } from './env';
import Redis from 'ioredis';
import { Client } from 'pg';

// Setup Fastify with structured logging
const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  },
});

// Setup Redis Client with retry strategy
const redis = new Redis(env.REDIS_URL, {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => fastify.log.info('Connected to Redis'));
redis.on('error', (err) => fastify.log.error(err, 'Redis error'));

// Setup Postgres Migration Runner
async function runMigrations() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
    fastify.log.info('Connected to Postgres');
    
    // Create a dummy migration table if it doesn't exist to verify functionality
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    fastify.log.info('Migrations verified/run successfully');
  } catch (err) {
    fastify.log.error(err, 'Postgres migration error');
    throw err;
  } finally {
    await client.end();
  }
}

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
    
    // Start fastify listener
    await fastify.listen({ port: parseInt(env.PORT, 10), host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
