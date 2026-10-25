import type { Movie, SourceState } from '../model.ts';

export type Filters = {
  kpMin: number | null;
  imdbMin: number | null;
  bechdelMin: number | null;
  excludedGenres: string[];
};

export const DEFAULT_FILTERS: Filters = {
  kpMin: null,
  imdbMin: null,
  bechdelMin: null,
  excludedGenres: [],
};

const STORAGE_KEY = 'filters';

const withDefaults = (value: unknown): Filters => ({ ...DEFAULT_FILTERS, ...(value as Partial<Filters>) });

export const loadFilters = async () => withDefaults((await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY]);

export const saveFilters = (filters: Filters) => chrome.storage.sync.set({ [STORAGE_KEY]: filters });

// Keeps every open bechdeltest tab on the same filters.
export const onFiltersChanged = (listener: (filters: Filters) => void) => {
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[STORAGE_KEY];
    if (area === 'sync' && change) listener(withDefaults(change.newValue));
  });
};

// A rating that is still loading or failed to load says nothing about the
// movie, so the row stays visible instead of hiding behind a minimum it may
// well satisfy.
const passesMinimum = (state: SourceState, minimum: number | null) => (
  minimum === null
  || state.status === 'loading'
  || state.status === 'error'
  || (state.status === 'ready' && state.rating >= minimum)
);

export const matchesFilters = (movie: Movie, filters: Filters) => (
  (filters.bechdelMin === null || (movie.bechdel ?? -1) >= filters.bechdelMin)
  && passesMinimum(movie.kp, filters.kpMin)
  && passesMinimum(movie.imdb, filters.imdbMin)
  && !movie.genres?.some((genre) => filters.excludedGenres.includes(genre))
);

// The list is flat: each year heading is followed by its movies and ads.
const updateYearGroups = (list: HTMLElement) => {
  let heading: HTMLElement | null = null;
  let members: HTMLElement[] = [];
  const close = () => {
    if (!heading) return;
    const empty = !members.some((element) => element.matches('.movie') && !element.hidden);
    heading.hidden = empty;
    members.filter((element) => element.matches('.ad')).forEach((ad) => { ad.hidden = empty; });
  };

  for (const element of list.children as HTMLCollectionOf<HTMLElement>) {
    if (element.tagName === 'H2') {
      close();
      heading = element;
      members = [];
    } else if (heading) {
      members.push(element);
    }
  }
  close();
};

export const applyFilters = (list: HTMLElement, movies: Iterable<Movie>, filters: Filters) => {
  for (const movie of movies) {
    const hidden = !matchesFilters(movie, filters);
    for (const { row } of movie.views) if (row) row.hidden = hidden;
  }
  updateYearGroups(list);
};
