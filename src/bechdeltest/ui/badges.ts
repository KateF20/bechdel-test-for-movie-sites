import type { Movie, MovieView, Source, SourceState } from '../model.ts';

const SELECTORS = {
  row: '.movie',
  imdbLink: 'a[href*="imdb.com/title/"]',
  rowTitle: 'a[id^="movie-"]',
  pageTitle: 'h1 > a[href*="imdb.com/title/"]',
} as const;

const LABELS: Record<Source, string> = { kp: 'KP', imdb: 'IMDb' };

const TIERS = [
  { minimum: 8, name: 'excellent' },
  { minimum: 7, name: 'good' },
  { minimum: 6, name: 'average' },
  { minimum: 5, name: 'weak' },
] as const;

const ratingFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const votesFormat = new Intl.NumberFormat('en-US');

export const ratingTier = (rating: number) => (
  TIERS.find(({ minimum }) => rating >= minimum)?.name ?? 'bad'
);

export const extractImdbId = (href: string | null | undefined) => (
  href?.match(/\/title\/(tt\d+)/i)?.[1] ?? null
);

// The score icon's alt text is "[0]" … "[3]".
const bechdelScore = (row: Element) => {
  const alt = row.querySelector(`${SELECTORS.imdbLink} img`)?.getAttribute('alt');
  const score = alt?.match(/\[(\d)\]/)?.[1];
  return score === undefined ? null : Number(score);
};

const createBadge = (source: Source) => {
  const badge = document.createElement('a');
  badge.className = 'bte-badge';
  badge.dataset.source = source;
  return badge;
};

const createView = (anchor: Element, row: HTMLElement | null): MovieView => {
  const badges = { kp: createBadge('kp'), imdb: createBadge('imdb') };
  const genres = document.createElement('span');
  genres.className = 'bte-genres';
  anchor.before(badges.kp, badges.imdb);
  anchor.after(genres);
  return { row, badges, genres };
};

const badgeContent = (label: string, state: SourceState) => {
  switch (state.status) {
    case 'loading':
      return { text: '…', title: `Loading ${label} rating`, href: null };
    case 'ready': {
      const rating = ratingFormat.format(state.rating);
      const votes = state.votes ? `\nVotes: ${votesFormat.format(state.votes)}` : '';
      return { text: rating, title: `${label} rating: ${rating}${votes}`, href: state.href };
    }
    case 'missing':
      return { text: '—', title: `${label}: ${state.reason}`, href: state.href };
    case 'error':
      return { text: '!', title: `${label}: ${state.reason}`, href: null };
  }
};

const renderBadge = (badge: HTMLAnchorElement, source: Source, state: SourceState) => {
  const { text, title, href } = badgeContent(LABELS[source], state);
  badge.dataset.state = state.status;
  if (state.status === 'ready') badge.dataset.tier = ratingTier(state.rating);
  else delete badge.dataset.tier;
  badge.textContent = text;
  badge.title = title;
  badge.ariaLabel = title.split('\n')[0] ?? title;
  if (href) {
    badge.href = href;
    badge.target = '_blank';
    badge.rel = 'noopener noreferrer';
  } else {
    badge.removeAttribute('href');
  }
};

export const renderMovie = (movie: Movie) => {
  for (const view of movie.views) {
    renderBadge(view.badges.kp, 'kp', movie.kp);
    renderBadge(view.badges.imdb, 'imdb', movie.imdb);
    view.genres.textContent = movie.genres?.join(', ') ?? '';
    view.genres.hidden = !movie.genres?.length;
  }
};

// Adds badges next to every movie on the page: list rows and the title of a
// movie's own page. The same movie can appear more than once.
export const collectMovies = (root: ParentNode) => {
  const movies = new Map<string, Movie>();
  const add = (imdbId: string, view: MovieView, bechdel: number | null) => {
    const movie = movies.get(imdbId) ?? {
      imdbId,
      bechdel,
      imdb: { status: 'loading' },
      kp: { status: 'loading' },
      genres: null,
      views: [],
    };
    movie.views.push(view);
    movies.set(imdbId, movie);
  };

  root.querySelectorAll<HTMLElement>(SELECTORS.row).forEach((row) => {
    const imdbId = extractImdbId(row.querySelector(SELECTORS.imdbLink)?.getAttribute('href'));
    const title = row.querySelector(SELECTORS.rowTitle);
    if (imdbId && title) add(imdbId, createView(title, row), bechdelScore(row));
  });
  root.querySelectorAll(SELECTORS.pageTitle).forEach((link) => {
    const imdbId = extractImdbId(link.getAttribute('href'));
    if (imdbId) add(imdbId, createView(link, null), null);
  });

  movies.forEach(renderMovie);
  return movies;
};
