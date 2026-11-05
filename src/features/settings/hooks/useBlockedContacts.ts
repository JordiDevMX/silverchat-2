import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/app/providers/i18n-provider";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useBlockedUsers } from "../hooks";
import { useAction } from "./useAction";
export function useBlockedContacts() {
  const blocked = useBlockedUsers();
  const { user } = useAuth();
  const cache = useQueryClient();
  const action = useAction();
  const { t } = useI18n();
  const unblock = (id: string | null) =>
    action.run(async () => {
      const previous = blocked.data;
      await cache.cancelQueries({ queryKey: ["blocked", user?.id] });
      cache.setQueryData(
        ["blocked", user?.id],
        previous?.filter((p) => p.id !== id),
      );
      const r = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user?.id ?? "")
        .eq("blocked_id", id ?? "");
      if (r.error) {
        cache.setQueryData(["blocked", user?.id], previous);
        throw r.error;
      }
      await Promise.all(
        ["blocked", "contacts", "public-profile", "chats"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      );
    }, "Unblocked");
  return { blocked, action, t, unblock };
}
