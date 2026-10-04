import { describe, it, expect } from 'vitest';
import {
  ipToInt,
  parseCidr,
  extractSubnet24,
  lookupIpNetwork,
  checkTimezoneMismatch,
  extractClientIp,
} from './networkSignals';
import { evaluateRisk } from './riskEngine';

/**
 * ============================================================================
 * TABLE OF 8 EXAMPLE INPUTS
 * ============================================================================
 *
 * | # | Test Description             | Input IP          | Client Timezone     | ASN Type      | Country | Subnet /24        | Timezone Mismatch? | Triggered Risk Reason(s)             | Risk Score Added |
 * |---|------------------------------|-------------------|---------------------|---------------|---------|-------------------|--------------------|--------------------------------------|------------------|
 * | 1 | US Residential ISP           | 73.4.10.25        | America/New_York    | residential   | US      | 73.4.10.0/24      | No (false)         | (None)                               | +0 pts           |
 * | 2 | AWS EC2 Cloud Datacenter     | 3.88.50.12        | America/New_York    | datacenter    | US      | 3.88.50.0/24      | No (false)         | "datacenter network"                 | +25 pts          |
 * | 3 | BotLab Simulated Botnet Node | 192.168.1.15      | America/Chicago     | datacenter    | US      | 192.168.1.0/24    | No (false)         | "datacenter network"                 | +25 pts          |
 * | 4 | Tor / Commercial VPN Exit    | 185.220.101.44    | Europe/Berlin       | vpn_proxy     | DE      | 185.220.101.0/24  | No (false)         | "vpn or proxy network"               | +20 pts          |
 * | 5 | UK IP + Tokyo TZ (Mismatch)  | 86.130.12.5       | Asia/Tokyo          | residential   | GB      | 86.130.12.0/24    | Yes (true)         | "timezone doesn't match location"    | +15 pts          |
 * | 6 | India Residential Matching   | 103.21.124.99     | Asia/Kolkata        | residential   | IN      | 103.21.124.0/24   | No (false)         | (None)                               | +0 pts           |
 * | 7 | Unmapped Public IP           | 198.18.4.1        | UTC                 | unknown       | ZZ      | 198.18.4.0/24     | No (false)         | (None)                               | +0 pts           |
 * | 8 | Spoofed Header (Untrusted)   | 203.0.113.88 (dir)| America/New_York    | unknown       | ZZ      | 203.0.113.0/24    | No (false)         | Direct untrusted IP used in prod     | +0 pts           |
 */

