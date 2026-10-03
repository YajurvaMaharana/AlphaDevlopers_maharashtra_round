#!/bin/bash
# Chaos Demo Script for Fairdrop API
# Requires curl, jq, and the API running on localhost:4000
set -e

API_URL="http://localhost:4000"

echo "======================================"
echo " Starting Chaos Engineering Demo"
echo "======================================"

echo -e "\n1. Starting a simulated drop traffic..."
# You could run botlab here, for now we just verify basic endpoints
curl -s -X POST $API_URL/admin/drop/setup > /dev/null
echo "Drop started."

fetch_invariants() {
    # Since invariants are cached to system:invariants, we could query the stream or an endpoint.
    # To keep the bash script simple, we assume there's a debug route or we can grep it from metrics stream.
    echo "Fetching current invariant status from metrics stream (waiting 1.5s)..."
    curl -s -N $API_URL/metrics/stream | head -n 2 | grep -o '"invariants":{[^}]*}' || echo '"invariants": "no data"'
}

fetch_invariants

echo -e "\n2. Injecting Chaos: kill_api_replica"
curl -s -X POST $API_URL/admin/chaos -H "Content-Type: application/json" -d '{"action":"kill_api_replica"}' | jq
sleep 2
echo "Testing survival (fallback to other replica if running via load balancer, or wait for Docker restart):"
curl -s -I $API_URL/health | head -n 1
fetch_invariants

echo -e "\n3. Injecting Chaos: restart_redis"
curl -s -X POST $API_URL/admin/chaos -H "Content-Type: application/json" -d '{"action":"restart_redis"}' | jq
sleep 3
fetch_invariants

echo -e "\n4. Injecting Chaos: slow_postgres"
curl -s -X POST $API_URL/admin/chaos -H "Content-Type: application/json" -d '{"action":"slow_postgres"}' | jq
sleep 2
fetch_invariants

echo -e "\n5. Injecting Chaos: payment_outage"
curl -s -X POST $API_URL/admin/chaos -H "Content-Type: application/json" -d '{"action":"payment_outage"}' | jq
sleep 2
fetch_invariants

echo -e "\n======================================"
echo " Chaos Demo Completed."
echo " Invariants strictly checked every second!"
echo "======================================"
