export type Candidate = {
  kinopoiskId: string;
  titles: string[];
  year: number | null;
};

export type FilmPage = Candidate & { directors: string[] };

const YEAR = /\b(?:18|19|20)\d{2}\b/;

export const filmIdFromUrl = (url: string | null | undefined) => (
  url?.match(/\/film\/(\d+)(?:\/|$)/)?.[1] ?? null
);

const parseYear = (text: string | null | undefined) => {
  const year = Number.parseInt(text?.match(YEAR)?.[0] ?? '', 10);
  return Number.isInteger(year) ? year : null;
};

const html = (text: string) => new DOMParser().parseFromString(text, 'text/html');

// Film pages render person names in Russian; the original spelling only lives
// in the embedded Apollo state, keyed by person id.
const originalPersonName = (pageText: string, personId: string) => {
  const match = pageText.match(new RegExp(
    `"Person:${personId}"\\s*:\\s*\\{[^{}]{0,1200}?"originalName":("(?:\\\\.|[^"\\\\])*"|null)`,
  ));
  if (!match?.[1] || match[1] === 'null') return '';
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return '';
  }
};

export const parseFilmPage = (pageText: string, pageUrl: string): FilmPage | null => {
  const page = html(pageText);
  const kinopoiskId = filmIdFromUrl(pageUrl)
    ?? filmIdFromUrl(page.querySelector('link[rel="canonical"]')?.getAttribute('href'));
  if (!kinopoiskId) return null;

  const heading = page.querySelector('h1')?.textContent
    ?.replace(/\s*\((?:18|19|20)\d{2}\)\s*$/, '')
    .trim();
  const directors = [...page.querySelectorAll('[data-test-id="directors"] a[href*="/name/"]')]
    .flatMap((link) => {
      const personId = link.getAttribute('href')?.match(/\/name\/(\d+)/)?.[1];
      return [link.textContent, personId ? originalPersonName(pageText, personId) : ''];
    })
    .filter((name): name is string => Boolean(name));

  return {
    kinopoiskId,
    titles: [heading, page.querySelector('[class*="originalTitle"]')?.textContent]
      .filter((title): title is string => Boolean(title)),
    year: parseYear(page.querySelector('[data-test-id="year"]')?.textContent),
    directors,
  };
};

// The grey line is "Original title, 142 мин"; for local titles it is just the
// running time, which must not be mistaken for a title.
const originalTitleFromSubtitle = (text: string | null | undefined) => {
  const subtitle = text?.trim() ?? '';
  if (/^\d+\s*\D+$/u.test(subtitle)) return '';
  return subtitle.replace(/,\s*\d+\s*\D+$/u, '').trim();
};

export const parseSearchResults = (pageText: string): Candidate[] => (
  [...html(pageText).querySelectorAll('.element')].flatMap((element) => {
    const link = element.querySelector<HTMLElement>('.info .name a[data-id]');
    const kinopoiskId = link?.dataset.id ?? filmIdFromUrl(link?.getAttribute('href'));
    if (!kinopoiskId) return [];
    return [{
      kinopoiskId,
      titles: [link?.textContent, originalTitleFromSubtitle(element.querySelector('.info > span.gray')?.textContent)]
        .filter((title): title is string => Boolean(title)),
      year: parseYear(element.querySelector('.info .name .year')?.textContent),
    }];
  })
);
