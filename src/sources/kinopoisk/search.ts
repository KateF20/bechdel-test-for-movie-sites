import { CONFIG, URLS } from '../../shared/config.ts';
import { request } from '../../shared/http.ts';
import type { ImdbMetadata } from '../imdb.ts';
import { matchesFilm, matchesTitleAndYear } from './match.ts';
import { filmIdFromUrl, parseFilmPage, parseSearchResults } from './parse.ts';

// Kinopoisk answers anything but text/html with a 404 page, and silently
// redirects blocked visitors to a captcha, which must not count as "no match".
const fetchPage = async (url: string | URL) => {
  const response = await request(url, { headers: { Accept: 'text/html' } });
  const { hostname, pathname } = new URL(response.url);
  if (hostname !== 'www.kinopoisk.ru') throw new Error('Kinopoisk redirected outside Kinopoisk');
  if (pathname.startsWith('/showcaptcha')) throw new Error('Kinopoisk asked for a captcha');
  return response;
};

const fetchFilmPage = async (kinopoiskId: string) => {
  const { text, url } = await fetchPage(`${URLS.kinopoiskFilm}/${kinopoiskId}/`);
  return parseFilmPage(text, url);
};

const searchPass = async (movie: ImdbMetadata, query: string, yearTolerance: number) => {
  const searchUrl = new URL(URLS.kinopoiskSearch);
  searchUrl.searchParams.set('kp_query', query);
  const { text, url } = await fetchPage(searchUrl);

  // A unique hit redirects straight to the film page.
  if (filmIdFromUrl(url)) {
    const page = parseFilmPage(text, url);
    return page && matchesFilm(page, movie, yearTolerance) ? [page.kinopoiskId] : [];
  }

  const candidates = parseSearchResults(text)
    .filter((candidate) => matchesTitleAndYear(candidate, movie, yearTolerance))
    .slice(0, CONFIG.kinopoiskCandidateLimit);

  const matches = new Set<string>();
  for (const { kinopoiskId } of candidates) {
    const page = await fetchFilmPage(kinopoiskId);
    if (page && matchesFilm(page, movie, yearTolerance)) matches.add(kinopoiskId);
  }
  return [...matches];
};

// Resolves to a Kinopoisk id only when exactly one film matches; ambiguous or
// empty results resolve to null.
export const searchKinopoiskId = async (movie: ImdbMetadata) => {
  const title = movie.originalTitle || movie.title;
  if (!title || movie.year === null || !movie.directors.length) return null;

  const exact = await searchPass(movie, `${title} ${movie.year}`, 0);
  if (exact.length) return exact.length === 1 ? exact[0]! : null;

  const relaxed = await searchPass(movie, title, CONFIG.kinopoiskYearTolerance);
  return relaxed.length === 1 ? relaxed[0]! : null;
};
