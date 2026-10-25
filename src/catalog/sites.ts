import type { TitleRef } from '../shared/messages.ts';

// A movie catalog: where its movie pages live, how a page names its movie, and
// the heading the badge goes next to. Catalog ids are Wikidata external-id
// properties, so one Wikidata lookup covers every catalog.
export type Site = {
  name: string;
  hosts: readonly string[];
  anchor: string;
  identify: (url: URL, document: Document) => TitleRef | null;
};

const IMDB_ID = /\btt\d{7,}\b/;

const byPath = (pattern: RegExp, toRef: (match: RegExpMatchArray) => TitleRef | null) => (
  (url: URL) => {
    const match = url.pathname.match(pattern);
    return match ? toRef(match) : null;
  }
);

const wikidata = (property: string, id: string | undefined): TitleRef | null => (
  id ? { property, id } : null
);

// Adds the IMDb id a page shows itself, used when Wikidata has no mapping.
const withHint = (
  identify: (url: URL) => TitleRef | null,
  findHint: (document: Document) => string | null | undefined,
) => (url: URL, document: Document): TitleRef | null => {
  const ref = identify(url);
  if (!ref || 'imdbId' in ref) return ref;
  const imdbHint = findHint(document)?.match(IMDB_ID)?.[0];
  return imdbHint ? { ...ref, imdbHint } : ref;
};

const imdbLink = (document: Document) => (
  document.querySelector('a[href*="imdb.com/title/tt"]')?.getAttribute('href')
);

export const SITES: readonly Site[] = [
  {
    name: 'IMDb',
    hosts: ['www.imdb.com', 'm.imdb.com'],
    anchor: 'h1[data-testid="hero__pageTitle"]',
    identify: byPath(/^\/(?:[a-z]{2}\/)?title\/(tt\d+)\/?$/, ([, imdbId]) => (imdbId ? { imdbId } : null)),
  },
  {
    name: 'Kinopoisk',
    hosts: ['www.kinopoisk.ru'],
    anchor: 'h1[itemprop="name"]',
    identify: byPath(/^\/(?:film|series)\/(\d+)\/?$/, ([, id]) => wikidata('P2603', id)),
  },
  {
    name: 'Letterboxd',
    hosts: ['letterboxd.com'],
    anchor: '.details h1',
    identify: withHint(byPath(/^\/film\/([^/]+)\/?$/, ([, id]) => wikidata('P6127', id)), imdbLink),
  },
  {
    name: 'TMDB',
    hosts: ['www.themoviedb.org'],
    anchor: '.header .title h2',
    identify: byPath(/^\/(movie|tv)\/(\d+)(?:-[^/]*)?\/?$/, ([, kind, id]) => (
      wikidata(kind === 'movie' ? 'P4947' : 'P4983', id)
    )),
  },
  {
    name: 'Trakt',
    hosts: ['trakt.tv', 'app.trakt.tv'],
    anchor: 'h1.trakt-responsive-title',
    identify: byPath(/^\/(movies|shows)\/([^/]+)\/?$/, ([, kind, slug]) => wikidata('P8013', `${kind}/${slug}`)),
  },
  {
    name: 'Rotten Tomatoes',
    hosts: ['www.rottentomatoes.com'],
    anchor: 'h1#media-hero-label',
    identify: byPath(/^\/(m|tv)\/([^/]+)\/?$/, ([, kind, slug]) => wikidata('P1258', `${kind}/${slug}`)),
  },
  {
    name: 'Metacritic',
    hosts: ['www.metacritic.com'],
    anchor: '[data-testid="hero-title"] h1',
    identify: byPath(/^\/(movie|tv)\/([^/]+)\/?$/, ([, kind, slug]) => wikidata('P1712', `${kind}/${slug}`)),
  },
  {
    name: 'Douban',
    hosts: ['movie.douban.com'],
    anchor: '#content > h1',
    identify: withHint(
      byPath(/^\/subject\/(\d+)\/?$/, ([, id]) => wikidata('P4529', id)),
      (document) => document.querySelector('#info')?.textContent,
    ),
  },
  {
    name: 'FilmAffinity',
    hosts: ['www.filmaffinity.com'],
    anchor: 'h1#main-title',
    identify: byPath(/^\/[a-z]{2}\/film(\d+)\.html$/, ([, id]) => wikidata('P480', id)),
  },
  {
    name: 'AlloCiné',
    hosts: ['www.allocine.fr'],
    anchor: '.titlebar-page .titlebar-title',
    identify: byPath(/^\/film\/fichefilm_gen_cfilm=(\d+)\.html$/, ([, id]) => wikidata('P1265', id)),
  },
  {
    name: 'Filmweb',
    hosts: ['www.filmweb.pl'],
    anchor: 'h1.filmCoverSection__title',
    identify: byPath(/^\/(?:film|serial)\/[^/]+-(\d+)$/, ([, id]) => wikidata('P5032', id)),
  },
];

export const siteFor = (hostname: string) => SITES.find(({ hosts }) => hosts.includes(hostname)) ?? null;
