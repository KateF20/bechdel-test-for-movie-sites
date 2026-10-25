# Privacy Policy

Bechdel Test Everywhere does not collect, sell or share any personal data, and
it has no servers of its own.

## What the extension requests

To show its badges and ratings, the extension requests public data from:

- **bechdeltest.com** — the public movie list with Bechdel Test scores;
- **Wikidata** (query.wikidata.org) — IMDb IDs for catalog movie IDs, and
  Kinopoisk IDs for IMDb IDs;
- **IMDb** (api.graphql.imdb.com) — ratings, genres and basic movie details;
- **Kinopoisk** (rating.kinopoisk.ru, www.kinopoisk.ru) — ratings, and its
  search when Wikidata has no match.

These requests contain only movie IDs and movie titles. Requests to Kinopoisk
carry the browser's existing Kinopoisk cookies, as a visit to the site would;
the extension never reads them.

## What the extension stores

In Chrome's extension storage on your device:

- a copy of the public bechdeltest.com movie list;
- cached ratings and ID mappings, which expire after one to thirty days;
- your filter settings for bechdeltest.com, which Chrome syncs between your
  devices if Chrome sync is on.

Nothing about the pages you visit is stored or sent anywhere. On a catalog page
the extension only reads the movie ID from the page address (and, on Letterboxd
and Douban, the IMDb ID the page shows), to look up the movie's score.

The toolbar popup clears the cached ratings at any time; uninstalling the
extension removes all of its data.

## Contact

Questions: [GitHub issues](https://github.com/rrokot/bechdeltest-enhanced/issues).
