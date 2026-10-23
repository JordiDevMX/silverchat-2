import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { invalidateActions, type MessagePages, patchMessage } from "../lib/actionCache";
import { type Message, messageKey } from "../types";
export function useReactions(chatId: string) {
  const cache = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const key = messageKey(userId, chatId);
  const mutation = useMutation({
    mutationFn: async ({ message, emoji }: { message: Message; emoji: string | null }) => {
      const result = await supabase.rpc("set_message_reaction", {
        p_message_id: message.id,
        p_emoji: emoji ?? undefined,
      });
      if (result.error) throw result.error;
    },
    onMutate: async ({ message, emoji }) => {
      await cache.cancelQueries({ queryKey: key });
      await cache.cancelQueries({ queryKey: ["pinned", userId, chatId] });
      const pins = cache.getQueryData<Message[]>(["pinned", userId, chatId]);
      const snapshot = cache.getQueryData<MessagePages>(key);
      patchMessage(cache, userId, chatId, message.id, (m) => ({
        ...m,
        reactions: [
          ...m.reactions.filter((r) => r.user_id !== userId),
          ...(emoji
            ? [{ message_id: m.id, user_id: userId, emoji, created_at: new Date().toISOString() }]
            : []),
        ],
      }));
      return { snapshot, pins };
    },
    onError: (_e, _v, context) => {
      if (context) {
        cache.setQueryData(key, context.snapshot);
        cache.setQueryData(["pinned", userId, chatId], context.pins);
      }
    },
    onSettled: () => invalidateActions(cache, userId, chatId),
  });
  return {
    busy: mutation.isPending,
    toggle: (message: Message, emoji: string) =>
      mutation.mutateAsync({
        message,
        emoji: message.reactions.some((r) => r.user_id === userId && r.emoji === emoji)
          ? null
          : emoji,
      }),
  };
}
