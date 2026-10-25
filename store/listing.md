# Chrome Web Store listing

Source for the fields of the Developer Dashboard. The name and the summary come
from the manifest (`src/manifest.ts`); everything else is entered by hand.

## Store listing

**Category:** Lifestyle → Entertainment
**Language:** English

### Description

Know before you watch: Bechdel Test Everywhere shows a movie's Bechdel Test
score right next to its title on the movie sites you already use.

The Bechdel Test asks three questions: are there at least two women in the
movie, do they talk to each other, and do they talk about something other than
a man? Scores come from bechdeltest.com, where thousands of movies have been
rated by its community.

ON MOVIE SITES
A badge next to the title shows the score from 0 to 3 and links to the movie's
page on bechdeltest.com. Movies that are not rated yet get a link to add them.
Works on:
• IMDb
• Kinopoisk
• Letterboxd
• TMDB
• Trakt
• Rotten Tomatoes
• Metacritic
• Douban
• FilmAffinity
• AlloCiné
• Filmweb

ON BECHDELTEST.COM
• IMDb and Kinopoisk ratings before every movie, color-coded and linked
• Up to three genres per movie
• Filters by minimum IMDb rating, Kinopoisk rating and Bechdel score
• Genre exclusion, for example to hide horror movies
• Filters are remembered and synced between your devices

PRIVATE BY DESIGN
No account, no API key, no tracking. The extension keeps a local copy of the
public bechdeltest.com list and only sends movie IDs and titles to the rating
sources. It never records which pages you visit.

Open source: https://github.com/rrokot/bechdeltest-enhanced

### Graphics

- Store icon: `static/icons/128.png`
- Small promo tile (440×280): `store/promo-440x280.png`
- Screenshots (1280×800, upload in this order):
  1. `store/screenshots/1-bechdeltest-ratings.png` — ratings, genres and filters on bechdeltest.com
  2. `store/screenshots/2-imdb.png` — badge on IMDb, with a disputed 3/3
  3. `store/screenshots/3-tmdb.png` — badge on TMDB
  4. `store/screenshots/4-rotten-tomatoes.png` — badge on Rotten Tomatoes

## Privacy practices

### Single purpose

Shows Bechdel Test scores from bechdeltest.com on movie catalog pages, and adds
movie ratings, genres and filters to bechdeltest.com.

### Permission justifications

**storage** — Keeps a local copy of the public bechdeltest.com movie list, so
scores appear instantly on catalog pages without a request per movie; caches
IMDb and Kinopoisk ratings; stores the user's filter settings.

**alarms** — Refreshes the local copy of the bechdeltest.com list once a day and
removes expired cache entries.

**declarativeNetRequestWithHostAccess** — The IMDb ratings API only answers
requests that come from imdb.com. A session rule sets that origin on the
extension's own requests to api.graphql.imdb.com, and on nothing else.

**Host permissions**

- bechdeltest.com — adds ratings and filters to its pages and downloads its
  public movie list.
- query.wikidata.org — maps catalog movie IDs to IMDb IDs and IMDb IDs to
  Kinopoisk IDs.
- api.graphql.imdb.com — loads IMDb ratings and genres for bechdeltest.com.
- rating.kinopoisk.ru, www.kinopoisk.ru — load Kinopoisk ratings for
  bechdeltest.com, and search Kinopoisk when Wikidata has no match.

**Content scripts on movie catalogs** (IMDb, Kinopoisk, Letterboxd, TMDB, Trakt,
Rotten Tomatoes, Metacritic, Douban, FilmAffinity, AlloCiné, Filmweb) — read the
movie ID from the page address (on Letterboxd and Douban also the IMDb ID the
page shows) and show the movie's Bechdel Test score next to its title.

### Remote code

No, I am not using remote code. All code is in the package.

### Data usage

Collects none of the listed data types. Certify all three statements: data is
not sold to third parties, not used or transferred for purposes unrelated to the
single purpose, and not used for creditworthiness or lending.

**Privacy policy URL:**
https://github.com/rrokot/bechdeltest-enhanced/blob/main/PRIVACY.md
