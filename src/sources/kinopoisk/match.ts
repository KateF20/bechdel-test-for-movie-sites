import type { ImdbMetadata } from '../imdb.ts';
import type { Candidate, FilmPage } from './parse.ts';

export const normalize = (value: string) => (
  value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
);

const normalizedSet = (values: readonly string[]) => (
  new Set(values.map(normalize).filter(Boolean))
);

export const matchesTitleAndYear = (
  candidate: Candidate,
  movie: ImdbMetadata,
  yearTolerance: number,
) => {
  if (candidate.year === null || movie.year === null) return false;
  if (Math.abs(candidate.year - movie.year) > yearTolerance) return false;
  const expected = normalizedSet([movie.originalTitle, movie.title]);
  return candidate.titles.some((title) => expected.has(normalize(title)));
};

// A search hit is only trusted when title, year and director all agree.
export const matchesFilm = (page: FilmPage, movie: ImdbMetadata, yearTolerance: number) => {
  if (!matchesTitleAndYear(page, movie, yearTolerance)) return false;
  const expected = normalizedSet(movie.directors);
  return page.directors.some((director) => expected.has(normalize(director)));
};
