import { SCORE_DESCRIPTIONS, type BechdelMovie } from '../shared/bechdel.ts';
import { LINKS, URLS } from '../shared/config.ts';

export type BadgeContent = { kind: 'rated'; movie: BechdelMovie } | { kind: 'unrated' };

// The badge lives in a closed shadow root: catalog styles cannot reach it and
// its styles cannot leak into the catalog.
const STYLES = `
  :host {
    all: initial;
    display: inline-block;
    margin-left: .6em;
    vertical-align: middle;
  }
  :host([data-floating]) {
    position: fixed;
    z-index: 2147483647;
    right: 16px;
    bottom: 16px;
    margin: 0;
  }
  a {
    --border: #bbb;
    --bg: #f3f3f3;
    --fg: #555;

    display: inline-block;
    padding: 3px 9px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--bg);
    color: var(--fg);
    font: 600 13px/1.3 system-ui, sans-serif;
    letter-spacing: normal;
    text-decoration: none;
    white-space: nowrap;
  }
  a:hover {
    filter: brightness(.95);
  }
  :host([data-floating]) a {
    box-shadow: 0 2px 10px rgb(0 0 0 / 25%);
  }
  a[data-score="3"] { --border: #16803c; --bg: #c9f2d5; --fg: #084d25; }
  a[data-score="2"] { --border: #c99900; --bg: #fff0ad; --fg: #624800; }
  a[data-score="1"] { --border: #db7818; --bg: #ffe0b5; --fg: #713407; }
  a[data-score="0"] { --border: #c13b3b; --bg: #ffd1d1; --fg: #781d1d; }
`;

export const describeBadge = (content: BadgeContent) => {
  if (content.kind === 'unrated') {
    return {
      score: 'none',
      text: 'Bechdel: not rated',
      title: 'This movie is not on bechdeltest.com yet — add it there',
      href: LINKS.bechdeltestAdd,
    };
  }
  const { score, dubious, path, title } = content.movie;
  return {
    score: String(score),
    text: `${score === 3 ? '✓' : '✗'} Bechdel ${score}/3${dubious ? '?' : ''}`,
    title: `${title}: ${SCORE_DESCRIPTIONS[score]}${dubious ? ' (disputed)' : ''}`,
    href: new URL(path, URLS.bechdeltest).href,
  };
};

export const createBadge = () => {
  const host = document.createElement('span');
  host.dataset.bechdelEverywhere = '';
  const style = document.createElement('style');
  style.textContent = STYLES;
  const link = document.createElement('a');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  host.attachShadow({ mode: 'closed' }).append(style, link);

  const render = (content: BadgeContent) => {
    const { score, text, title, href } = describeBadge(content);
    link.dataset.score = score;
    link.textContent = text;
    link.title = title;
    link.href = href;
  };

  return { host, render };
};
