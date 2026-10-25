import { describe, expect, it } from 'vitest';
import { searchKinopoiskId } from '../src/sources/kinopoisk/search.ts';
import { fixture, mockFetch, requestedUrls } from './helpers.ts';

const movie = {
  title: 'The Shawshank Redemption',
  originalTitle: 'The Shawshank Redemption',
  year: 1994,
  directors: ['Frank Darabont'],
};

const FILM_URL = 'https://www.kinopoisk.ru/film/326/';

describe('searchKinopoiskId', () => {
  it('accepts a search that redirects straight to a matching film', async () => {
    const transport = mockFetch(() => ({ text: fixture('kinopoisk-film.html'), url: FILM_URL }));
    await expect(searchKinopoiskId(movie)).resolves.toBe('326');
    expect(requestedUrls(transport)).toHaveLength(1);
  });

  it('verifies plausible search results on their film pages', async () => {
    const transport = mockFetch((request, url) => (
      url.pathname.startsWith('/film/')
        ? { text: fixture('kinopoisk-film.html') }
        : { text: fixture('kinopoisk-search.html') }
    ));
    await expect(searchKinopoiskId(movie)).resolves.toBe('326');
    expect(requestedUrls(transport)).toEqual([
      'https://www.kinopoisk.ru/index.php?kp_query=The+Shawshank+Redemption+1994',
      FILM_URL,
    ]);
  });

  it('retries without the year and resolves to null when nothing matches', async () => {
    const transport = mockFetch(() => ({ text: '<html></html>' }));
    await expect(searchKinopoiskId(movie)).resolves.toBeNull();
    expect(requestedUrls(transport)).toEqual([
      'https://www.kinopoisk.ru/index.php?kp_query=The+Shawshank+Redemption+1994',
      'https://www.kinopoisk.ru/index.php?kp_query=The+Shawshank+Redemption',
    ]);
  });

  it('treats a captcha as a failure, not as "no match"', async () => {
    const transport = mockFetch(() => ({ text: '<html></html>', url: 'https://www.kinopoisk.ru/showcaptcha?cc=1' }));
    await expect(searchKinopoiskId(movie)).rejects.toThrow('captcha');
  });

  it('skips the search without enough metadata to verify a match', async () => {
    const transport = mockFetch(() => ({ text: '' }));
    await expect(searchKinopoiskId({ ...movie, directors: [] })).resolves.toBeNull();
    expect(transport).not.toHaveBeenCalled();
  });
});
