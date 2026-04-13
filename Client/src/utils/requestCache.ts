type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export const fetchJsonCached = async <T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  ttlMs: number
): Promise<T> => {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now < entry.expiresAt) {
    return entry.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return (await pending) as T;
  }

  const request = fetch(url, init)
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

export const invalidateClientCache = (key: string) => {
  cache.delete(key);
};
