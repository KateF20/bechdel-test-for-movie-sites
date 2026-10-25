import { pruneCaches } from '../shared/cache.ts';
import { caches, imdbIdCache } from '../shared/caches.ts';
import { CONFIG } from '../shared/config.ts';
import { useTransport } from '../shared/http.ts';
import type { Message, Reply, RequestType, Requests, TitleRef } from '../shared/messages.ts';
import { resolveImdbId } from '../sources/wikidata.ts';
import { bechdelStatus, dropRetiredBechdelDb, findBechdelMovie, syncBechdelDb } from './bechdel-db.ts';
import { fetchDirect } from './proxy.ts';

const MAINTENANCE_ALARM = 'daily-maintenance';

useTransport(fetchDirect);

const resolveRef = async (ref: TitleRef) => {
  if ('imdbId' in ref) return ref.imdbId;
  const key = `${ref.property}:${ref.id}`;
  const cached = (await imdbIdCache.getMany([key])).get(key);
  if (cached) return cached.imdbId ?? ref.imdbHint ?? null;
  try {
    const imdbId = await resolveImdbId(ref.property, ref.id);
    await imdbIdCache.set(key, { imdbId });
    return imdbId ?? ref.imdbHint ?? null;
  } catch (error) {
    // The page's own IMDb link still identifies the movie when Wikidata is down.
    if (ref.imdbHint) return ref.imdbHint;
    throw error;
  }
};

type Handlers = { [K in RequestType]: (message: Message<K>) => Promise<Requests[K]['response']> };

const handlers: Handlers = {
  fetch: ({ type, ...request }) => fetchDirect(request),
  'bechdel:find': async ({ ref }) => {
    const imdbId = await resolveRef(ref);
    return { imdbId, movie: imdbId ? await findBechdelMovie(imdbId) : null };
  },
  'bechdel:status': () => bechdelStatus(),
  'bechdel:sync': async () => {
    await syncBechdelDb();
    return bechdelStatus();
  },
};

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse: (reply: Reply) => void) => {
  if (sender.id !== chrome.runtime.id || !(message?.type in handlers)) return false;
  const handle = handlers[message.type] as (message: Message) => Promise<unknown>;
  handle(message).then(
    (value) => sendResponse({ ok: true, value } as Reply),
    (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
  );
  return true;
});

const warn = (error: unknown) => console.warn('[Bechdel] Maintenance failed', error);

// Daily: refresh the Bechdel copy and drop expired cache entries.
const maintain = () => {
  pruneCaches(caches).catch(warn);
  syncBechdelDb().catch(warn);
};

const ensureAlarm = async () => {
  if (!await chrome.alarms.get(MAINTENANCE_ALARM)) {
    await chrome.alarms.create(MAINTENANCE_ALARM, { periodInMinutes: CONFIG.bechdelSyncInterval / 60_000 });
  }
};

// Alarms and storage outlive updates: after one, keep only what this version
// uses.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.clearAll().then(ensureAlarm).catch(warn);
  dropRetiredBechdelDb().catch(warn);
  maintain();
});
chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === MAINTENANCE_ALARM) maintain();
});

// Alarms may be dropped on browser restart; make sure the daily one exists.
ensureAlarm().catch(warn);
