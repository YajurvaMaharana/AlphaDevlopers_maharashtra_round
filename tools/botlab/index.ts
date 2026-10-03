import { parseArgs } from 'util';
import { Pool } from 'undici';
import fs from 'fs';
import path from 'path';
import { calculateGini, calculateSpearman } from '../../packages/shared/math';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { solveChallenge } = require('./powSolver.js');

const API_URL = process.env.API_URL || 'http://localhost:4000';

// Defensive check
const urlObj = new URL(API_URL);
const allowedHosts = ['localhost', '127.0.0.1', 'docker', 'api'];
if (!allowedHosts.some(host => urlObj.hostname.includes(host))) {
  console.error(`[ERROR] Defensive Test Harness: Target URL ${API_URL} is not in the allow-list.`);
  process.exit(1);
}

const pool = new Pool(API_URL, {
  connections: 500,
  pipelining: 10
});

async function runScenario() {
  const args = parseArgs({
    options: {
      scenario: { type: 'string', default: 'baseline_humans' },
      humans: { type: 'string', default: '100' },
      bots: { type: 'string', default: '10' },
      durationSec: { type: 'string', default: '10' },
      rps: { type: 'string', default: '50' },
      runId: { type: 'string', default: `run_${Date.now()}` }
    }
  });

  const { scenario, runId } = args.values;
  const humans = parseInt(args.values.humans as string, 10);
  const bots = parseInt(args.values.bots as string, 10);
  const durationSec = parseInt(args.values.durationSec as string, 10);
  const targetRps = parseInt(args.values.rps as string, 10);

  console.log(`[BotLab] Starting scenario: ${scenario}`);
  console.log(`[BotLab] Humans: ${humans}, Bots: ${bots}, RPS: ${targetRps}, Duration: ${durationSec}s`);

  const results = {
    joined: 0,
    reserved: 0,
    errors: 0,
    powSolved: 0,
    oversell: 0, // mock
    seatsByCohort: { human: 0, bot: 0 },
    latencies: [] as number[],
    participantArrivals: [] as any[]
  };

  const totalClients = humans + bots;
  const clients = Array.from({ length: totalClients }, (_, i) => {
    const isBot = i >= humans;
    return {
      id: `client_${i}`,
      cohort: isBot ? 'bot' : 'human',
      speedMs: isBot ? Math.floor(Math.random() * 50) + 20 : Math.floor(Math.random() * 700) + 100, // bots 20-70ms, humans 100-800ms
      successes: 0,
      ip: `192.168.1.${Math.floor(i / 10)}` // groups of 10 share IP
    };
  });

  // Calculate interval for desired RPS
  const intervalMs = 1000 / targetRps;
  const totalRequests = targetRps * durationSec;
  let requestsSent = 0;

  const startTime = Date.now();

  return new Promise<void>((resolve) => {
    const timer = setInterval(async () => {
      if (requestsSent >= totalRequests || Date.now() - startTime > durationSec * 1000) {
        clearInterval(timer);
        await finishRun(runId as string, scenario as string, humans, bots, durationSec, targetRps, results, clients);
        resolve();
        return;
      }

      requestsSent++;
      
      // Select client based on scenario
      let client;
      if (scenario === 'naive_flood' || scenario === 'replay_duplicate') {
        // Mostly bots sending
        client = Math.random() > 0.1 ? clients[humans + Math.floor(Math.random() * bots)] : clients[Math.floor(Math.random() * humans)];
      } else if (scenario === 'distributed_botnet' || scenario === 'sybil_signup') {
        // High bot ratio
        client = Math.random() > 0.05 ? clients[humans + Math.floor(Math.random() * bots)] : clients[Math.floor(Math.random() * humans)];
      } else {
        // Proportional
        client = clients[Math.floor(Math.random() * totalClients)];
      }

      if (!client) client = clients[0];

      executeClientFlow(client, results, scenario as string).catch(() => {});

    }, intervalMs);
  });
}

