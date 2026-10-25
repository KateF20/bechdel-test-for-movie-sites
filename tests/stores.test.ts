// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishChrome, publishEdge } from '../scripts/stores.ts';

type Route = (url: string, init: RequestInit) => Response;

const mockStore = (routes: Route[]) => {
  const fetchMock = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const route = routes.shift();
    if (!route) throw new Error(`Unexpected request to ${String(input)}`);
    return route(String(input), init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);
const archive = new Uint8Array([80, 75]);

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Polling waits are skipped.
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
    callback();
    return 0;
  }) as typeof setTimeout);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('publishChrome', () => {
  beforeEach(() => {
    vi.stubEnv('CWS_PUBLISHER_ID', 'pub');
    vi.stubEnv('CWS_ITEM_ID', 'item');
    vi.stubEnv('CWS_ACCESS_TOKEN', 'token');
  });

  it('uploads, waits for processing and submits for review', async () => {
    const fetchMock = mockStore([
      () => json({ uploadState: 'IN_PROGRESS' }),
      () => json({ lastAsyncUploadState: 'IN_PROGRESS' }),
      () => json({ lastAsyncUploadState: 'SUCCEEDED' }),
      () => json({ state: 'PENDING_REVIEW' }),
    ]);

    await publishChrome(archive);

    const [upload, , , publish] = fetchMock.mock.calls;
    expect(upload?.[0]).toBe('https://chromewebstore.googleapis.com/upload/v2/publishers/pub/items/item:upload');
    expect(upload?.[1]?.headers).toMatchObject({ Authorization: 'Bearer token', 'Content-Type': 'application/zip' });
    expect(publish?.[0]).toBe('https://chromewebstore.googleapis.com/v2/publishers/pub/items/item:publish');
  });

  it('stops on a failed upload or a rejected submission', async () => {
    mockStore([() => json({ uploadState: 'FAILED' })]);
    await expect(publishChrome(archive)).rejects.toThrow('ended as FAILED');

    mockStore([() => json({ uploadState: 'SUCCEEDED' }), () => json({ state: 'REJECTED' })]);
    await expect(publishChrome(archive)).rejects.toThrow('ended as REJECTED');

    mockStore([() => new Response('version must be higher', { status: 400 })]);
    await expect(publishChrome(archive)).rejects.toThrow('HTTP 400 version must be higher');
  });

  it('requires its credentials', async () => {
    vi.stubEnv('CWS_ACCESS_TOKEN', '');
    await expect(publishChrome(archive)).rejects.toThrow('CWS_ACCESS_TOKEN is not set');
  });
});

describe('publishEdge', () => {
  const api = 'https://api.addons.microsoftedge.microsoft.com/v1/products/product/submissions';

  beforeEach(() => {
    vi.stubEnv('EDGE_PRODUCT_ID', 'product');
    vi.stubEnv('EDGE_CLIENT_ID', 'client');
    vi.stubEnv('EDGE_API_KEY', 'key');
  });

  it('uploads the package, then publishes the draft, following each operation', async () => {
    const fetchMock = mockStore([
      () => new Response(null, { status: 202, headers: { Location: 'upload-1' } }),
      () => json({ status: 'InProgress' }),
      () => json({ status: 'Succeeded' }),
      () => new Response(null, { status: 202, headers: { Location: `${api}/operations/publish-1` } }),
      () => json({ status: 'Succeeded' }),
    ]);

    await publishEdge(archive, '2.0.1');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${api}/draft/package`,
      `${api}/draft/package/operations/upload-1`,
      `${api}/draft/package/operations/upload-1`,
      api,
      `${api}/operations/publish-1`,
    ]);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: 'ApiKey key', 'X-ClientID': 'client' });
    expect(fetchMock.mock.calls[3]?.[1]?.body).toBe(JSON.stringify({ notes: 'Version 2.0.1' }));
  });

  it('reports failed operations', async () => {
    mockStore([
      () => new Response(null, { status: 202, headers: { Location: 'upload-1' } }),
      () => json({ status: 'Failed', message: 'Package is invalid', errors: [{ message: 'manifest' }] }),
    ]);
    await expect(publishEdge(archive, '2.0.1')).rejects.toThrow('Edge upload failed: Package is invalid');
  });
});
