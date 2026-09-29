export type Privacy = 'local' | 'self-hosted' | 'cloud';

type ProviderLocation = { kind: 'cloud' } | { kind: 'local'; baseUrl: string };

export function privacyOf(provider: ProviderLocation): Privacy {
  if (provider.kind === 'cloud') return 'cloud';
  let hostname: string;
  try {
    hostname = new URL(provider.baseUrl).hostname;
  } catch {
    return 'self-hosted';
  }
  return isPrivateHost(hostname) ? 'local' : 'self-hosted';
}

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]' || hostname.endsWith('.local')) return true;
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return false;
  }
  const [a, b] = octets as [number, number, number, number];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
