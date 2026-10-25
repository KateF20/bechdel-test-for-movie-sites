import { describe, expect, it } from 'vitest';
import { createBadge, describeBadge } from '../src/catalog/badge.ts';
import { siteFor, SITES } from '../src/catalog/sites.ts';
import { createManifest } from '../src/manifest.ts';
import { resolveImdbId } from '../src/sources/wikidata.ts';
import { mockFetch } from './helpers.ts';

const identify = (href: string, html = '') => {
  const url = new URL(href);
  document.body.innerHTML = html;
  return siteFor(url.hostname)?.identify(url, document) ?? null;
};

describe('catalog sites', () => {
  it.each([
    ['https://www.imdb.com/title/tt0111161/', { imdbId: 'tt0111161' }],
    ['https://www.imdb.com/de/title/tt0111161/', { imdbId: 'tt0111161' }],
    ['https://www.kinopoisk.ru/film/326/', { property: 'P2603', id: '326' }],
    ['https://www.kinopoisk.ru/series/464963/', { property: 'P2603', id: '464963' }],
    ['https://letterboxd.com/film/the-shawshank-redemption/', { property: 'P6127', id: 'the-shawshank-redemption' }],
    ['https://www.themoviedb.org/movie/278-the-shawshank-redemption', { property: 'P4947', id: '278' }],
    ['https://www.themoviedb.org/tv/1396-breaking-bad', { property: 'P4983', id: '1396' }],
    ['https://app.trakt.tv/movies/the-shawshank-redemption-1994', { property: 'P8013', id: 'movies/the-shawshank-redemption-1994' }],
    ['https://www.rottentomatoes.com/m/shawshank_redemption', { property: 'P1258', id: 'm/shawshank_redemption' }],
    ['https://www.metacritic.com/movie/the-shawshank-redemption/', { property: 'P1712', id: 'movie/the-shawshank-redemption' }],
    ['https://movie.douban.com/subject/1292052/', { property: 'P4529', id: '1292052' }],
    ['https://www.filmaffinity.com/en/film161026.html', { property: 'P480', id: '161026' }],
    ['https://www.allocine.fr/film/fichefilm_gen_cfilm=11736.html', { property: 'P1265', id: '11736' }],
    ['https://www.filmweb.pl/film/Skazani+na+Shawshank-1994-1048', { property: 'P5032', id: '1048' }],
  ])('identifies the movie on %s', (href, expected) => {
    expect(identify(href)).toEqual(expected);
  });

  it.each([
    'https://www.imdb.com/title/tt0111161/reviews/',
    'https://www.kinopoisk.ru/lists/movies/top250/',
    'https://letterboxd.com/film/the-shawshank-redemption/reviews/',
    'https://www.themoviedb.org/movie',
  ])('ignores pages that are not a movie page: %s', (href) => {
    expect(identify(href)).toBeNull();
  });

  it('adds the IMDb id a page shows as a fallback', () => {
    expect(identify(
      'https://letterboxd.com/film/the-shawshank-redemption/',
      '<a href="http://www.imdb.com/title/tt0111161/maindetails">IMDb</a>',
    )).toEqual({ property: 'P6127', id: 'the-shawshank-redemption', imdbHint: 'tt0111161' });
    expect(identify(
      'https://movie.douban.com/subject/1292052/',
      '<div id="info"><span class="pl">IMDb:</span> tt0111161<br></div>',
    )).toMatchObject({ imdbHint: 'tt0111161' });
  });

  it('injects the catalog script on every catalog host', () => {
    const manifest = createManifest('1.2.3');
    const catalogMatches = manifest.content_scripts?.find(({ js }) => js?.includes('catalog.js'))?.matches;
    expect(catalogMatches).toEqual(SITES.flatMap(({ hosts }) => hosts.map((host) => `https://${host}/*`)));
    expect(manifest.version).toBe('1.2.3');
    expect(manifest.host_permissions).toContain('https://query.wikidata.org/*');
  });
});

describe('resolveImdbId', () => {
  const bindings = (...ids: string[]) => JSON.stringify({ results: { bindings: ids.map((value) => ({ imdb: { value } })) } });

  it('accepts exactly one IMDb id', async () => {
    mockFetch(() => ({ text: bindings('tt0111161') }));
    await expect(resolveImdbId('P2603', '326')).resolves.toBe('tt0111161');

    mockFetch(() => ({ text: bindings('tt1', 'tt2') }));
    await expect(resolveImdbId('P2603', '326')).resolves.toBeNull();

    mockFetch(() => ({ text: bindings() }));
    await expect(resolveImdbId('P2603', '326')).resolves.toBeNull();
  });

  it('quotes the catalog id and refuses malformed properties', async () => {
    const transport = mockFetch(() => ({ text: bindings() }));
    await resolveImdbId('P1258', 'm/"quoted"');
    expect(new URLSearchParams(transport.mock.calls[0]![0].body).get('query')).toContain('wdt:P1258 "m/\\"quoted\\""');

    await expect(resolveImdbId('P1 } DELETE', 'x')).rejects.toThrow('Invalid Wikidata property');
  });
});

describe('catalog badge', () => {
  const movie = { imdbId: 'tt1', score: 1, dubious: false, path: '/view/7/x/', title: 'X' } as const;

  it('describes rated movies with the score and a link to bechdeltest', () => {
    expect(describeBadge({ kind: 'rated', movie })).toEqual({
      score: '1',
      text: '✗ Bechdel 1/3',
      title: 'X: There are two or more women in this movie, but they don\'t talk to each other',
      href: 'https://bechdeltest.com/view/7/x/',
    });
    expect(describeBadge({ kind: 'rated', movie: { ...movie, score: 3, dubious: true } })).toMatchObject({
      text: '✓ Bechdel 3/3?',
      title: expect.stringContaining('(disputed)'),
    });
  });

  it('invites to add unrated movies', () => {
    expect(describeBadge({ kind: 'unrated' })).toMatchObject({ score: 'none', href: 'https://bechdeltest.com/add/' });
  });

  it('keeps its markup out of the page', () => {
    const badge = createBadge();
    badge.render({ kind: 'unrated' });
    expect(badge.host.shadowRoot).toBeNull();
    expect(badge.host.childNodes).toHaveLength(0);
  });
});
