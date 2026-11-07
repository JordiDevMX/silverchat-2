import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
export function useChannelDeletion(channelId: string) {
  const { user } = useAuth();
  const router = useRouter();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const deleteChannel = async () => {
    setBusy(true);
    setError(false);
    try {
      const r = await supabase
        .from("channels")
        .delete()
        .eq("id", channelId)
        .eq("owner_id", user?.id ?? "")
        .select("id")
        .single();
      if (r.error) throw r.error;
      await refreshNovedades(cache, user?.id ?? "");
      await router.navigate({ href: "/novedades" });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, deleteChannel };
}
