import { RunReport } from '@fairdrop/shared';

export const STATIC_DEFENSES_OFF_REPORT: RunReport = {
  runId: 'run_sim_fcfs_001',
  scenario: 'distributed_botnet',
  scenarioName: 'Distributed Botnet Flood (FCFS Baseline)',
  defensesEnabled: false,
  parameters: {
    totalClients: 5000,
    botRatio: 0.8,
    durationSeconds: 30,
    totalSeats: 500,
    rateLimitRps: 0,
    powDifficulty: 0,
  },
  metrics: {
    botSeatSharePct: 68.4,
    humanSeatSharePct: 31.6,
    giniCoefficient: 0.82,
    speedAdvantageIndex: 0.94,
    oversellCount: 14,
    p95LatencyMs: 3420,
    errorRatePct: 41.2,
    totalRequests: 84500,
    rejectedRequests: 4200,
    seatsSold: 500,
    totalSeats: 500,
  },
  completedAt: 1718293849000,
};

export const STATIC_DEFENSES_ON_REPORT: RunReport = {
  runId: 'run_sim_fairdrop_002',
  scenario: 'distributed_botnet',
  scenarioName: 'Distributed Botnet Flood (FairDrop Defenses Armed)',
  defensesEnabled: true,
  parameters: {
    totalClients: 5000,
    botRatio: 0.8,
    durationSeconds: 30,
    totalSeats: 500,
    rateLimitRps: 50,
    powDifficulty: 4,
  },
  metrics: {
    botSeatSharePct: 2.8,
    humanSeatSharePct: 97.2,
    giniCoefficient: 0.05,
    speedAdvantageIndex: 0.01,
    oversellCount: 0,
    p95LatencyMs: 24,
    errorRatePct: 0.2,
    totalRequests: 84500,
    rejectedRequests: 62400,
    seatsSold: 500,
    totalSeats: 500,
  },
  completedAt: 1718294120000,
};
