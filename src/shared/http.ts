import { send, type FetchRequest, type FetchResponse } from './messages.ts';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

// Only explicit "not found" answers mean the data does not exist. Other 4xx
// responses can be temporary authorization or rate-limit failures.
export const isNotFound = (error: unknown) => (
  error instanceof HttpError && (error.status === 404 || error.status === 410)
);

type Transport = (request: FetchRequest) => Promise<FetchResponse>;

// Content scripts are bound by the page's CORS, so by default requests go
// through the background worker, which installs its own direct transport.
let transport: Transport = (request) => send({ type: 'fetch', ...request });

export const useTransport = (next: Transport) => {
  transport = next;
};

export const request = async (url: string | URL, init: Partial<Omit<FetchRequest, 'url'>> = {}) => {
  const message: FetchRequest = { url: String(url), method: 'GET', ...init };
  const response = await transport(message);
  if (!response.ok) throw new Error(response.message);
  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(response.status, message.url);
  }
  return { text: response.text, url: response.url };
};

export const parseJson = (text: string, source: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${source} returned an invalid response`);
  }
};
