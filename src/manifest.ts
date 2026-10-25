import { SITES } from './catalog/sites.ts';
import { FETCH_HOSTS } from './shared/config.ts';

const BECHDELTEST_PAGES = ['https://bechdeltest.com/*', 'https://www.bechdeltest.com/*'];
const pattern = (host: string) => `https://${host}/*`;

export const createManifest = (version: string): chrome.runtime.ManifestV3 => ({
  manifest_version: 3,
  name: 'Bechdel Test Everywhere',
  description: 'Shows Bechdel Test scores on IMDb, Kinopoisk, Letterboxd, TMDB and other movie sites, '
    + 'and adds ratings and filters to bechdeltest.com.',
  version,
  minimum_chrome_version: '130',
  icons: { 16: 'icons/16.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  action: { default_title: 'Bechdel Test Everywhere', default_popup: 'popup.html' },
  background: { service_worker: 'background.js' },
  content_scripts: [
    {
      matches: BECHDELTEST_PAGES,
      js: ['bechdeltest.js'],
      css: ['bechdeltest.css'],
      run_at: 'document_idle',
    },
    {
      matches: SITES.flatMap(({ hosts }) => hosts.map(pattern)),
      js: ['catalog.js'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'alarms', 'declarativeNetRequestWithHostAccess'],
  host_permissions: [...new Set([...BECHDELTEST_PAGES, ...FETCH_HOSTS.map(pattern)])],
});
