import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import {
  computeSignedUrlRefreshMs,
  getSignedUrlPolicy,
  shouldRetrySignedUrl,
} from "@/lib/signed-url-policy";
import {
  getStorageErrorStatus,
  isStorageOutage,
  markStorageOutage,
  retainImageInMemory,
} from "@/lib/storage-health";
import { supabase } from "@/lib/supabase";
import type { Upload } from "../types";

export function getBucketTtlSeconds(bucket: string): number {
  return getSignedUrlPolicy(bucket).ttlSeconds;
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
  const bucket = upload?.bucket ?? "chat-media";
  const policy = getSignedUrlPolicy(bucket);
  const refreshMs = computeSignedUrlRefreshMs(bucket, jitter);
  const enabled = (options?.enabled ?? true) && !!upload;
  return useQuery({
    queryKey: ["message-media", user?.id, upload?.id, upload?.path],
    enabled,
    staleTime: policy.staleTimeMs,
    gcTime: policy.gcTimeMs,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!upload) throw new Error("Media unavailable");
      return getSignedUrl(upload);
    },
    retry: (count, err: unknown) =>
      shouldRetrySignedUrl(count, getStorageErrorStatus(err), isStorageOutage()),
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
