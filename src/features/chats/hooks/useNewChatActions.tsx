import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAction } from "@/features/settings/hooks/useAction";
import { supabase } from "@/lib/supabase";

export function useNewChatActions(onClose: () => void) {
  const router = useRouter();
  const action = useAction();
  const cache = useQueryClient();
  const go = (href: string) => {
    onClose();
    void router.navigate({ href });
  };
  const createSelf = () =>
    action.run(async () => {
      const r = await supabase.rpc("create_self_chat");
      if (r.error) throw r.error;
      await cache.invalidateQueries({ queryKey: ["chats"] });
      go(`/chats/${r.data}`);
    });
  return { action, go, createSelf };
}
