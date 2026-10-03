const http = require('http');

const CONCURRENCY = 500;
const DURATION_MS = 2000;
const HOST = 'localhost';
const PORT = 80;
const PATH = '/health'; // 'status' route group, rate limit: 60 points/min

let reqCount = 0;
let statusCodes = {};
let startTime;

async function sendReq() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: PATH,
      method: 'GET',
      headers: {
        'X-Device-Fingerprint': 'flood-bot-1',
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
        if (res.statusCode === 429 && statusCodes[res.statusCode] === 1) {
           const timeToLimit = Date.now() - startTime;
           console.log(`[!] First 429 received after ${timeToLimit}ms`);
        }
        resolve();
      });
    });
    
    req.on('error', () => resolve()); // ignore socket hangups under load
    req.end();
  });
}

async function runFlood() {
  console.log(`Starting flood: ${CONCURRENCY} reqs/s for ${DURATION_MS}ms...`);
  startTime = Date.now();
  
  const endAt = startTime + DURATION_MS;
  const promises = [];
  
  const interval = setInterval(() => {
     if (Date.now() >= endAt) return clearInterval(interval);
     for(let i=0; i<CONCURRENCY/10; i++) { // send batches 10 times a second
        reqCount++;
        promises.push(sendReq());
     }
  }, 100);

  await new Promise(r => setTimeout(r, DURATION_MS + 500));
  await Promise.all(promises);
  
  console.log(`\nFlood completed in ${Date.now() - startTime}ms`);
  console.log(`Total Requests Sent: ${reqCount}`);
  console.log(`Status Codes:`, statusCodes);
}

async function setDefenses(enabled) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ on: enabled });
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: '/admin/defenses',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log("--- TEST 1: DEFENSES ON ---");
  await setDefenses(true);
  await runFlood();
  
  console.log("\nWaiting 2s for connections to close...\n");
  await new Promise(r => setTimeout(r, 2000));
  
  // reset metrics counters
  reqCount = 0;
  statusCodes = {};

  console.log("--- TEST 2: DEFENSES OFF ---");
  await setDefenses(false);
  await runFlood();
}

main().catch(console.error);
