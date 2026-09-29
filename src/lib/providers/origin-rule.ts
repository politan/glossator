/**
 * declarativeNetRequest rules that make requests to Local Providers carry the
 * server's own Origin instead of `chrome-extension://…`, so Ollama's origin
 * check lets them through. See docs/adr/0003-rewrite-origin-for-local-providers.md.
 */
export interface OriginRule {
  id: number;
  priority: 1;
  action: {
    type: 'modifyHeaders';
    requestHeaders: [{ header: 'origin'; operation: 'set'; value: string }];
  };
  condition: {
    urlFilter: string;
    initiatorDomains: [string];
    resourceTypes: ['xmlhttprequest', 'other'];
  };
}

export function originRules(baseUrls: readonly string[], extensionId: string): OriginRule[] {
  const origins = new Set<string>();
  for (const baseUrl of baseUrls) {
    const origin = httpOrigin(baseUrl);
    if (origin) origins.add(origin);
  }
  return [...origins].map((origin, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'origin', operation: 'set', value: origin }],
    },
    condition: {
      urlFilter: `|${origin}/`,
      initiatorDomains: [extensionId],
      resourceTypes: ['xmlhttprequest', 'other'],
    },
  }));
}

function httpOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}
