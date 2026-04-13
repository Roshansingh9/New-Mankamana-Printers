type EndpointMetric = {
  count: number;
  totalMs: number;
  maxMs: number;
  slowCount: number;
  lastMs: number;
};

const endpointMetrics = new Map<string, EndpointMetric>();
const SLOW_THRESHOLD_MS = 1000;

export const recordEndpointDuration = (key: string, durationMs: number) => {
  const current = endpointMetrics.get(key) ?? {
    count: 0,
    totalMs: 0,
    maxMs: 0,
    slowCount: 0,
    lastMs: 0,
  };

  current.count += 1;
  current.totalMs += durationMs;
  current.maxMs = Math.max(current.maxMs, durationMs);
  current.lastMs = durationMs;
  if (durationMs >= SLOW_THRESHOLD_MS) {
    current.slowCount += 1;
  }

  endpointMetrics.set(key, current);
};

export const getPerformanceSnapshot = () => {
  const endpoints = Array.from(endpointMetrics.entries()).map(([endpoint, metric]) => ({
    endpoint,
    requests: metric.count,
    averageMs: Number((metric.totalMs / metric.count).toFixed(2)),
    maxMs: Number(metric.maxMs.toFixed(2)),
    lastMs: Number(metric.lastMs.toFixed(2)),
    slowRequests: metric.slowCount,
    slowRatio: Number((metric.slowCount / metric.count).toFixed(4)),
  }));

  endpoints.sort((a, b) => b.averageMs - a.averageMs);
  return {
    generatedAt: new Date().toISOString(),
    slowThresholdMs: SLOW_THRESHOLD_MS,
    endpoints,
  };
};
