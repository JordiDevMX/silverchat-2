import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { refreshCommunities } from "@/features/communities/lib/cache";
import { communityApi } from "@/features/communities/lib/communityApi";
import { useContacts } from "@/features/settings/hooks";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
export function useAddMembers(
  chatId: string,
  text: string,
  context: "group" | "community" = "group",
) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const contacts = useContacts();
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setTerm(
          text
            .trim()
            .replace(/^@/, "")
            .replace(/[^\p{L}\p{N} _-]/gu, ""),
        ),
      300,
    );
    return () => clearTimeout(timer);
  }, [text]);
  const search = useQuery({
    queryKey: ["member-search", user?.id, term],
    enabled: !!term,
    queryFn: async () => {
      const escaped = term.replace(/_/g, "\\_");
      const result = await supabase
        .from("profiles_visible")
        .select("*")
        .or(`username.ilike.%${escaped}%,display_name.ilike.%${escaped}%`)
        .order("username")
        .limit(20);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length < 1 || ids.length > 50) throw new Error("Select 1–50 members");
      if (context === "community") {
        // Sequential individual RPCs; a retry is safe because joins are idempotent.
        for (const id of ids) await communityApi(supabase).join(chatId, id);
        return ids.length;
      }
      const result = await supabase.rpc("add_chat_members", { p_chat_id: chatId, p_user_ids: ids });
      if (result.error) throw result.error;
      return result.data;
    },
    onSettled: () =>
      context === "community"
        ? refreshCommunities(cache, user?.id ?? "")
        : refreshChatSettings(cache, user?.id ?? "", chatId),
  });
  return { contacts, search, term, add: mutation.mutateAsync, busy: mutation.isPending };
}
