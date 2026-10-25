import { kinopoiskCache, type KinopoiskEntry } from '../../shared/caches.ts';
import { CONFIG, URLS } from '../../shared/config.ts';
import { isNotFound } from '../../shared/http.ts';
import type { SourceState, Update } from '../model.ts';
import { runPool } from '../../shared/pool.ts';
import { fetchImdbMetadata, type ImdbMetadata } from '../../sources/imdb.ts';
import { fetchKinopoiskRating } from '../../sources/kinopoisk/rating.ts';
import { searchKinopoiskId } from '../../sources/kinopoisk/search.ts';
import { fetchKinopoiskIds } from '../../sources/wikidata.ts';

const NO_MATCH: KinopoiskEntry = { kinopoiskId: null, rating: null, votes: null };

const toState = ({ kinopoiskId, rating, votes }: KinopoiskEntry): SourceState => {
  if (kinopoiskId === null) {
    return { status: 'missing', reason: 'No verified Kinopoisk match was found', href: null };
  }
  const href = `${URLS.kinopoiskFilm}/${kinopoiskId}/`;
  return rating === null
    ? { status: 'missing', reason: 'This title has no Kinopoisk rating yet', href }
    : { status: 'ready', rating, votes, href };
};

// Each IMDb id goes through: cache → Wikidata id → (Kinopoisk search when
// Wikidata has none) → rating XML. Definitive answers are cached; failures are
// shown as errors and retried on the next visit.
export const loadKinopoisk = async (imdbIds: readonly string[], update: Update) => {
  const cached = await kinopoiskCache.getMany(imdbIds);
  cached.forEach((entry, imdbId) => update(imdbId, { kp: toState(entry) }));

  const pending = imdbIds.filter((imdbId) => !cached.has(imdbId));
  if (!pending.length) return;

  const resolve = async (imdbId: string, entry: KinopoiskEntry) => {
    update(imdbId, { kp: toState(entry) });
    await kinopoiskCache.set(imdbId, entry);
  };
  const fail = (imdbId: string, reason: string, error: unknown) => {
    console.warn('[Bechdel ratings]', imdbId, error);
    update(imdbId, { kp: { status: 'error', reason } });
  };

  const loadRating = async (imdbId: string, kinopoiskId: string) => {
    try {
      await resolve(imdbId, { kinopoiskId, ...await fetchKinopoiskRating(kinopoiskId) });
    } catch (error) {
      if (isNotFound(error)) await resolve(imdbId, { kinopoiskId, rating: null, votes: null });
      else fail(imdbId, 'Could not reach the Kinopoisk rating source', error);
    }
  };

  const searchAndLoad = async (imdbId: string, movie: ImdbMetadata | undefined) => {
    if (!movie) {
      fail(imdbId, 'IMDb returned no metadata to search Kinopoisk with', null);
      return;
    }
    let kinopoiskId: string | null;
    try {
      kinopoiskId = await searchKinopoiskId(movie);
    } catch (error) {
      fail(imdbId, 'Kinopoisk search is unavailable', error);
      return;
    }
    if (kinopoiskId) await loadRating(imdbId, kinopoiskId);
    else await resolve(imdbId, NO_MATCH);
  };

  const searchUnknown = async (unknown: readonly string[]) => {
    if (!unknown.length) return;
    let metadata: Map<string, ImdbMetadata>;
    try {
      metadata = await fetchImdbMetadata(unknown);
    } catch (error) {
      unknown.forEach((imdbId) => fail(imdbId, 'Could not load IMDb metadata to search Kinopoisk', error));
      return;
    }
    await runPool(unknown, CONFIG.kinopoiskSearchConcurrency, (imdbId) => (
      searchAndLoad(imdbId, metadata.get(imdbId))
    ));
  };

  let kinopoiskIds: Map<string, string>;
  try {
    kinopoiskIds = await fetchKinopoiskIds(pending);
  } catch (error) {
    pending.forEach((imdbId) => fail(imdbId, 'Could not reach Wikidata', error));
    return;
  }

  await Promise.all([
    runPool([...kinopoiskIds], CONFIG.kinopoiskConcurrency, ([imdbId, kinopoiskId]) => (
      loadRating(imdbId, kinopoiskId)
    )),
    searchUnknown(pending.filter((imdbId) => !kinopoiskIds.has(imdbId))),
  ]);
};
