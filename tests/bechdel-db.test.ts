import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeEntities, parseListPage, parseSitemap } from '../src/sources/bechdeltest.ts';
import { fixture, mockFetch, requestedUrls } from './helpers.ts';

describe('bechdeltest parsing', () => {
  it('reads every movie of a list page', () => {
    const movies = parseListPage(fixture('bechdeltest-page.html'));

    expect(movies).toHaveLength(7);
    expect(movies[0]).toEqual({
      imdbId: 'tt12001534',
      score: 3,
      dubious: false,
      path: '/view/11982/the_thursday_murder_club/',
      title: 'The Thursday Murder Club',
    });
    expect(movies.find(({ title }) => title === 'Anora')).toMatchObject({ score: 3, dubious: true });
    expect(movies.find(({ imdbId }) => imdbId === 'tt6263850')).toMatchObject({
      score: 1,
      title: 'Deadpool & Wolverine',
      path: '/view/11422/deadpool_&_wolverine/',
    });
    expect(movies.map(({ score }) => score)).toContain(0);
  });

  it('decodes HTML entities', () => {
    expect(decodeEntities('I&#39;m &amp; &quot;you&quot; &#x263A; &unknown;')).toBe('I\'m & "you" ☺ &unknown;');
  });

  it('keeps only the paginated movie list from the sitemap', () => {
    expect(parseSitemap(fixture('sitemap.xml'))).toEqual([
      { url: 'https://bechdeltest.com/', lastmod: '2026-10-15' },
      { url: 'https://bechdeltest.com/page/1/', lastmod: '2026-10-15' },
      { url: 'https://bechdeltest.com/page/2/', lastmod: '2026-10-15' },
      { url: 'https://bechdeltest.com/page/3/', lastmod: '2026-10-15' },
    ]);
  });
});

const sitemap = (pages: Record<string, string>) => `<urlset>${
  Object.entries(pages).map(([path, lastmod]) => `<url><loc>https://bechdeltest.com${path}</loc><lastmod>${lastmod}</lastmod></url>`).join('')
}</urlset>`;

const row = (imdbId: string, score: number, title: string) => (
  `<div class="movie"><a href="https://www.imdb.com/title/${imdbId}/"><img src="/static/pass.png" alt="[${score}]"></a>
  <a id="movie-1" href="/view/1/${title}/">${title}</a></div>`
);

describe('bechdel database', () => {
  // The module keeps an in-memory index, so every test starts from a fresh copy.
  const load = async (transport: ReturnType<typeof mockFetch>) => {
    vi.resetModules();
    (await import('../src/shared/http.ts')).useTransport(transport);
    return import('../src/background/bechdel-db.ts');
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z'), toFake: ['Date'] });
  });

  it('downloads the whole list on the first lookup', async () => {
    const transport = mockFetch((request, url) => {
      if (url.pathname === '/sitemap.xml') return { text: sitemap({ '/': '2026-10-15', '/page/1/': '2026-10-01' }) };
      return { text: url.pathname === '/' ? row('tt1', 3, 'one') : row('tt2', 1, 'two') };
    });
    const db = await load(transport);

    await expect(db.findBechdelMovie('tt2')).resolves.toMatchObject({ score: 1, title: 'two' });
    await expect(db.findBechdelMovie('tt9')).resolves.toBeNull();
    expect(requestedUrls(transport)).toHaveLength(3);
    await expect(db.bechdelStatus()).resolves.toEqual({ movies: 2, syncedAt: Date.now(), syncing: false });
  });

  it('re-downloads only pages whose date changed', async () => {
    let lastmod = '2026-10-01';
    let score = 1;
    const transport = mockFetch((request, url) => {
      if (url.pathname === '/sitemap.xml') return { text: sitemap({ '/': '2026-10-15', '/page/1/': lastmod }) };
      return { text: url.pathname === '/' ? row('tt1', 3, 'one') : row('tt2', score, 'two') };
    });
    const db = await load(transport);
    await db.syncBechdelDb();

    lastmod = '2026-10-20';
    score = 2;
    transport.mockClear();
    await db.syncBechdelDb();

    expect(requestedUrls(transport)).toEqual(['https://bechdeltest.com/sitemap.xml', 'https://bechdeltest.com/page/1/']);
    await expect(db.findBechdelMovie('tt2')).resolves.toMatchObject({ score: 2 });
  });

  it('keeps old data of pages that fail and retries them next time', async () => {
    let failing = false;
    let lastmod = '2026-10-01';
    const transport = mockFetch((request, url) => {
      if (url.pathname === '/sitemap.xml') return { text: sitemap({ '/page/1/': lastmod }) };
      return failing ? 'network' : { text: row('tt2', 1, 'two') };
    });
    const db = await load(transport);
    await db.syncBechdelDb();
    const firstSync = Date.now();

    failing = true;
    lastmod = '2026-10-20';
    vi.setSystemTime(Date.now() + 60_000);
    await db.syncBechdelDb();

    await expect(db.findBechdelMovie('tt2')).resolves.toMatchObject({ score: 1 });
    await expect(db.bechdelStatus()).resolves.toMatchObject({ syncedAt: firstSync });

    failing = false;
    transport.mockClear();
    await db.syncBechdelDb();
    expect(requestedUrls(transport)).toContain('https://bechdeltest.com/page/1/');
  });

  it('shares one sync between concurrent callers', async () => {
    const transport = mockFetch((request, url) => (
      url.pathname === '/sitemap.xml' ? { text: sitemap({ '/': '2026-10-15' }) } : { text: row('tt1', 3, 'one') }
    ));
    const db = await load(transport);

    await Promise.all([db.syncBechdelDb(), db.syncBechdelDb(), db.findBechdelMovie('tt1')]);

    expect(requestedUrls(transport)).toHaveLength(2);
  });
});
