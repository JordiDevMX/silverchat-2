import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { writeDraft } from "@/features/chats/drafts";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
import { useChatUIStore } from "../stores/uiStore";
export function useLeaveGroup(chatId: string) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const router = useRouter();
  const { say } = useMessageText();
  return useMutation({
    mutationFn: async () => {
      const result = await supabase
        .from("chat_members")
        .delete()
        .eq("chat_id", chatId)
        .eq("user_id", user?.id ?? "")
        .select("chat_id");
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("Membership was not removed");
      writeDraft(chatId, null);
    },
    onSuccess: async () => {
      useChatUIStore.getState().close();
      useChatUIStore.getState().notify(say("You left the group", "Saliste del grupo"));
      await router.navigate({ href: "/chats" });
      await refreshChatSettings(cache, user?.id ?? "", chatId);
    },
  });
}
