import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCaches, countCacheEntries, createCache, pruneCaches } from '../src/shared/cache.ts';

const DAY = 24 * 60 * 60 * 1000;

describe('cache', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z') }));
  afterEach(() => vi.useRealTimers());

  const cache = createCache<{ rating: number | null }>({
    name: 'test',
    version: 2,
    ttl: ({ rating }) => (rating === null ? DAY : 7 * DAY),
  });

  it('returns stored entries until they expire', async () => {
    await cache.set('tt1', { rating: 7 });
    await cache.set('tt2', { rating: null });
    expect(await cache.getMany(['tt1', 'tt2', 'tt3'])).toEqual(new Map([
      ['tt1', { rating: 7 }],
      ['tt2', { rating: null }],
    ]));

    vi.advanceTimersByTime(2 * DAY);
    expect([...(await cache.getMany(['tt1', 'tt2'])).keys()]).toEqual(['tt1']);
  });

  it('prunes expired entries and entries of retired versions', async () => {
    await cache.set('tt1', { rating: 7 });
    await cache.set('tt2', { rating: null });
    await chrome.storage.local.set({ 'cache:test:v1:tt1': { expiresAt: Infinity, data: {} }, filters: {} });

    await pruneCaches([cache], Date.now() + 2 * DAY);

    expect(Object.keys(await chrome.storage.local.get(null)).sort()).toEqual(['cache:test:v2:tt1', 'filters']);
  });

  it('never reads values that are not cache entries', async () => {
    await cache.set('tt1', { rating: 7 });
    await chrome.storage.local.set({ 'bechdel:v1:page:x': ['large'] });
    vi.mocked(chrome.storage.local.get).mockClear();

    await pruneCaches([cache]);
    await countCacheEntries();
    await clearCaches();

    const read = vi.mocked(chrome.storage.local.get).mock.calls.flatMap(([keys]) => [keys].flat());
    expect(read).toEqual(['cache:test:v2:tt1']);
  });

  it('counts and clears only cache entries', async () => {
    await cache.set('tt1', { rating: 7 });
    await chrome.storage.local.set({ filters: {} });
    expect(await countCacheEntries()).toBe(1);

    await clearCaches();
    expect(Object.keys(await chrome.storage.local.get(null))).toEqual(['filters']);
  });
});
