import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Movie } from '../src/bechdeltest/model.ts';
import { collectMovies, ratingTier, renderMovie } from '../src/bechdeltest/ui/badges.ts';
import { applyFilters, DEFAULT_FILTERS, matchesFilters } from '../src/bechdeltest/ui/filters.ts';
import { mountPanel } from '../src/bechdeltest/ui/panel.ts';
import { fixture } from './helpers.ts';

const visibleText = (list: Element) => (
  [...list.children]
    .filter((element) => !(element as HTMLElement).hidden && element.matches('h2, .movie'))
    .map((element) => element.querySelector('a[id^="movie-"]')?.textContent ?? element.id)
);

describe('collectMovies', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture('bechdeltest-list.html');
  });

  it('adds badges to every list row with an IMDb link and merges duplicates', () => {
    const movies = collectMovies(document);

    expect([...movies.keys()]).toEqual(['tt32141377', 'tt26657236', 'tt14181714']);
    expect([...movies.values()].map(({ bechdel }) => bechdel)).toEqual([2, 1, 3]);
    expect(movies.get('tt14181714')?.views).toHaveLength(2);
    expect(document.querySelectorAll('.bte-badge')).toHaveLength(8);

    const title = document.querySelector('#movie-12212')!;
    expect(title.previousElementSibling?.getAttribute('data-source')).toBe('imdb');
    expect(title.nextElementSibling?.className).toBe('bte-genres');
  });

  it('adds badges to the title of a movie page', () => {
    document.body.innerHTML = fixture('bechdeltest-view.html');
    const movies = collectMovies(document);

    expect([...movies.keys()]).toEqual(['tt0844760']);
    expect(movies.get('tt0844760')?.views[0]?.row).toBeNull();
    expect(document.querySelector('h1 > .bte-badge[data-source="kp"]')).not.toBeNull();
  });

  it('renders every state of a badge', () => {
    const movie = collectMovies(document).get('tt32141377')!;
    const [kp, imdb] = [movie.views[0]!.badges.kp, movie.views[0]!.badges.imdb];
    expect(kp.dataset.state).toBe('loading');

    movie.kp = { status: 'ready', rating: 7.25, votes: 12345, href: 'https://www.kinopoisk.ru/film/1/' };
    movie.imdb = { status: 'error', reason: 'Could not reach IMDb' };
    movie.genres = ['Horror', 'Thriller'];
    renderMovie(movie);

    expect(kp).toMatchObject({ textContent: '7.3', title: 'KP rating: 7.3\nVotes: 12,345', href: 'https://www.kinopoisk.ru/film/1/' });
    expect(kp.dataset.tier).toBe('good');
    expect(imdb.textContent).toBe('!');
    expect(imdb.hasAttribute('href')).toBe(false);
    expect(movie.views[0]!.genres.textContent).toBe('Horror, Thriller');
  });

  it('assigns tiers to every rating', () => {
    expect([9, 7, 6.5, 5, 3, -1].map(ratingTier)).toEqual(['excellent', 'good', 'average', 'weak', 'bad', 'bad']);
  });
});

describe('filters', () => {
  const movie = (patch: Partial<Movie>): Movie => ({
    imdbId: 'tt1',
    bechdel: 3,
    imdb: { status: 'ready', rating: 7, votes: null, href: '' },
    kp: { status: 'ready', rating: 6, votes: null, href: '' },
    genres: ['Drama'],
    views: [],
    ...patch,
  });

  it('applies rating minimums only to loaded ratings', () => {
    const filters = { ...DEFAULT_FILTERS, kpMin: 7 };
    expect(matchesFilters(movie({}), filters)).toBe(false);
    expect(matchesFilters(movie({ kp: { status: 'loading' } }), filters)).toBe(true);
    expect(matchesFilters(movie({ kp: { status: 'error', reason: '' } }), filters)).toBe(true);
    expect(matchesFilters(movie({ kp: { status: 'missing', reason: '', href: null } }), filters)).toBe(false);
  });

  it('applies the Bechdel minimum and genre exclusions', () => {
    expect(matchesFilters(movie({ bechdel: 1 }), { ...DEFAULT_FILTERS, bechdelMin: 2 })).toBe(false);
    expect(matchesFilters(movie({ bechdel: null }), { ...DEFAULT_FILTERS, bechdelMin: 1 })).toBe(false);
    expect(matchesFilters(movie({}), { ...DEFAULT_FILTERS, excludedGenres: ['Drama'] })).toBe(false);
    expect(matchesFilters(movie({ genres: null }), { ...DEFAULT_FILTERS, excludedGenres: ['Drama'] })).toBe(true);
  });

  it('hides year headings and ads whose movies are all filtered out', () => {
    document.body.innerHTML = fixture('bechdeltest-list.html');
    const list = document.querySelector<HTMLElement>('.list')!;
    const movies = collectMovies(document);

    applyFilters(list, movies.values(), { ...DEFAULT_FILTERS, bechdelMin: 3 });

    expect(visibleText(list)).toEqual(['year-2025', 'The Bluff', 'The Bluff (duplicate entry)', 'No IMDb link']);
    expect(list.querySelector<HTMLElement>('.ad')?.hidden).toBe(true);
  });
});

describe('mountPanel', () => {
  it('sits above the first year and reports changes', () => {
    document.body.innerHTML = fixture('bechdeltest-list.html');
    const list = document.querySelector<HTMLElement>('.list')!;
    const onChange = vi.fn();
    const panel = mountPanel(list, { ...DEFAULT_FILTERS, excludedGenres: ['Horror'] }, onChange);

    expect(list.querySelector('h2')?.previousElementSibling?.className).toBe('bte-filters');

    const select = list.querySelector('select')!;
    select.value = '8';
    select.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, kpMin: 8, excludedGenres: ['Horror'] });

    panel.setGenres(['Drama']);
    const options = [...list.querySelectorAll<HTMLButtonElement>('.bte-genre-option')];
    expect(options.map(({ value, ariaPressed }) => [value, ariaPressed])).toEqual([['Drama', 'false'], ['Horror', 'true']]);

    options[0]!.click();
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, kpMin: 8, excludedGenres: ['Horror', 'Drama'] });

    panel.setProgress({ total: 4, pending: 1, failed: 0 });
    expect(list.querySelector('.bte-status')?.textContent).toBe('Ratings 3 / 4');
  });
});
