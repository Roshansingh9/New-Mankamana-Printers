import { deleteRedisByPrefix, deleteRedisKey, getRedisJSON, setRedisJSON } from "./redis-cache";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type CacheStats = {
  hits: number;
  misses: number;
  sets: number;
  redisHits: number;
  redisMisses: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  redisHits: 0,
  redisMisses: 0,
};

export const getCached = <T>(key: string): T | null => {
  const entry = store.get(key);
  if (!entry) {
    stats.misses += 1;
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    stats.misses += 1;
    return null;
  }

  stats.hits += 1;
  return entry.value as T;
};

export const setCached = <T>(key: string, value: T, ttlMs: number): T => {
  stats.sets += 1;
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
};

export const deleteCached = (key: string) => {
  store.delete(key);
};

const deleteCachedByPrefix = (prefix: string) => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
};

export const invalidateCacheKey = async (key: string) => {
  deleteCached(key);
  await deleteRedisKey(key);
};

export const invalidateCacheByPrefix = async (prefix: string) => {
  deleteCachedByPrefix(prefix);
  await deleteRedisByPrefix(prefix);
};

export const withCache = async <T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> => {
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  const redisValue = await getRedisJSON<T>(key);
  if (redisValue !== null) {
    stats.redisHits += 1;
    return setCached(key, redisValue, ttlMs);
  }

  stats.redisMisses += 1;
  const value = await producer();
  setCached(key, value, ttlMs);
  await setRedisJSON(key, value, ttlMs);
  return value;
};

export const getCacheStats = () => ({
  ...stats,
  keys: store.size,
  hitRate: stats.hits + stats.misses > 0 ? Number((stats.hits / (stats.hits + stats.misses)).toFixed(4)) : 0,
});
