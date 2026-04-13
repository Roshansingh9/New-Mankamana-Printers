type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
  fallback?: () => Promise<any>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const withTimeout = async <T>(factory: () => Promise<T>, timeoutMs = 10_000): Promise<T> => {
  return await Promise.race([
    factory(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
};

export const withRetry = async <T>(factory: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const backoffMs = options.backoffMs ?? 200;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withTimeout(factory, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(backoffMs * (attempt + 1));
      }
    }
  }

  if (options.fallback) {
    return options.fallback();
  }
  throw lastError;
};

