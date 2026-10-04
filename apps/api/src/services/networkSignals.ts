import defaultRanges from '../data/networkRanges.json';

export type AsnType = 'residential' | 'datacenter' | 'vpn_proxy' | 'unknown';

export interface NetworkCidrEntry {
  cidr: string;
  asnType: AsnType;
  name?: string;
  country: string;
  expectedTimezones: string[];
}

export interface NetworkInfo {
  asnType: AsnType;
  subnet24: string;
  country: string;
  expectedTimezones: string[];
  name?: string;
}

/**
 * Converts an IPv4 string (e.g. "192.168.1.10") to an unsigned 32-bit integer.
 */
export function ipToInt(ip: string): number | null {
  if (!ip || typeof ip !== 'string') return null;

  // Clean IPv6-mapped IPv4 e.g. "::ffff:192.168.1.1"
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim();

  const parts = cleanIp.split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const num = Number(parts[i]);
    if (isNaN(num) || num < 0 || num > 255 || parts[i].trim() === '') {
      return null;
    }
    result = ((result << 8) | num) >>> 0;
  }
  return result;
}

/**
 * Parses a CIDR string (e.g. "192.168.1.0/24") into network integer and bitmask.
 */
export function parseCidr(cidr: string): { network: number; mask: number; prefixLen: number } | null {
  if (!cidr || typeof cidr !== 'string') return null;
  const [ipPart, prefixPart] = cidr.trim().split('/');
  const prefixLen = prefixPart !== undefined ? parseInt(prefixPart, 10) : 32;

  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return null;

  const ipInt = ipToInt(ipPart);
  if (ipInt === null) return null;

  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  const network = (ipInt & mask) >>> 0;

  return { network, mask, prefixLen };
}

/**
 * Extracts the /24 subnet string for an IPv4 address.
 */
export function extractSubnet24(ip: string): string {
  if (!ip || typeof ip !== 'string') return '0.0.0.0/24';
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim();
  const parts = cleanIp.split('.');
  if (parts.length === 4 && parts.every((p) => !isNaN(Number(p)))) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return cleanIp;
}

/**
 * Pure function: looks up an IP against CIDR ranges table.
 * Returns the most specific matching range or unknown fallback.
 */
export function lookupIpNetwork(
  ip: string,
  ranges: NetworkCidrEntry[] = defaultRanges as NetworkCidrEntry[]
): NetworkInfo {
  const subnet24 = extractSubnet24(ip);
  const ipInt = ipToInt(ip);

  if (ipInt === null) {
    return {
      asnType: 'unknown',
      subnet24,
      country: 'ZZ',
      expectedTimezones: [],
      name: 'Invalid/Unparseable IP',
    };
  }

  let bestMatch: NetworkCidrEntry | null = null;
  let bestPrefixLen = -1;

  for (const entry of ranges) {
    const parsed = parseCidr(entry.cidr);
    if (!parsed) continue;

    if ((ipInt & parsed.mask) >>> 0 === parsed.network) {
      if (parsed.prefixLen > bestPrefixLen) {
        bestPrefixLen = parsed.prefixLen;
        bestMatch = entry;
      }
    }
  }

  if (bestMatch) {
    return {
      asnType: bestMatch.asnType,
      subnet24,
      country: bestMatch.country,
      expectedTimezones: bestMatch.expectedTimezones || [],
      name: bestMatch.name,
    };
  }

  return {
    asnType: 'unknown',
    subnet24,
    country: 'ZZ',
    expectedTimezones: [],
    name: 'Unmapped Public IP',
  };
}

/**
 * Checks if the client-reported timezone mismatches the IP location's expected timezones.
 */
export function checkTimezoneMismatch(
  clientTimezone?: string,
  expectedTimezones?: string[]
): boolean {
  if (!clientTimezone || !expectedTimezones || expectedTimezones.length === 0) {
    return false;
  }

  const normalizedClient = clientTimezone.trim().toLowerCase();

  const isMatched = expectedTimezones.some((tz) => {
    const norm = tz.trim().toLowerCase();
    return (
      norm === normalizedClient ||
      normalizedClient.endsWith(`/${norm}`) ||
      norm.endsWith(`/${normalizedClient}`)
    );
  });

  return !isMatched;
}

/**
 * Checks if an IP is within trusted private/proxy ranges.
 */
function isTrustedProxyIp(ip: string): boolean {
  if (!ip) return false;
  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip.trim();
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') return true;

  const trustedProxyCidrs = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
  const ipInt = ipToInt(cleanIp);
  if (ipInt === null) return false;

  return trustedProxyCidrs.some((cidr) => {
    const parsed = parseCidr(cidr);
    return parsed ? (ipInt & parsed.mask) >>> 0 === parsed.network : false;
  });
}

/**
 * Safely extracts client IP from request:
 * - When DEMO_MODE=true: honours simulated/spoofed headers (x-forwarded-for, x-sim-ip).
 * - When DEMO_MODE=false: only trusts X-Forwarded-For if incoming connection is from a trusted proxy.
 */
export function extractClientIp(
  request: {
    headers: Record<string, any>;
    ip?: string;
    socket?: { remoteAddress?: string };
  },
  isDemoMode: boolean = process.env.DEMO_MODE === 'true'
): string {
  const forwardedFor = request.headers['x-forwarded-for'] || request.headers['x-sim-ip'];
  const directIp = request.ip || request.socket?.remoteAddress || '127.0.0.1';

  if (isDemoMode && forwardedFor) {
    const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor);
    const firstIp = rawIp.split(',')[0].trim();
    if (firstIp) return firstIp;
  }

  if (!isDemoMode && forwardedFor) {
    if (isTrustedProxyIp(directIp)) {
      const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor);
      const firstIp = rawIp.split(',')[0].trim();
      if (firstIp) return firstIp;
    }
  }

  return directIp;
}
