const http = require('http');

async function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost',
      port: 80,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function randomIp() {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

async function run() {
  console.log("Resetting drop...");
  await request('POST', '/admin/drop/reset');

  console.log("Starting drop window for 10 seconds...");
  await request('POST', '/admin/drop/start', { inventory: 2000, windowSec: 10 });

  const total = 2000;
  console.log(`Joining ${total} users...`);
  
  const users = [];

  // Join in batches to not overwhelm the local server completely
  const batchSize = 100;
  let joinedCount = 0;

  const runId = Date.now();

  for (let i = 0; i < total; i += batchSize) {
    const batchPromises = [];
    for (let j = 0; j < batchSize; j++) {
      const id = i + j;
      const email = `bot${runId}_${id}@test.com`;
      const ip = randomIp();
      const fp = `fp-${runId}-${id}`;
      
      const p = (async () => {
        try {
          const reg = await request('POST', '/auth/register', { email }, { 'X-Forwarded-For': ip });
          if (!reg.data.otp) {
             // Rate limit?
             return null;
          }
          const ver = await request('POST', '/auth/verify', { email, otp: reg.data.otp, deviceFp: fp }, { 'X-Forwarded-For': ip });
          if (!ver.data.token) return null;
          const token = ver.data.token;
          
          const join = await request('POST', '/drop/join', {}, { 'Authorization': `Bearer ${token}` });
          if (join.status === 200) {
            joinedCount++;
            return { id, token, arrivalIndex: joinedCount };
          }
        } catch (e) { return null; }
        return null;
      })();
      batchPromises.push(p);
    }
    const results = await Promise.all(batchPromises);
    users.push(...results.filter(r => r !== null));
    console.log(`Progress: ${users.length} joined`);
  }

  console.log("Waiting for window to close and DRAWING to finish (approx 12 seconds)...");
  await new Promise(r => setTimeout(r, 12000));

  console.log("Fetching final ranks...");
  
  // Chunk fetching so we don't kill the server with 2000 parallel SSE requests
  for (let i = 0; i < users.length; i += 50) {
    const chunk = users.slice(i, i + 50);
    const rankPromises = chunk.map(async (u) => {
      return new Promise((resolve) => {
        const req = http.request({
          hostname: 'localhost',
          port: 80,
          path: '/drop/stream',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${u.token}`
          }
        }, (res) => {
          res.on('data', chunkData => {
            const str = chunkData.toString();
            const match = str.match(/data: (\{.*\})/);
            if (match) {
              try {
                const data = JSON.parse(match[1]);
                if (data.position !== null) {
                  u.finalRank = data.position;
                  res.destroy();
                  resolve();
                } else if (data.admitted === true) {
                  // already admitted, position won't be returned but rank is ~1
                  u.finalRank = 1;
                  res.destroy();
                  resolve();
                }
              } catch (e) {}
            }
          });
          res.on('error', () => resolve());
        });
        req.on('error', () => resolve());
        req.end();
      });
    });
    await Promise.all(rankPromises);
    console.log(`Fetched ranks for ${Math.min(i + 50, users.length)} / ${users.length} users`);
  }
  
  // Calculate Spearman's rank correlation coefficient
  // rs = 1 - (6 * sum(d^2)) / (n * (n^2 - 1))
  const n = users.length;
  let sumDSq = 0;
  
  let validUsers = 0;
  users.forEach(u => {
    if (u.finalRank !== undefined) {
      const d = u.arrivalIndex - u.finalRank;
      sumDSq += (d * d);
      validUsers++;
    }
  });

  if (validUsers < 2) {
    console.log("Not enough users got a rank. Did the draw run?");
    return;
  }

  const rs = 1 - ((6 * sumDSq) / (validUsers * (Math.pow(validUsers, 2) - 1)));
  console.log(`================================`);
  console.log(`Total valid users: ${validUsers}`);
  console.log(`Spearman rank correlation (Arrival vs Final): ${rs.toFixed(4)}`);
  console.log(`Near 0 means completely shuffled and fair (arrival time didn't matter).`);
  console.log(`================================`);
}

run().catch(console.error);
