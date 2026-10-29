import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import {
  getStorageErrorStatus,
  isStorageOutage,
  markStorageOutage,
  retainImageInMemory,
} from "@/lib/storage-health";
import { supabase } from "@/lib/supabase";
import type { Upload } from "../types";

const STALE_TIME_MS = 10 * 60 * 1000;
const SHORT_REFRESH_BASE_MS = 4 * 60 * 1000;
const SHORT_JITTER_MAX_MS = 2 * 60 * 1000;
const LONG_REFRESH_BASE_MS = 50 * 60 * 1000;
const LONG_JITTER_MAX_MS = 5 * 60 * 1000;

export function getBucketTtlSeconds(bucket: string): number {
  if (bucket === "story-media" || bucket === "channel-media") {
    return 3600;
  }
  return 300;
}

export async function getSignedUrl(upload: Upload, download = false) {
  if (isStorageOutage()) throw new Error("storage_outage");
  try {
    const ttlSeconds = getBucketTtlSeconds(upload.bucket);
    const result = await supabase.storage
      .from(upload.bucket)
      .createSignedUrl(
        upload.path,
        ttlSeconds,
        download ? { download: upload.original_filename } : undefined,
      );
    if (result.error) throw result.error;
    if (!download && upload.mime_type.startsWith("image/")) {
      retainImageInMemory(result.data.signedUrl);
    }
    return result.data.signedUrl;
  } catch (err: unknown) {
    const status = getStorageErrorStatus(err);
    if (status === 504 || status === 503) markStorageOutage();
    throw err;
  }
}

export function useMediaUrl(upload: Upload | undefined, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const [jitter] = useState(() => Math.random());
  const isLongLivedBucket = upload?.bucket === "story-media" || upload?.bucket === "channel-media";
  const refreshMs = isLongLivedBucket
    ? LONG_REFRESH_BASE_MS + jitter * LONG_JITTER_MAX_MS
    : SHORT_REFRESH_BASE_MS + jitter * SHORT_JITTER_MAX_MS;
  const enabled = (options?.enabled ?? true) && !!upload;
  return useQuery({
    queryKey: ["message-media", user?.id, upload?.id, upload?.path],
    enabled,
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!upload) throw new Error("Media unavailable");
      return getSignedUrl(upload);
    },
    retry: (count, err: unknown) => {
      if (isStorageOutage()) return false;
      const status = getStorageErrorStatus(err);
      if (status === 504) return count < 1;
      return count < 2;
    },
  });
}

export async function downloadMedia(upload: Upload) {
  // A same-window anchor avoids popup blocking after asynchronous signing.
  const url = await getSignedUrl(upload, true);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = upload.original_filename;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
