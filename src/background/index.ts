import { pruneCaches } from '../shared/cache.ts';
import { caches, imdbIdCache } from '../shared/caches.ts';
import { CONFIG } from '../shared/config.ts';
import { useTransport } from '../shared/http.ts';
import type { Message, Reply, RequestType, Requests, TitleRef } from '../shared/messages.ts';
import { resolveImdbId } from '../sources/wikidata.ts';
import { bechdelStatus, findBechdelMovie, syncBechdelDb } from './bechdel-db.ts';
import { fetchDirect } from './proxy.ts';

const SYNC_ALARM = 'bechdel-sync';

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

const syncInBackground = () => {
  syncBechdelDb().catch((error: unknown) => console.warn('[Bechdel] Sync failed', error));
};

chrome.runtime.onInstalled.addListener(() => {
  void pruneCaches(caches);
  syncInBackground();
});
chrome.runtime.onStartup.addListener(() => void pruneCaches(caches));
chrome.alarms.onAlarm.addListener(({ name }) => {
  if (name === SYNC_ALARM) syncInBackground();
});

// Alarms may be dropped on browser restart; make sure the daily one exists.
void chrome.alarms.get(SYNC_ALARM).then((alarm) => {
  if (!alarm) {
    void chrome.alarms.create(SYNC_ALARM, { periodInMinutes: CONFIG.bechdelSyncInterval / 60_000 });
  }
});
