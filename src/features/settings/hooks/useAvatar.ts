import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { getCSSGradient, getGradientForUser } from "@/lib/avatar";
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
  const enabled = (options?.enabled ?? true) && !!path && !!user;
  return useQuery({
    // Keyed by path so identical avatars dedupe into one signed-URL request.
    queryKey: ["avatar-url", user?.id, path],
    enabled,
    staleTime: 600_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isStorageOutage()) throw new Error("storage_outage");
      try {
        const r = await supabase.storage.from("avatars").createSignedUrl(path ?? "", 300);
        if (r.error) throw r.error;
        retainImageInMemory(r.data.signedUrl);
        return r.data.signedUrl;
      } catch (err: unknown) {
        const status = getStorageErrorStatus(err);
        if (status === 504 || status === 503) markStorageOutage();
        throw err;
      }
    },
    retry: false,
  });
}
