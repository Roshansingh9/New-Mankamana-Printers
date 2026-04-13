const REGION_KEYS = ["BACKEND_REGION", "DATABASE_REGION", "FRONTEND_REGION"] as const;

export const assertRegionConsistency = () => {
  const values = REGION_KEYS
    .map((key) => ({ key, value: process.env[key] }))
    .filter((entry) => Boolean(entry.value));

  if (values.length <= 1) {
    return;
  }

  const uniqueRegions = new Set(values.map((entry) => entry.value));
  if (uniqueRegions.size <= 1) {
    return;
  }

  const details = values.map((entry) => `${entry.key}=${entry.value}`).join(", ");
  const message = `[RegionMismatch] Cross-region deployment detected (${details}). Align frontend, backend, and DB regions to reduce latency.`;

  if (process.env.NODE_ENV === "production" && process.env.ENFORCE_REGION_MATCH === "true") {
    throw new Error(message);
  }

  console.warn(message);
};
