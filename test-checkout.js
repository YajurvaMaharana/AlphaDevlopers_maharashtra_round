const crypto = require('crypto');
const http = require('http');

async function req(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: 80,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const request = http.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: raw }));
    });
    request.on('error', reject);
    if (body) request.write(data);
    request.end();
  });
}

async function testCheckout() {
  console.log("Setting up drop state...");
  
  // 1. Reset drop and set config
  await req('/admin/drop/reset', 'POST', {});
  await req('/admin/config', 'POST', {
    initial_inventory: '500',
    payment_latency_ms: '50',
    payment_failure_rate: '0'
  });
  
  const startRes = await req('/admin/drop/start', 'POST', { inventory: 500, windowSec: 1 });
  console.log("Start response:", startRes.status, startRes.data);
  // Wait for worker to transition to ADMITTING
  await new Promise(r => setTimeout(r, 5000));
  
  const { execSync } = require('child_process');
  execSync('docker exec fairdrop-db-1 psql -U postgres -d fairdrop -c "DELETE FROM allocations;"');
  
  const { SignJWT } = require('./apps/api/node_modules/jose');
  const secret = new TextEncoder().encode('supersecret123');
  const userId = crypto.randomUUID();
  
  execSync(`docker exec fairdrop-db-1 psql -U postgres -d fairdrop -c "INSERT INTO users (id, email, device_fp, ip_subnet) VALUES ('${userId}', 'test_${Date.now()}@test.com', 'test-fp', '127.0.0.1')"`);

  const token = await new SignJWT({ fp: 'test-fp', tier: 'normal', regAt: Date.now() })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
  
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  // 4. Force admit token in Redis (bypass drop queue just for testing checkout flow)
  // We can just use the internal worker wait, or directly hit a Redis script, but 
  // since the drop started with windowSec=0, the user hasn't joined.
  // Actually, we can just Join the drop and wait for admission.
  console.log("Joining drop...");
  await req('/drop/join', 'POST', {}, authHeaders);
  
  console.log("Waiting for admission (approx 3s)...");
  await new Promise(r => setTimeout(r, 3000));

  // 5. Check state
  const stateRes = await req('/me/state', 'GET', null, authHeaders);
  console.log("User state:", stateRes.data);
  const state = JSON.parse(stateRes.data);
  if (!state.hasAdmitToken) {
    console.error("FAIL: User did not get admit token");
    process.exit(1);
  }

  // 6. Reserve
  console.log("Sending Reserve request...");
  const idempotencyKey = "test-idem-123";
  const r1 = await req('/checkout/reserve', 'POST', { qty: 2 }, { ...authHeaders, 'Idempotency-Key': idempotencyKey });
  console.log("R1:", r1.status, r1.data);
  const r1Json = JSON.parse(r1.data);

  console.log("Sending DUPLICATE Reserve request...");
  const r2 = await req('/checkout/reserve', 'POST', { qty: 2 }, { ...authHeaders, 'Idempotency-Key': idempotencyKey });
  console.log("R2:", r2.status, r2.data);
  
  if (r1.data !== r2.data) {
    console.error("FAIL: Replay response doesn't match!");
    process.exit(1);
  } else {
    console.log("PASS: Idempotency cached response matched exactly.");
  }

  // 7. Pay
  console.log("Sending Pay request...");
  const payIdem = "test-idem-pay-123";
  const p1 = await req('/checkout/pay', 'POST', { holdId: r1Json.holdId }, { ...authHeaders, 'Idempotency-Key': payIdem });
  console.log("P1:", p1.status, p1.data);
  
  // 8. Pay duplicate
  console.log("Sending DUPLICATE Pay request...");
  const p2 = await req('/checkout/pay', 'POST', { holdId: r1Json.holdId }, { ...authHeaders, 'Idempotency-Key': payIdem });
  console.log("P2:", p2.status, p2.data);
  
  if (p1.data !== p2.data) {
    console.error("FAIL: Replay pay response doesn't match!");
    process.exit(1);
  } else {
    console.log("PASS: Pay idempotency cached response matched exactly.");
  }

  // 9. Check invariants
  const invReq = await req('/admin/invariants', 'GET');
  console.log("Invariants:", invReq.data);

  const invariants = JSON.parse(invReq.data);
  if (invariants.violations && invariants.violations.length > 0) {
    console.error("FAIL: Invariants violated!", invariants.violations);
    process.exit(1);
  }
  
  console.log("PASS: All invariants respected!");
  process.exit(0);
}

testCheckout().catch(console.error);
