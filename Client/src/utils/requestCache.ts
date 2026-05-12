import { idbGet, idbSet, idbDelete } from "./indexedDBCache";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

// L1: in-memory cache (tab-scoped, cleared on page refresh)
const l1Cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export const fetchJsonCached = async <T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  ttlMs: number
): Promise<T> => {
  const now = Date.now();

  // L1 hit
  const l1 = l1Cache.get(key);
  if (l1 && now < l1.expiresAt) {
    return l1.value as T;
  }

  // Deduplicate in-flight requests
  const pending = inFlight.get(key);
  if (pending) {
    return (await pending) as T;
  }

  // L2 hit (IndexedDB) — check before hitting network
  const l2Promise = idbGet<T>(key).then(async (l2) => {
    if (l2 !== null) {
      // Populate L1 from L2
      l1Cache.set(key, { value: l2, expiresAt: now + ttlMs });
      // SWR: silently refresh IDB in the background so it never drifts stale
      revalidateInBackground(key, url, init, ttlMs, l2, () => {});
      return l2;
    }

    // L3: network fetch
    const res = await fetch(url, init);
    const json: T = await res.json();

    const expiresAt = Date.now() + ttlMs;
    l1Cache.set(key, { value: json, expiresAt });
    // Persist to L2 in background — don't await
    void idbSet(key, json, ttlMs);

    return json;
  }).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, l2Promise);
  return (await l2Promise) as T;
};

export const invalidateClientCache = (key: string) => {
  l1Cache.delete(key);
  void idbDelete(key);
};

// focusRevalidationRegistry: url → { key, init, ttlMs, onUpdate }
type FocusEntry = { key: string; url: string; init: RequestInit | undefined; ttlMs: number; onUpdate: (v: unknown) => void };
const focusRegistry = new Map<string, FocusEntry>();

/**
 * registerFocusRevalidation
 * Registers a key for automatic background revalidation when the tab regains focus.
 * Call once per data source (e.g. in a useEffect). Deregister on unmount.
 */
export const registerFocusRevalidation = <T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  ttlMs: number,
  onUpdate: (fresh: T) => void
): (() => void) => {
  focusRegistry.set(key, { key, url, init, ttlMs, onUpdate: onUpdate as (v: unknown) => void });
  return () => focusRegistry.delete(key);
};

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    for (const entry of focusRegistry.values()) {
      revalidateInBackground(entry.key, entry.url, entry.init, entry.ttlMs, l1Cache.get(entry.key)?.value, entry.onUpdate as (fresh: unknown) => void);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      for (const entry of focusRegistry.values()) {
        revalidateInBackground(entry.key, entry.url, entry.init, entry.ttlMs, l1Cache.get(entry.key)?.value, entry.onUpdate as (fresh: unknown) => void);
      }
    }
  });
}

/**
 * revalidateInBackground
 * Fires a network fetch for `url` without touching the cache read path.
 * If the fresh response differs from `current` (JSON comparison), it:
 *   1. Overwrites L1 + L2 with the fresh data
 *   2. Calls `onUpdate(freshData)` so the caller can update React state
 * All errors are swallowed — this must never break the UI.
 */
export const revalidateInBackground = <T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  ttlMs: number,
  current: T,
  onUpdate: (fresh: T) => void
): void => {
  fetch(url, init)
    .then((r) => {
      if (!r.ok) return;
      return r.json() as Promise<T>;
    })
    .then((fresh) => {
      if (!fresh) return;
      if (JSON.stringify(fresh) !== JSON.stringify(current)) {
        l1Cache.set(key, { value: fresh, expiresAt: Date.now() + ttlMs });
        void idbSet(key, fresh, ttlMs);
        onUpdate(fresh);
      }
    })
    .catch(() => {});
};

// Tracks active background refresh intervals
const backgroundIntervals = new Map<string, ReturnType<typeof setInterval>>();

/**
 * startBackgroundRefresh
 * Registers an interval-based background refresh for catalog data.
 * Fires `revalidateInBackground` every `ttlMs` milliseconds regardless of tab focus.
 * Returns a cleanup function — call it in the useEffect return to clear on unmount.
 */
export const startBackgroundRefresh = <T>(
  key: string,
  url: string,
  init: RequestInit | undefined,
  ttlMs: number,
  getCurrent: () => T,
  onUpdate: (fresh: T) => void
): (() => void) => {
  if (backgroundIntervals.has(key)) clearInterval(backgroundIntervals.get(key)!);
  const id = setInterval(() => {
    revalidateInBackground(key, url, init, ttlMs, getCurrent(), onUpdate);
  }, ttlMs);
  backgroundIntervals.set(key, id);
  return () => {
    clearInterval(id);
    backgroundIntervals.delete(key);
  };
};
