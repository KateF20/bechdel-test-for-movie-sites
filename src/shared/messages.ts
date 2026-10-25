import type { BechdelMovie } from './bechdel.ts';

export type FetchRequest = {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export type FetchResponse =
  | { ok: true; status: number; url: string; text: string }
  | { ok: false; reason: 'forbidden' | 'timeout' | 'network'; message: string };

// How a catalog page identifies its movie: directly by IMDb id, or by the
// catalog's own id, which Wikidata maps to an IMDb id.
export type TitleRef =
  | { imdbId: string }
  | { property: string; id: string; imdbHint?: string };

export type BechdelStatus = { movies: number; syncedAt: number | null; syncing: boolean };

export type Requests = {
  fetch: { request: FetchRequest; response: FetchResponse };
  'bechdel:find': {
    request: { ref: TitleRef };
    response: { imdbId: string | null; movie: BechdelMovie | null };
  };
  'bechdel:status': { request: object; response: BechdelStatus };
  'bechdel:sync': { request: object; response: BechdelStatus };
};

export type RequestType = keyof Requests;
export type Message<K extends RequestType = RequestType> = K extends RequestType
  ? { type: K } & Requests[K]['request']
  : never;
export type Reply<K extends RequestType = RequestType> =
  | { ok: true; value: Requests[K]['response'] }
  | { ok: false; error: string };

export const send = async <K extends RequestType>(message: Message<K>) => {
  const reply = await chrome.runtime.sendMessage<Message<K>, Reply<K>>(message);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
};
