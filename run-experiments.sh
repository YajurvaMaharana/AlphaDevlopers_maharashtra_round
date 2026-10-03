#!/bin/bash
# run-experiments.sh
set -e

API_URL="http://localhost:4000"
SCENARIOS=("baseline_humans" "naive_flood" "distributed_botnet" "replay_duplicate" "sybil_signup" "slow_payment")
DEFENSES=("off" "on")
ITERATIONS=3

mkdir -p reports

echo "=========================================="
echo " Starting BotLab FairDrop Experiments"
echo "=========================================="

for scenario in "${SCENARIOS[@]}"; do
  for defense in "${DEFENSES[@]}"; do
    
    # Toggle defenses
    DEF_STATE=false
    if [ "$defense" == "on" ]; then
      DEF_STATE=true
    fi
    curl -s -X POST $API_URL/admin/defenses -H "Content-Type: application/json" -d "{\"enabled\": $DEF_STATE}" > /dev/null

    for n in $(seq 1 $ITERATIONS); do
      echo -e "\nRunning Scenario: $scenario | Defenses: $defense | Iteration: $n"
      
      # Reset the drop (flush DB or run setup)
      # Assuming POST /admin/drop/setup resets everything
      curl -s -X POST $API_URL/admin/drop/setup > /dev/null

      # Generate runId
      RUN_ID="${scenario}-${defense}-${n}"

      # Use botlab to run the attack (5000 total users, highly condensed for time)
      # We adjust bots/humans depending on scenario inside botlab normally, but here we set a generic param.
      HUMANS=4500
      BOTS=500
      DURATION=15
      RPS=300
      
      # Run the botlab swarm controller
      npx tsx tools/botlab/index.ts \
        --scenario $scenario \
        --humans $HUMANS \
        --bots $BOTS \
        --durationSec $DURATION \
        --rps $RPS \
        --runId $RUN_ID > /dev/null

      echo "Saved to /reports/$RUN_ID.json"
      sleep 2
    done
  done
done

echo -e "\n=========================================="
echo " Experiments Complete. Generating Report..."
echo "=========================================="

# Node script to parse reports and print markdown table
cat << 'EOF' > parse_reports.js
const fs = require('fs');
const path = require('path');

const reportsDir = path.join(__dirname, 'reports');
const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));

const scenarios = ["baseline_humans", "naive_flood", "distributed_botnet", "replay_duplicate", "sybil_signup", "slow_payment"];
const defenses = ["off", "on"];

console.log('| Scenario | Defenses | Bot Seat Share % | Gini Coeff | Speed Adv | p95 (ms) | Oversell |');
console.log('|----------|----------|------------------|------------|-----------|----------|----------|');

scenarios.forEach(scen => {
  defenses.forEach(def => {
    let runs = 0;
    let sumBot = 0, sumGini = 0, sumSpeed = 0, sumP95 = 0, sumOversell = 0;

    files.forEach(f => {
      if (f.startsWith(`${scen}-${def}-`)) {
        const data = JSON.parse(fs.readFileSync(path.join(reportsDir, f)));
        sumBot += data.botSeatShare || 0;
        sumGini += data.gini || 0;
        sumSpeed += data.speedAdvantageIndex || 0;
        sumP95 += data.p95 || 0;
        sumOversell += data.oversell || 0;
        runs++;
      }
    });

    if (runs > 0) {
      console.log(`| ${scen.padEnd(8)} | ${def.padEnd(8)} | ${(sumBot/runs).toFixed(1).padEnd(16)} | ${(sumGini/runs).toFixed(3).padEnd(10)} | ${(sumSpeed/runs).toFixed(3).padEnd(9)} | ${(sumP95/runs).toFixed(0).padEnd(8)} | ${(sumOversell/runs).toFixed(0).padEnd(8)} |`);
    }
  });
});
EOF

node parse_reports.js
rm parse_reports.js
