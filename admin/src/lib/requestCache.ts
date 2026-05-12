import { idbGet, idbSet, idbDelete } from "./indexedDBCache";

type Entry<T> = {
  value: T;
  expiresAt: number;
};

// L1: in-memory (process-scoped, cleared on tab close / full reload)
const l1Cache = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * 3-layer read-through cache: L1 (memory) → L2 (IndexedDB) → L3 (network)
 * Accepts optional RequestInit so callers can pass auth headers (cookies are
 * sent automatically by the browser for same-origin Next.js API routes, but
 * custom headers like X-Admin-Token can be forwarded here if needed).
 */
export const cachedJsonFetch = async <T>(
  key: string,
  url: string,
  ttlMs: number,
  init?: RequestInit
): Promise<T> => {
  const now = Date.now();

  // L1 hit
  const l1 = l1Cache.get(key);
  if (l1 && now < l1.expiresAt) {
    return l1.value as T;
  }

  // Deduplicate concurrent requests for the same key
  const pending = inFlight.get(key);
  if (pending) return (await pending) as T;

  const request = idbGet<T>(key).then(async (l2) => {
    // L2 hit
    if (l2 !== null) {
      l1Cache.set(key, { value: l2, expiresAt: Date.now() + ttlMs });
      // SWR: silently refresh IDB in the background so it never drifts stale
      revalidateInBackground(key, url, ttlMs, () => {}, init);
      return l2;
    }
    // L3: network
    const res = await fetch(url, init);
    const json: T = await res.json();
    const expiresAt = Date.now() + ttlMs;
    l1Cache.set(key, { value: json, expiresAt });
    void idbSet(key, json, ttlMs);
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

/**
 * revalidateInBackground
 * Fires a silent network fetch. If the fresh response differs from the cached
 * value it updates L1 + L2 and calls onUpdate so React state can refresh.
 */
export const revalidateInBackground = <T>(
  key: string,
  url: string,
  ttlMs: number,
  onUpdate: (fresh: T) => void,
  init?: RequestInit
): void => {
  fetch(url, init)
    .then((r) => { if (!r.ok) return; return r.json() as Promise<T>; })
    .then((fresh) => {
      if (!fresh) return;
      const cached = l1Cache.get(key)?.value;
      if (JSON.stringify(fresh) !== JSON.stringify(cached)) {
        l1Cache.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
        void idbSet(key, fresh, ttlMs);
        onUpdate(fresh);
      }
    })
    .catch(() => {});
};

// focusRevalidationRegistry: auto-revalidate registered keys when tab regains focus
type FocusEntry = { key: string; url: string; ttlMs: number; onUpdate: (v: unknown) => void; init?: RequestInit };
const focusRegistry = new Map<string, FocusEntry>();

export const registerFocusRevalidation = <T>(
  key: string,
  url: string,
  ttlMs: number,
  onUpdate: (fresh: T) => void,
  init?: RequestInit
): (() => void) => {
  focusRegistry.set(key, { key, url, ttlMs, onUpdate: onUpdate as (v: unknown) => void, init });
  return () => focusRegistry.delete(key);
};

const runFocusRevalidation = () => {
  for (const e of focusRegistry.values()) {
    revalidateInBackground(e.key, e.url, e.ttlMs, e.onUpdate, e.init);
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("focus", runFocusRevalidation);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) runFocusRevalidation();
  });
}
