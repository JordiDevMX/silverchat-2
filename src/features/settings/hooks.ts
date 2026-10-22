import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Settings = Database["public"]["Tables"]["user_settings"]["Row"];
export type SettingsPatch = Pick<
  Partial<Settings>,
  | "theme"
  | "accent"
  | "language"
  | "profile_photo_visibility"
  | "profile_photo_exclusions"
  | "story_visibility"
  | "story_exclusions"
  | "presence_visible"
  | "read_receipts_enabled"
  | "notifications_enabled"
  | "notification_sound_enabled"
  | "notification_previews_enabled"
>;
export function useProfile() {
  const { user, profile } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    initialData: profile ?? undefined,
    queryFn: async () => {
      const r = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id ?? "")
        .single();
      if (r.error) throw r.error;
      return r.data;
    },
  });
}
export function useProfileRefresh() {
  const cache = useQueryClient();
  const auth = useAuth();
  return async () => {
    await cache.invalidateQueries({ queryKey: ["profile"] });
    await cache.invalidateQueries({ queryKey: ["public-profile"] });
    await cache.invalidateQueries({ queryKey: ["storage"] });
    await auth.refreshUser();
  };
}
export function useDeviceList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["devices", user?.id],
    queryFn: async () => {
      const r = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", user?.id ?? "")
        .order("last_active_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data;
    },
  });
}
export function useBlockedUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["blocked", user?.id],
    queryFn: async () => {
      const r = await supabase.from("profiles_blocked").select("*").order("display_name");
      if (r.error) throw r.error;
      return r.data;
    },
  });
}
export async function blockUser(targetUserId: string, currentUserId: string) {
  const r = await supabase
    .from("user_blocks")
    .insert({ blocker_id: currentUserId, blocked_id: targetUserId });
  if (r.error && r.error.code !== "23505") throw r.error;
}
export function useContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: async () => {
      const mine = await supabase
        .from("chat_members")
        .select("chat_id,chats!inner(type,status)")
        .eq("user_id", user?.id ?? "")
        .eq("chats.type", "direct")
        .eq("chats.status", "active");
      if (mine.error) throw mine.error;
      if (!mine.data.length) return [];
      const members = await supabase
        .from("chat_members")
        .select("user_id")
        .in(
          "chat_id",
          mine.data.map((r) => r.chat_id),
        )
        .neq("user_id", user?.id ?? "");
      if (members.error) throw members.error;
      const ids = [...new Set(members.data.map((r) => r.user_id))];
      if (!ids.length) return [];
      const profiles = await supabase
        .from("profiles_visible")
        .select("*")
        .in("id", ids)
        .order("display_name");
      if (profiles.error) throw profiles.error;
      return profiles.data;
    },
  });
}
export function useStorageUsage() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["storage", user?.id],
    queryFn: async () => {
      const [total, config] = await Promise.all([
        supabase.rpc("get_my_storage_usage"),
        supabase.from("app_config").select("value").eq("key", "upload.max_bytes").single(),
      ]);
      if (total.error) throw total.error;
      if (config.error) throw config.error;
      const buckets: Record<string, number> = {};
      // Paginate: PostgREST's default 1,000-row limit must not truncate the breakdown.
      for (let offset = 0; ; offset += 500) {
        const files = await supabase
          .from("file_uploads")
          .select("bucket,size_bytes")
          .eq("uploader_id", user?.id ?? "")
          .eq("status", "completed")
          .order("id")
          .range(offset, offset + 499);
        if (files.error) throw files.error;
        for (const row of files.data)
          buckets[row.bucket] = (buckets[row.bucket] ?? 0) + row.size_bytes;
        if (files.data.length < 500) break;
      }
      const softLimit = Object.values(config.data.value ?? {}).reduce<number>(
        (sum, n) => sum + (typeof n === "number" ? n : 0),
        0,
      );
      return { total: total.data, buckets, softLimit };
    },
  });
}
