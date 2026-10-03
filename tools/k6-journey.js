import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 5000 }, // ramp up to 5k VUs
    { duration: '1m', target: 5000 },  // stay at 5k VUs
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1500'], // 95% of requests must complete below 1.5s
    'http_req_failed': ['rate<0.05'],    // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000'; // Target nginx or API

// Simulated PoW solver for k6 (very basic/fast mock for k6 load limits)
// For a true integration we'd either run an actual hash loop or rely on botlab for exact CPU constraint.
function solvePowMock(prefix, difficulty) {
  // Mock finding a nonce in K6 (avoiding extreme CPU blocking across 5000 VUs)
  return 'k6_mock_nonce';
}

export default function () {
  const isBot = Math.random() < 0.05; // 5% bots
  const cohort = isBot ? 'bot' : 'human';
  const userId = `vu_${__VU}_${randomString(8)}`;

  const headers = { 
    'Content-Type': 'application/json',
    'X-Sim-Cohort': cohort
  };

  // 1. Register (Simulated via drop/join for now, or actual register endpoint)
  let res = http.post(`${BASE_URL}/drop/join`, JSON.stringify({ userId }), { 
    headers,
    tags: { name: 'Join Drop', cohort }
  });
  
  check(res, { 'joined or challenged': (r) => r.status === 200 || r.status === 401 || r.status === 403 });

  // Handle PoW Challenge if required
  if (res.status === 401 || res.status === 403) {
    const powChallenge = http.post(`${BASE_URL}/pow/challenge`, JSON.stringify({ route: '/drop/join' }), { headers, tags: { name: 'PoW Challenge', cohort }});
    if (powChallenge.status === 200) {
      const challenge = powChallenge.json();
      const nonce = solvePowMock(challenge.prefix, challenge.difficultyBits);
      
      const powSolve = http.post(`${BASE_URL}/pow/solve`, JSON.stringify({ challengeId: challenge.challengeId, nonce }), { headers, tags: { name: 'PoW Solve', cohort }});
      if (powSolve.status === 200) {
        headers['X-Pow-Pass'] = powSolve.json('passToken');
      }
    }
    
    // Re-join with PoW token
    res = http.post(`${BASE_URL}/drop/join`, JSON.stringify({ userId }), { headers, tags: { name: 'Join Retry', cohort }});
    check(res, { 'joined successfully': (r) => r.status === 200 });
  }

  if (res.status !== 200) return;

  // Think time
  sleep(isBot ? 0.1 : Math.random() * 2 + 1); // Human: 1-3s, Bot: 100ms

  // 2. Poll Status (mock endpoint or actual)
  res = http.get(`${BASE_URL}/metrics/stream`, { headers, tags: { name: 'Poll Status', cohort }});
  // Since stream hangs, we'd only do a quick fetch in reality. Skip polling in load test to avoid hanging connections if not required.

  // 3. Reserve
  res = http.post(`${BASE_URL}/checkout/reserve`, JSON.stringify({ userId }), { headers, tags: { name: 'Reserve', cohort }});
  check(res, { 'reserved successfully': (r) => r.status === 200 });

  if (res.status !== 200) return;

  // Think time
  sleep(isBot ? 0.2 : Math.random() * 3 + 2); // Human: 2-5s, Bot: 200ms

  // 4. Pay
  res = http.post(`${BASE_URL}/checkout/pay`, JSON.stringify({ userId }), { headers, tags: { name: 'Pay', cohort }});
  check(res, { 'paid successfully': (r) => r.status === 200 });
}
