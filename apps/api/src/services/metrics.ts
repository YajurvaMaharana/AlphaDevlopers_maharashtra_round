import { redis } from '../redis';
import { abuseMetrics } from '../plugins/abuseGuard';

export async function getOperationalMetrics() {
  const isDefensesEnabled = await redis.get('defenses:enabled');
  
  return {
    system: {
      totalIncomingRequests: abuseMetrics.totalReqs,
      defensesEnabled: isDefensesEnabled !== 'false'
    },
    rateLimits: abuseMetrics.rateLimits,
    tarpittedRequests: abuseMetrics.tarpits,
    activePenaltyBans: abuseMetrics.activeBans
  };
}
