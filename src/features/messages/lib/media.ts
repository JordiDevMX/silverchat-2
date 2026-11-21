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
import { type MediaSigningContext, resolveMediaSigningTarget } from "./channelMediaSigning";

export function getBucketTtlSeconds(bucket: string): number {
  return getSignedUrlPolicy(bucket).ttlSeconds;
}

export async function getSignedUrl(
  upload: Upload,
  downloadOrContext: boolean | MediaSigningContext = false,
) {
  if (isStorageOutage()) throw new Error("storage_outage");
  const context: MediaSigningContext =
    typeof downloadOrContext === "boolean" ? { download: downloadOrContext } : downloadOrContext;
  const download = Boolean(context.download);
  try {
    const target = resolveMediaSigningTarget(upload, context);
    let signedUrl: string;
    if (target.mode === "edge") {
      const result = await supabase.functions.invoke<{ signedUrl?: string; error?: string }>(
        "sign-channel-media",
        { body: target.body },
      );
      if (result.error || !result.data?.signedUrl) {
        throw result.error ?? new Error(result.data?.error ?? "signing_failed");
      }
      signedUrl = result.data.signedUrl;
    } else {
      const ttlSeconds = getBucketTtlSeconds(target.bucket);
      const result = await supabase.storage
        .from(target.bucket)
        .createSignedUrl(
          target.path,
          ttlSeconds,
          download ? { download: upload.original_filename } : undefined,
        );
      if (result.error) throw result.error;
      signedUrl = result.data.signedUrl;
    }
    if (!download && upload.mime_type.startsWith("image/")) {
      retainImageInMemory(signedUrl);
    }
    return signedUrl;
  } catch (err: unknown) {
    const status = getStorageErrorStatus(err);
    if (status === 504 || status === 503) markStorageOutage();
    throw err;
  }
}

export function useMediaUrl(
  upload: Upload | undefined,
  options?: { enabled?: boolean; channelId?: string | null; messageId?: string | null },
) {
  const { user } = useAuth();
  const [jitter] = useState(() => Math.random());
  const bucket = upload?.bucket ?? "chat-media";
  const policy = getSignedUrlPolicy(bucket);
  const refreshMs = computeSignedUrlRefreshMs(bucket, jitter);
  const channelId = options?.channelId ?? upload?.channelId ?? null;
  const messageId = options?.messageId ?? upload?.messageId ?? null;
  const enabled = (options?.enabled ?? true) && !!upload;
  return useQuery({
    queryKey: ["message-media", user?.id, upload?.id, upload?.path, channelId, messageId],
    enabled,
    staleTime: policy.staleTimeMs,
    gcTime: policy.gcTimeMs,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: false,
    queryFn: () => {
      if (!upload) throw new Error("Media unavailable");
      return getSignedUrl(upload, { channelId, messageId });
    },
    retry: (count, err: unknown) =>
      shouldRetrySignedUrl(count, getStorageErrorStatus(err), isStorageOutage()),
  });
}

export async function downloadMedia(upload: Upload, context?: MediaSigningContext) {
  // A same-window anchor avoids popup blocking after asynchronous signing.
  const url = await getSignedUrl(upload, { ...context, download: true });
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = upload.original_filename;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
