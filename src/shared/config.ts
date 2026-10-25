const DAY = 24 * 60 * 60 * 1000;

export const CONFIG = {
  requestTimeout: 20_000,
  cacheTtl: 7 * DAY,
  missCacheTtl: DAY,
  idCacheTtl: 30 * DAY,
  bechdelSyncInterval: DAY,
  bechdelSyncConcurrency: 2,
  kinopoiskConcurrency: 10,
  kinopoiskSearchConcurrency: 1,
  kinopoiskCandidateLimit: 3,
  kinopoiskYearTolerance: 1,
  genreLimit: 3,
} as const;

export const URLS = {
  bechdeltest: 'https://bechdeltest.com',
  bechdeltestSitemap: 'https://bechdeltest.com/sitemap.xml',
  bechdeltestAdd: 'https://bechdeltest.com/add/',
  wikidataSparql: 'https://query.wikidata.org/sparql',
  imdbGraphql: 'https://api.graphql.imdb.com/',
  imdbTitle: 'https://www.imdb.com/title',
  kinopoiskRating: 'https://rating.kinopoisk.ru',
  kinopoiskSearch: 'https://www.kinopoisk.ru/index.php',
  kinopoiskFilm: 'https://www.kinopoisk.ru/film',
} as const;

// Every host the extension fetches from; the manifest's host_permissions are
// generated from it.
export const FETCH_HOSTS: readonly string[] = [
  ...new Set(Object.values(URLS).map((url) => new URL(url).hostname)),
];
