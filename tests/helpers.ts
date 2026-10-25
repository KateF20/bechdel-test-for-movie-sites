import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import { useTransport } from '../src/shared/http.ts';
import type { FetchRequest, FetchResponse } from '../src/shared/messages.ts';

export const fixture = (name: string) => (
  readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')
);

type Reply = { status?: number; text?: string; url?: string } | 'network';

// Answers every request() with the handler's reply, so tests exercise the
// real request code path without a network.
export const mockFetch = (handler: (request: FetchRequest, url: URL) => Reply) => {
  const transport = vi.fn(async (request: FetchRequest): Promise<FetchResponse> => {
    const reply = handler(request, new URL(request.url));
    if (reply === 'network') return { ok: false, reason: 'network', message: 'Could not connect' };
    return { ok: true, status: reply.status ?? 200, text: reply.text ?? '', url: reply.url ?? request.url };
  });
  useTransport(transport);
  return transport;
};

export const requestedUrls = (transport: ReturnType<typeof mockFetch>) => (
  transport.mock.calls.map(([request]) => request.url)
);
