/**
 * IndexedDB-based L2 cache for admin UI data.
 * Survives page refreshes; used as a fallback below the in-memory L1 cache.
 * Safe for admin use: each entry has a TTL and keys are namespaced to "mk-admin-cache".
 * Gracefully degrades to a no-op when IndexedDB is unavailable (SSR, private browsing).
 */

const DB_NAME = "mk-admin-cache";
const STORE_NAME = "entries";
const DB_VERSION = 1;

interface DBEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });

  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result as DBEntry<T> | undefined;
        if (!entry || Date.now() >= entry.expiresAt) {
          resolve(null);
        } else {
          resolve(entry.value);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const entry: DBEntry<T> = { key, value, expiresAt: Date.now() + ttlMs };
      const req = tx.objectStore(STORE_NAME).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // non-blocking
  }
}

export async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-blocking
  }
}
