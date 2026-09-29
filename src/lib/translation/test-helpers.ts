export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fetch stand-in that records requests and answers with the given responses in order. */
export function fakeFetch(...responses: (Response | Error)[]) {
  const requests: RecordedRequest[] = [];
  const fetch = (input: string | URL, init?: RequestInit): Promise<Response> => {
    requests.push({
      url: input.toString(),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('fakeFetch: no response queued'));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

/** A fetch stand-in that never answers until its request is aborted. */
export function hangingFetch(): typeof globalThis.fetch {
  return ((_input: string | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(init.signal?.reason instanceof Error ? init.signal.reason : new Error('aborted'));
      });
    })) as typeof globalThis.fetch;
}

/** An SSE response whose body arrives in exactly the given raw chunks. */
export function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export function delta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
