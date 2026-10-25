import type { BechdelMovie } from '../shared/bechdel.ts';
import { CONFIG, URLS } from '../shared/config.ts';
import { request } from '../shared/http.ts';
import type { BechdelStatus } from '../shared/messages.ts';
import { runPool } from '../shared/pool.ts';
import { parseListPage, parseSitemap } from '../sources/bechdeltest.ts';

// A local copy of the whole bechdeltest.com movie list (about 11,000 movies,
// 1.3 MB). bechdeltest.com has no API, but its sitemap dates every list page,
// so a sync only downloads the pages that changed since the previous one.
type Db = {
  syncedAt: number | null;
  pages: Record<string, { lastmod: string; movies: BechdelMovie[] }>;
};

type Loaded = { db: Db; index: Map<string, BechdelMovie> };

const STORAGE_KEY = 'bechdel:db';

// Read from storage once per worker lifetime and replaced after every sync.
let loaded: Promise<Loaded> | null = null;
let syncing: Promise<void> | null = null;

const withIndex = (db: Db): Loaded => ({
  db,
  index: new Map(Object.values(db.pages).flatMap(({ movies }) => movies.map((movie) => [movie.imdbId, movie]))),
});

const load = () => {
  loaded ??= chrome.storage.local.get(STORAGE_KEY).then((stored) => withIndex(
    (stored[STORAGE_KEY] as Db | undefined) ?? { syncedAt: null, pages: {} },
  ));
  return loaded;
};

const runSync = async () => {
  const listPages = parseSitemap((await request(URLS.bechdeltestSitemap)).text);
  if (!listPages.length) throw new Error('The bechdeltest.com sitemap lists no movie pages');

  const { db: previous } = await load();
  const pages: Db['pages'] = {};
  let failed = 0;
  await runPool(listPages, CONFIG.bechdelSyncConcurrency, async ({ url, lastmod }) => {
    const known = previous.pages[url];
    if (known?.lastmod === lastmod) {
      pages[url] = known;
      return;
    }
    try {
      pages[url] = { lastmod, movies: parseListPage((await request(url)).text) };
    } catch (error) {
      failed += 1;
      console.warn('[Bechdel] Could not sync', url, error);
      // Keep the old movies, but without a date so the next sync retries.
      if (known) pages[url] = { lastmod: '', movies: known.movies };
    }
  });

  const db: Db = { syncedAt: failed ? previous.syncedAt : Date.now(), pages };
  await chrome.storage.local.set({ [STORAGE_KEY]: db });
  loaded = Promise.resolve(withIndex(db));
};

export const syncBechdelDb = () => {
  syncing ??= runSync().finally(() => {
    syncing = null;
  });
  return syncing;
};

// The first lookup waits for a full download; later ones answer from the
// current copy and refresh it in the background when it is overdue.
const ensureFresh = async () => {
  const { db } = await load();
  if (!Object.keys(db.pages).length) {
    await syncBechdelDb();
  } else if (db.syncedAt === null || Date.now() - db.syncedAt > CONFIG.bechdelSyncInterval * 1.5) {
    syncBechdelDb().catch((error: unknown) => console.warn('[Bechdel] Sync failed', error));
  }
};

export const findBechdelMovie = async (imdbId: string) => {
  await ensureFresh();
  return (await load()).index.get(imdbId) ?? null;
};

export const bechdelStatus = async (): Promise<BechdelStatus> => {
  const { db, index } = await load();
  return { movies: index.size, syncedAt: db.syncedAt, syncing: syncing !== null };
};
