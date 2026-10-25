import { describe, expect, it } from 'vitest';
import { readTitles, toMetadata, toRating } from '../src/sources/imdb.ts';
import { matchesFilm, matchesTitleAndYear, normalize } from '../src/sources/kinopoisk/match.ts';
import { parseFilmPage, parseSearchResults } from '../src/sources/kinopoisk/parse.ts';
import { parseRatingXml } from '../src/sources/kinopoisk/rating.ts';
import { readBindings, readKinopoiskIds } from '../src/sources/wikidata.ts';
import { fixture } from './helpers.ts';

const shawshank = {
  title: 'The Shawshank Redemption',
  originalTitle: 'The Shawshank Redemption',
  year: 1994,
  directors: ['Frank Darabont'],
};

describe('IMDb', () => {
  const ids = ['tt0111161', 'tt0000001', 'tt0000002', 'tt0000003'];
  const titles = readTitles(ids, JSON.parse(fixture('imdb-graphql.json')));

  it('leaves titles with per-alias errors out and maps unknown titles to null', () => {
    expect([...titles.keys()]).toEqual(['tt0111161', 'tt0000001', 'tt0000002']);
    expect(titles.get('tt0000002')).toBeNull();
  });

  it('rejects responses with errors that are not tied to a title', () => {
    expect(() => readTitles(ids, { data: {}, errors: [{ message: 'Rate limited' }] })).toThrow('Rate limited');
    expect(() => readTitles(ids, { errors: [] })).toThrow('no data');
  });

  it('extracts ratings and at most three genres', () => {
    expect(toRating(titles.get('tt0111161')!)).toEqual({ rating: 9.3, votes: 3257523, genres: ['Drama'] });
    expect(toRating(titles.get('tt0000001')!)).toEqual({ rating: null, votes: 0, genres: ['Action', 'Comedy', 'Crime'] });
    expect(toRating(null)).toEqual({ rating: null, votes: null, genres: [] });
  });

  it('extracts only directors from the credits', () => {
    expect(toMetadata(titles.get('tt0111161')!)).toEqual(shawshank);
  });
});

describe('Wikidata', () => {
  it('maps IMDb ids to Kinopoisk ids', () => {
    expect(readKinopoiskIds(readBindings(JSON.parse(fixture('wikidata.json'))))).toEqual(new Map([
      ['tt0068646', '325'],
      ['tt0111161', '326'],
    ]));
  });
});

describe('Kinopoisk parsing', () => {
  it('reads the rating XML', () => {
    expect(parseRatingXml(fixture('kinopoisk-rating.xml'))).toEqual({ rating: 9.111, votes: 1150774 });
    expect(parseRatingXml('<rating></rating>')).toEqual({ rating: null, votes: null });
  });

  it('reads a film page including original director names', () => {
    expect(parseFilmPage(fixture('kinopoisk-film.html'), 'https://www.kinopoisk.ru/film/326/')).toEqual({
      kinopoiskId: '326',
      titles: ['Побег из Шоушенка', 'The Shawshank Redemption'],
      year: 1994,
      directors: ['Фрэнк Дарабонт', 'Frank Darabont'],
    });
  });

  it('falls back to the canonical link for the film id', () => {
    expect(parseFilmPage(fixture('kinopoisk-film.html'), 'https://www.kinopoisk.ru/index.php')?.kinopoiskId).toBe('326');
  });

  it('reads search results without mistaking running times for titles', () => {
    expect(parseSearchResults(fixture('kinopoisk-search.html'))).toEqual([
      { kinopoiskId: '326', titles: ['Побег из Шоушенка', 'The Shawshank Redemption'], year: 1994 },
      { kinopoiskId: '749146', titles: ['The Shawshank Redemption (Scene)'], year: 2012 },
      { kinopoiskId: '1363603', titles: ['The Shawshank Redemption: Cast Interviews (видео)'], year: 2004 },
    ]);
  });
});

describe('Kinopoisk matching', () => {
  it('normalizes case, punctuation and diacritics', () => {
    expect(normalize('  Amélie: Le Fabuleux—Destin! ')).toBe('amelie le fabuleux destin');
  });

  it('matches title and year within the tolerance', () => {
    const candidate = { kinopoiskId: '1', titles: ['the shawshank redemption'], year: 1995 };
    expect(matchesTitleAndYear(candidate, shawshank, 0)).toBe(false);
    expect(matchesTitleAndYear(candidate, shawshank, 1)).toBe(true);
    expect(matchesTitleAndYear({ ...candidate, year: null }, shawshank, 1)).toBe(false);
  });

  it('requires a matching director for a film page', () => {
    const page = { kinopoiskId: '326', titles: ['The Shawshank Redemption'], year: 1994, directors: ['Frank Darabont'] };
    expect(matchesFilm(page, shawshank, 0)).toBe(true);
    expect(matchesFilm({ ...page, directors: ['Someone Else'] }, shawshank, 0)).toBe(false);
  });
});
