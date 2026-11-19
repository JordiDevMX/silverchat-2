export interface SignedUrlPolicy {
  ttlSeconds: number;
  staleTimeMs: number;
  gcTimeMs: number;
  refreshBaseMs: number;
  refreshJitterMs: number;
}

// Long-lived public/feed media buckets: 1h TTL, 45m stale, 50m gc, 48-54m jittered refresh.
const LONG_LIVED_POLICY: SignedUrlPolicy = {
  ttlSeconds: 3600,
  staleTimeMs: 45 * 60 * 1000,
  gcTimeMs: 50 * 60 * 1000,
  refreshBaseMs: 48 * 60 * 1000,
  refreshJitterMs: 6 * 60 * 1000,
};

// Private chat media & avatars: 15m TTL, 10m stale, 12m gc, 11-13m jittered refresh.
// Guarantees React Query never serves an expired signed URL while avoiding 4-min bursts.
const PRIVATE_MEDIA_POLICY: SignedUrlPolicy = {
  ttlSeconds: 900,
  staleTimeMs: 10 * 60 * 1000,
  gcTimeMs: 12 * 60 * 1000,
  refreshBaseMs: 11 * 60 * 1000,
  refreshJitterMs: 2 * 60 * 1000,
};

export function getSignedUrlPolicy(bucket: string): SignedUrlPolicy {
  if (bucket === "story-media" || bucket === "channel-media") {
    return LONG_LIVED_POLICY;
  }
  return PRIVATE_MEDIA_POLICY;
}

export function computeSignedUrlRefreshMs(bucket: string, jitter: number): number {
  const clamped = Math.min(1, Math.max(0, jitter));
  const policy = getSignedUrlPolicy(bucket);
  return policy.refreshBaseMs + clamped * policy.refreshJitterMs;
}

export function shouldRetrySignedUrl(
  failureCount: number,
  status: number | undefined,
  storageOutage: boolean,
): boolean {
  if (storageOutage) return false;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  if (status === 503 || status === 504) return failureCount < 1;
  return failureCount < 2;
}
