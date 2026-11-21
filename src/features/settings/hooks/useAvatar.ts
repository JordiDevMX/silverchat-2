import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { resolveAvatarSigningTarget } from "@/features/messages/lib/channelMediaSigning";
import { useAuth } from "@/lib/auth-provider";
import { getCSSGradient, getGradientForUser } from "@/lib/avatar";
import { computeSignedUrlRefreshMs, getSignedUrlPolicy } from "@/lib/signed-url-policy";
import {
  getStorageErrorStatus,
  isStorageOutage,
  markStorageOutage,
  retainImageInMemory,
} from "@/lib/storage-health";
import { supabase } from "@/lib/supabase";

export function useAvatarGradient(id: string) {
  return useQuery({
    queryKey: ["avatar-gradient", id],
    queryFn: async () => getCSSGradient(await getGradientForUser(id)),
    staleTime: Infinity,
  });
}

export function useAvatarUrl(path: string | null | undefined, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const [jitter] = useState(() => Math.random());
  const policy = getSignedUrlPolicy("avatars");
  const refreshMs = computeSignedUrlRefreshMs("avatars", jitter);
  const enabled = (options?.enabled ?? true) && !!path && !!user;
  return useQuery({
    // Keyed by path so identical avatars dedupe into one signed-URL request.
    queryKey: ["avatar-url", user?.id, path],
    enabled,
    staleTime: policy.staleTimeMs,
    gcTime: policy.gcTimeMs,
    refetchInterval: refreshMs,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isStorageOutage()) throw new Error("storage_outage");
      try {
        const target = resolveAvatarSigningTarget(path);
        if (!target) throw new Error("Avatar unavailable");
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
          const r = await supabase.storage
            .from("avatars")
            .createSignedUrl(target.path, policy.ttlSeconds);
          if (r.error) throw r.error;
          signedUrl = r.data.signedUrl;
        }
        retainImageInMemory(signedUrl);
        return signedUrl;
      } catch (err: unknown) {
        const status = getStorageErrorStatus(err);
        if (status === 504 || status === 503) markStorageOutage();
        throw err;
      }
    },
    retry: false,
  });
}
