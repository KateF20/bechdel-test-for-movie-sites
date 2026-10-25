export type Source = 'imdb' | 'kp';

export type SourceState =
  | { status: 'loading' }
  | { status: 'ready'; rating: number; votes: number | null; href: string }
  | { status: 'missing'; reason: string; href: string | null }
  | { status: 'error'; reason: string };

export type MovieView = {
  // The list row this view belongs to; null on a movie's own page.
  row: HTMLElement | null;
  badges: Record<Source, HTMLAnchorElement>;
  genres: HTMLElement;
};

export type Movie = {
  imdbId: string;
  bechdel: number | null;
  imdb: SourceState;
  kp: SourceState;
  // null until IMDb has answered, so genre filters never hide unknown rows.
  genres: string[] | null;
  views: MovieView[];
};

export type MoviePatch = Partial<Pick<Movie, Source | 'genres'>>;

export type Update = (imdbId: string, patch: MoviePatch) => void;

export const SOURCES: readonly Source[] = ['kp', 'imdb'];

export const progress = (movies: Iterable<Movie>) => {
  let total = 0;
  let pending = 0;
  let failed = 0;
  for (const movie of movies) {
    for (const source of SOURCES) {
      total += 1;
      if (movie[source].status === 'loading') pending += 1;
      if (movie[source].status === 'error') failed += 1;
    }
  }
  return { total, pending, failed };
};
