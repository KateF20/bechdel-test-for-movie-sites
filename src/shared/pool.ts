export const runPool = async <T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await task(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
};
