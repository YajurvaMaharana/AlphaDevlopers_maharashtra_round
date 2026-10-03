export function getSubnet(ip: string): string {
  if (!ip) return '0.0.0.0/24';
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  return ip; // Fallback for IPv6 or malformed
}