async function executeClientFlow(client: any, results: any, scenario: string) {
  const headers: Record<string, string> = {
    'x-sim-cohort': client.cohort,
    'content-type': 'application/json'
  };

  if (process.env.DEMO_MODE === 'true') {
    headers['x-forwarded-for'] = client.ip;
  }

  // Simulate speed/latency
  if (client.cohort === 'human' || scenario === 'headless_human_mimic') {
    await new Promise(r => setTimeout(r, client.speedMs));
  }

  try {
    const start = Date.now();
    
    // 1. Join Drop
    let joinRes = await pool.request({
      path: '/drop/join',
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: client.id })
    });

    if (joinRes.statusCode === 401 || joinRes.statusCode === 403) {
      // Need PoW
      const powChallenge = await pool.request({ path: '/pow/challenge', method: 'POST', body: JSON.stringify({ route: '/drop/join' }), headers });
      const challengeBody: any = await powChallenge.body.json().catch(()=>({}));
      
      if (challengeBody.prefix) {
        // Solve PoW
        // In distributed_botnet, bots solve instantly. Humans simulate CPU time.
        const difficulty = challengeBody.difficultyBits || 16;
        
        let powRes;
        if (client.cohort === 'bot' && scenario === 'distributed_botnet') {
           // Infinite CPU mock - solve locally immediately
           powRes = solveChallenge(challengeBody.prefix, difficulty);
        } else {
           powRes = solveChallenge(challengeBody.prefix, difficulty);
        }

        const solveReq = await pool.request({
          path: '/pow/solve',
          method: 'POST',
          headers,
          body: JSON.stringify({ challengeId: challengeBody.challengeId, nonce: powRes.nonce })
        });

        const solveBody: any = await solveReq.body.json().catch(()=>({}));
        if (solveBody.passToken) {
          headers['x-pow-pass'] = solveBody.passToken;
          results.powSolved++;
        }
      }

      // Retry Join
      joinRes = await pool.request({
        path: '/drop/join',
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: client.id })
      });
    }

    if (joinRes.statusCode === 200) {
      results.joined++;
      results.participantArrivals.push({ id: client.id, time: Date.now() });

      // 2. Reserve
      const reserveRes = await pool.request({
        path: '/checkout/reserve',
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: client.id })
      });

      if (reserveRes.statusCode === 200) {
        results.reserved++;
        results.seatsByCohort[client.cohort]++;
        client.successes++;
      }
    } else {
      results.errors++;
    }

    results.latencies.push(Date.now() - start);
  } catch (err) {
    results.errors++;
  }
}

async function finishRun(runId: string, scenario: string, humans: number, bots: number, durationSec: number, rps: number, results: any, clients: any[]) {
  console.log(`[BotLab] Run ${runId} completed.`);
  
  const totalSeats = results.seatsByCohort.human + results.seatsByCohort.bot || 1;
  const botSeatShare = (results.seatsByCohort.bot / totalSeats) * 100;
  
  const p95 = results.latencies.length > 0 
    ? results.latencies.sort((a: number, b: number) => a - b)[Math.floor(results.latencies.length * 0.95)] 
    : 0;

  const errorRate = results.latencies.length > 0 ? (results.errors / results.latencies.length) * 100 : 0;

  // Gini
  const seatCounts = clients.map(c => c.successes);
  const gini = calculateGini(seatCounts);

  // Speed Advantage (Spearman)
  // rank by arrival vs rank by success
  const arrivalRanks = clients.map((c, i) => i); // simplified mocked arrival
  const finalRanks = clients.map(c => c.successes > 0 ? 1 : 100); 
  const speedAdvantageIndex = calculateSpearman(arrivalRanks, finalRanks);

  const report = {
    runId,
    scenario,
    params: { humans, bots, durationSec, rps },
    seatsByCohort: results.seatsByCohort,
    botSeatShare,
    gini,
    speedAdvantageIndex,
    p95,
    errorRate,
    oversell: results.oversell,
    durationSec
  };

  const reportsDir = path.resolve(__dirname, '../../../reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  
  fs.writeFileSync(path.join(reportsDir, `${runId}.json`), JSON.stringify(report, null, 2));
  console.log(`[BotLab] Report saved to /reports/${runId}.json`);
  console.log(JSON.stringify(report, null, 2));

  process.exit(0);
}

runScenario();
