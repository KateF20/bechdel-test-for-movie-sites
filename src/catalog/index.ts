import { send } from '../shared/messages.ts';
import { createBadge } from './badge.ts';
import { siteFor, type Site } from './sites.ts';

// How long a page may take to render its heading before the badge floats in
// the corner instead.
const FLOAT_DELAY = 2000;

const run = (site: Site) => {
  const badge = createBadge();
  let pageKey: string | null = null;
  let shown = false;
  let floatTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;

  const float = () => {
    floatTimer = undefined;
    if (!shown || document.querySelector(site.anchor)) return;
    badge.host.dataset.floating = '';
    document.body.append(badge.host);
  };

  // Single-page catalogs re-render their headings; put the badge back
  // whenever it is no longer inside the current one.
  const place = () => {
    frame = 0;
    if (!shown) return;
    const anchor = document.querySelector(site.anchor);
    if (!anchor) {
      if (!badge.host.isConnected) floatTimer ??= setTimeout(float, FLOAT_DELAY);
      return;
    }
    clearTimeout(floatTimer);
    floatTimer = undefined;
    delete badge.host.dataset.floating;
    if (badge.host.parentElement !== anchor) anchor.append(badge.host);
  };

  const hide = () => {
    shown = false;
    clearTimeout(floatTimer);
    floatTimer = undefined;
    badge.host.remove();
  };

  const refresh = async () => {
    const ref = site.identify(new URL(location.href), document);
    const key = ref && JSON.stringify(ref);
    if (key === pageKey) return;
    pageKey = key;
    hide();
    if (!ref) return;

    try {
      const { imdbId, movie } = await send({ type: 'bechdel:find', ref });
      if (pageKey !== key || !imdbId) return;
      badge.render(movie ? { kind: 'rated', movie } : { kind: 'unrated' });
      shown = true;
      place();
    } catch (error) {
      console.warn('[Bechdel]', error);
    }
  };

  new MutationObserver(() => {
    frame ||= requestAnimationFrame(place);
  }).observe(document.body, { childList: true, subtree: true });
  // Fires for every URL change, including the History API calls SPAs make.
  navigation.addEventListener('currententrychange', () => void refresh());
  void refresh();
};

const site = siteFor(location.hostname);
if (site) run(site);
