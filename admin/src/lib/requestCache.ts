import { idbGet, idbSet, idbDelete } from "./indexedDBCache";

type Entry<T> = {
  value: T;
  expiresAt: number;
};

// L1: in-memory (process-scoped, cleared on tab close / full reload)
const l1Cache = new Map<string, Entry<unknown>>();
// In-flight dedup: same key → one fetch, multiple awaiters
const inFlight = new Map<string, Promise<unknown>>();

/**
 * 3-layer read-through cache:
 *   L1 (in-memory Map)   — fastest, tab-scoped
 *   L2 (IndexedDB)       — survives refresh, same origin
 *   L3 (network fetch)   — source of truth
 *
 * Only GET-style fetches (no body) are safe to cache here.
 * Always call invalidateCacheKey() after any mutation on the same resource.
 */
export const cachedJsonFetch = async <T>(key: string, url: string, ttlMs: number): Promise<T> => {
  const now = Date.now();

  // L1 hit
  const l1 = l1Cache.get(key);
  if (l1 && now < l1.expiresAt) {
    return l1.value as T;
  }

  // Deduplicate concurrent requests for the same key
  const pending = inFlight.get(key);
  if (pending) {
    return (await pending) as T;
  }

  const request = idbGet<T>(key).then(async (l2) => {
    // L2 hit
    if (l2 !== null) {
      l1Cache.set(key, { value: l2, expiresAt: Date.now() + ttlMs });
      return l2;
    }

    // L3: network
    const res = await fetch(url);
    const json: T = await res.json();
    const expiresAt = Date.now() + ttlMs;
    l1Cache.set(key, { value: json, expiresAt });
    void idbSet(key, json, ttlMs); // write to L2 in background
    return json;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return (await request) as T;
};

/** Remove a key from all cache layers. Call after any mutation. */
export const invalidateCacheKey = (key: string) => {
  l1Cache.delete(key);
  void idbDelete(key);
};
