const inFlight = new Map<string, Promise<unknown>>();
const recentlyCompleted = new Map<string, number>();

const DEFAULT_WINDOW_MS = 5000;

export const withRequestDedupe = async <T>(
  key: string,
  worker: () => Promise<T>,
  dedupeWindowMs = DEFAULT_WINDOW_MS
): Promise<T> => {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const completedAt = recentlyCompleted.get(key);
  if (completedAt && now - completedAt < dedupeWindowMs) {
    throw new Error("A similar action was just processed. Please refresh and check the latest state.");
  }

  const promise = worker()
    .then((result) => {
      recentlyCompleted.set(key, Date.now());
      return result;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
};