describe('Network Signals Module', () => {
  describe('Pure CIDR & IP Utilities', () => {
    it('converts IPv4 addresses to 32-bit unsigned integers', () => {
      expect(ipToInt('0.0.0.0')).toBe(0);
      expect(ipToInt('127.0.0.1')).toBe(2130706433);
      expect(ipToInt('192.168.1.1')).toBe(3232235777);
      expect(ipToInt('255.255.255.255')).toBe(4294967295);
      expect(ipToInt('invalid-ip')).toBeNull();
      expect(ipToInt('256.0.0.1')).toBeNull();
    });

    it('parses CIDR notation accurately', () => {
      const parsed = parseCidr('192.168.1.0/24');
      expect(parsed).not.toBeNull();
      expect(parsed?.prefixLen).toBe(24);
      expect(parsed?.network).toBe(ipToInt('192.168.1.0'));
      expect(parsed?.mask).toBe(4294967040); // 255.255.255.0

      const parsedHost = parseCidr('10.0.0.5');
      expect(parsedHost?.prefixLen).toBe(32);
    });

    it('extracts /24 subnet string reliably', () => {
      expect(extractSubnet24('192.168.1.45')).toBe('192.168.1.0/24');
      expect(extractSubnet24('73.120.45.9')).toBe('73.120.45.0/24');
      expect(extractSubnet24('::ffff:10.0.1.50')).toBe('10.0.1.0/24');
    });
  });

  describe('Table of 8 Example Inputs Verification', () => {
    // 1. Residential ISP
    it('Example 1: identifies US Comcast residential IP with matching timezone', () => {
      const info = lookupIpNetwork('73.4.10.25');
      expect(info.asnType).toBe('residential');
      expect(info.country).toBe('US');
      expect(info.subnet24).toBe('73.4.10.0/24');

      const tzMismatch = checkTimezoneMismatch('America/New_York', info.expectedTimezones);
      expect(tzMismatch).toBe(false);

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 1.0,
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
        timezoneMismatch: tzMismatch,
      });
      expect(risk.score).toBe(0);
      expect(risk.tier).toBe('low');
    });

    // 2. AWS Datacenter
    it('Example 2: identifies AWS EC2 datacenter IP with "datacenter network" reason', () => {
      const info = lookupIpNetwork('3.88.50.12');
      expect(info.asnType).toBe('datacenter');
      expect(info.country).toBe('US');

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 1.0,
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
      });
      expect(risk.score).toBe(25);
      expect(risk.reasons).toContain('datacenter network');
    });

    // 3. BotLab Simulated Botnet
    it('Example 3: identifies BotLab simulated botnet IP as datacenter and scores risk', () => {
      const info = lookupIpNetwork('192.168.1.15');
      expect(info.asnType).toBe('datacenter');
      expect(info.subnet24).toBe('192.168.1.0/24');

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 1.0,
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
      });
      expect(risk.score).toBe(25);
      expect(risk.reasons).toContain('datacenter network');
    });

    // 4. Tor / VPN Proxy
    it('Example 4: identifies VPN / proxy exit node with "vpn or proxy network" reason', () => {
      const info = lookupIpNetwork('185.220.101.44');
      expect(info.asnType).toBe('vpn_proxy');
      expect(info.country).toBe('DE');

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 1.0,
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
      });
      expect(risk.score).toBe(20);
      expect(risk.reasons).toContain('vpn or proxy network');
    });

    // 5. Timezone Mismatch
    it('Example 5: detects timezone mismatch (UK IP with Asia/Tokyo client)', () => {
      const info = lookupIpNetwork('86.130.12.5');
      expect(info.country).toBe('GB');

      const tzMismatch = checkTimezoneMismatch('Asia/Tokyo', info.expectedTimezones);
      expect(tzMismatch).toBe(true);

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 1.0,
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
        timezoneMismatch: tzMismatch,
      });
      expect(risk.score).toBe(15);
      expect(risk.reasons).toContain("timezone doesn't match location");
    });

    // 6. India Residential Matching
    it('Example 6: confirms matching timezone for Jio residential in India', () => {
      const info = lookupIpNetwork('103.21.124.99');
      expect(info.asnType).toBe('residential');
      expect(info.country).toBe('IN');

      const tzMismatch = checkTimezoneMismatch('Asia/Kolkata', info.expectedTimezones);
      expect(tzMismatch).toBe(false);
    });

    // 7. Unmapped Public IP
    it('Example 7: handles unmapped public IP safely as unknown', () => {
      const info = lookupIpNetwork('198.18.4.1');
      expect(info.asnType).toBe('unknown');
      expect(info.country).toBe('ZZ');
      expect(info.expectedTimezones).toEqual([]);

      const tzMismatch = checkTimezoneMismatch('UTC', info.expectedTimezones);
      expect(tzMismatch).toBe(false);
    });

    // 8. Proxy & Spoofed Header Security
    it('Example 8: honors spoofed headers in DEMO_MODE but rejects from untrusted proxy in production', () => {
      // Demo mode: honors spoofed X-Forwarded-For
      const demoReq = {
        headers: { 'x-forwarded-for': '192.168.1.99, 10.0.0.1' },
        ip: '127.0.0.1',
      };
      const demoIp = extractClientIp(demoReq, true);
      expect(demoIp).toBe('192.168.1.99');

      // Production mode with trusted reverse proxy: extracts real client IP
      const prodTrustedProxyReq = {
        headers: { 'x-forwarded-for': '73.4.10.25' },
        ip: '127.0.0.1',
      };
      const trustedIp = extractClientIp(prodTrustedProxyReq, false);
      expect(trustedIp).toBe('73.4.10.25');

      // Production mode with untrusted direct client sending fake header: ignores spoofed header!
      const prodUntrustedDirectReq = {
        headers: { 'x-forwarded-for': '73.4.10.25' },
        ip: '203.0.113.88', // direct untrusted external connection
      };
      const untrustedIp = extractClientIp(prodUntrustedDirectReq, false);
      expect(untrustedIp).toBe('203.0.113.88');
    });
  });

  describe('Combined Multi-Signal Risk Scenarios', () => {
    it('flags high risk for datacenter bot with timezone mismatch and fast reaction', () => {
      const info = lookupIpNetwork('3.88.50.12'); // Datacenter (25 pts)
      const tzMismatch = checkTimezoneMismatch('Asia/Shanghai', info.expectedTimezones); // Mismatch (15 pts)

      const risk = evaluateRisk({
        requestsPerMin: 5,
        burstiness: 1.5,
        uaAnomaly: false,
        headerOrderHashFamiliarity: 1.0,
        deviceFpReuseCount: 1,
        subnetReuseCount: 1,
        accountAgeSec: 86400,
        joinLatencyMs: 2000,
        behaviorScore: 0.1, // Bot-like behavior (20 pts)
        powSolveTimeMs: 1000,
        penaltyCount: 0,
        asnType: info.asnType,
        timezoneMismatch: tzMismatch,
      });

      // Total: 25 (dc) + 20 (behavior) + 15 (tz) = 60 pts -> medium/high combination
      expect(risk.score).toBe(60);
      expect(risk.tier).toBe('medium');
      expect(risk.reasons).toEqual([
        'datacenter network',
        'Bot-like client behavior',
        "timezone doesn't match location",
      ]);
    });
  });
});
