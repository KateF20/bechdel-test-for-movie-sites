import { beforeEach, vi } from 'vitest';

const createStorageArea = () => {
  const data = new Map<string, unknown>();
  return {
    get: vi.fn(async (keys: string | string[] | null) => {
      const wanted = keys === null ? [...data.keys()] : [keys].flat();
      return Object.fromEntries(wanted.filter((key) => data.has(key)).map((key) => [key, structuredClone(data.get(key))]));
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) data.set(key, structuredClone(value));
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of [keys].flat()) data.delete(key);
    }),
  };
};

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: createStorageArea(),
      sync: createStorageArea(),
      onChanged: { addListener: vi.fn() },
    },
    runtime: { sendMessage: vi.fn() },
  });
});
