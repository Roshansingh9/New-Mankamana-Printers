type Entry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export const cachedJsonFetch = async <T>(key: string, url: string, ttlMs: number): Promise<T> => {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now < hit.expiresAt) {
    return hit.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return (await pending) as T;
  }

  const request = fetch(url)
    .then((res) => res.json())
    .then((json) => {
      cache.set(key, { value: json, expiresAt: Date.now() + ttlMs });
      return json;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return (await request) as T;
};

export const invalidateCacheKey = (key: string) => {
  cache.delete(key);
};
