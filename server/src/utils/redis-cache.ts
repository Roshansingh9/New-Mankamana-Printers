import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;
let warnedUnavailable = false;

const isRedisEnabled = () => {
  const disabled = process.env.REDIS_DISABLED === "true";
  const hasUrl = Boolean(process.env.REDIS_URL);
  return !disabled && hasUrl;
};

const warnUnavailable = (message: string, error?: unknown) => {
  if (!warnedUnavailable) {
    warnedUnavailable = true;
    console.warn(`[RedisCache] ${message}`, error ?? "");
  }
};

const getRedisClient = async (): Promise<RedisClient | null> => {
  if (!isRedisEnabled()) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const url = process.env.REDIS_URL as string;
  const client = createClient({ url });
  client.on("error", (error) => {
    warnUnavailable("Redis client error. Falling back to in-memory cache.", error);
  });

  connectPromise = client
    .connect()
    .then(() => {
      redisClient = client;
      warnedUnavailable = false;
      return redisClient;
    })
    .catch((error) => {
      warnUnavailable("Unable to connect to Redis. Falling back to in-memory cache.", error);
      return null;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const getRedisJSON = async <T>(key: string): Promise<T | null> => {
  try {
    const client = await getRedisClient();
    if (!client) {
      return null;
    }
    const raw = await client.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    warnUnavailable(`Failed to read key '${key}' from Redis.`, error);
    return null;
  }
};

export const setRedisJSON = async <T>(key: string, value: T, ttlMs: number): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) {
      return;
    }
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    warnUnavailable(`Failed to write key '${key}' to Redis.`, error);
  }
};

export const deleteRedisKey = async (key: string): Promise<void> => {
  try {
    const client = await getRedisClient();
    if (!client) {
      return;
    }
    await client.del(key);
  } catch (error) {
    warnUnavailable(`Failed to delete key '${key}' from Redis.`, error);
  }
};

export const deleteRedisByPrefix = async (prefix: string): Promise<number> => {
  try {
    const client = await getRedisClient();
    if (!client) {
      return 0;
    }

    let cursor = 0;
    let deleted = 0;
    do {
      const result = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      });

      cursor = result.cursor;
      if (result.keys.length > 0) {
        deleted += await client.del(result.keys);
      }
    } while (cursor !== 0);

    return deleted;
  } catch (error) {
    warnUnavailable(`Failed to delete Redis keys with prefix '${prefix}'.`, error);
    return 0;
  }
};
