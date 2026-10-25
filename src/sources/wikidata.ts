import { URLS } from '../shared/config.ts';
import { parseJson, request } from '../shared/http.ts';

type Binding = Record<string, { value?: string } | undefined>;
type SparqlResponse = { results?: { bindings?: Binding[] } };

const IMDB_ID = 'P345';
const KINOPOISK_ID = 'P2603';

export const readBindings = (json: unknown) => (json as SparqlResponse)?.results?.bindings ?? [];

const sparql = async (query: string) => {
  const { text } = await request(URLS.wikidataSparql, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ query, format: 'json' }).toString(),
  });
  return readBindings(parseJson(text, 'Wikidata'));
};

const literal = (value: string) => JSON.stringify(value);

export const readKinopoiskIds = (bindings: Binding[]) => {
  const ids = new Map<string, string>();
  for (const { imdb, kp } of bindings) {
    if (imdb?.value && kp?.value) ids.set(imdb.value, kp.value);
  }
  return ids;
};

export const fetchKinopoiskIds = async (imdbIds: readonly string[]) => readKinopoiskIds(await sparql(`
  SELECT ?imdb ?kp WHERE {
    VALUES ?imdb { ${imdbIds.map(literal).join(' ')} }
    ?item wdt:${IMDB_ID} ?imdb; wdt:${KINOPOISK_ID} ?kp.
  }
`));

// Maps a catalog's own id (a Wikidata external-id property) to an IMDb id.
// Resolves to null when Wikidata has no single answer.
export const resolveImdbId = async (property: string, id: string) => {
  if (!/^P\d+$/.test(property)) throw new Error(`Invalid Wikidata property: ${property}`);
  const imdbIds = new Set((await sparql(`
    SELECT ?imdb WHERE { ?item wdt:${property} ${literal(id)}; wdt:${IMDB_ID} ?imdb. }
  `)).map(({ imdb }) => imdb?.value).filter((value) => value?.startsWith('tt')));
  return imdbIds.size === 1 ? [...imdbIds][0]! : null;
};
