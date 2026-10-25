const ROOT = 'cache:';

type Entry<T> = { expiresAt: number; data: T };

export type Cache<T> = {
  readonly prefix: string;
  getMany(ids: readonly string[]): Promise<Map<string, T>>;
  set(id: string, data: T): Promise<void>;
};

// The version is part of the key: bumping it orphans old entries, which the
// next prune removes, so stored data never needs migrating.
export const createCache = <T>({ name, version, ttl }: {
  name: string;
  version: number;
  ttl: (data: T) => number;
}): Cache<T> => {
  const prefix = `${ROOT}${name}:v${version}:`;
  return {
    prefix,
    async getMany(ids) {
      if (!ids.length) return new Map();
      const stored = await chrome.storage.local.get(ids.map((id) => prefix + id));
      const now = Date.now();
      const result = new Map<string, T>();
      for (const id of ids) {
        const entry = stored[prefix + id] as Entry<T> | undefined;
        if (entry && entry.expiresAt > now) result.set(id, entry.data);
      }
      return result;
    },
    async set(id, data) {
      const entry: Entry<T> = { expiresAt: Date.now() + ttl(data), data };
      await chrome.storage.local.set({ [prefix + id]: entry });
    },
  };
};

const cacheKeys = async () => (
  Object.keys(await chrome.storage.local.get(null)).filter((key) => key.startsWith(ROOT))
);

export const pruneCaches = async (active: readonly Cache<unknown>[], now = Date.now()) => {
  const stored = await chrome.storage.local.get(null);
  const stale = Object.entries(stored)
    .filter(([key, entry]) => key.startsWith(ROOT) && (
      !active.some(({ prefix }) => key.startsWith(prefix))
      || (entry as Entry<unknown>).expiresAt <= now
    ))
    .map(([key]) => key);
  if (stale.length) await chrome.storage.local.remove(stale);
};

export const countCacheEntries = async () => (await cacheKeys()).length;

export const clearCaches = async () => {
  const keys = await cacheKeys();
  if (keys.length) await chrome.storage.local.remove(keys);
};
