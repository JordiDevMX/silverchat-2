import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { invalidateActions, type MessagePages, patchMessage } from "../lib/actionCache";
import { type Message, messageKey, outboxKey } from "../types";

type Action = {
  kind: "edit" | "pin" | "delete_me" | "delete_everyone";
  message: Message;
  content?: string;
  pin?: boolean;
};
export function useMessageActions(chatId: string) {
  const cache = useQueryClient();
  const { user, profile } = useAuth();
  const userId = user?.id ?? "";
  const key = messageKey(userId, chatId);
  const mutation = useMutation({
    mutationFn: async (action: Action) => {
      const id = action.message.id;
      const result =
        action.kind === "pin"
          ? await supabase.rpc("set_message_pin", { p_message_id: id, p_pin: !!action.pin })
          : action.kind === "delete_me"
            ? await supabase.rpc("delete_chat_message_for_me", { p_message_id: id })
            : action.kind === "delete_everyone"
              ? await supabase
                  .from("messages")
                  .update({ deleted_at: new Date().toISOString(), deleted_for_everyone: true })
                  .eq("id", id)
                  .eq("chat_id", chatId)
                  .select("id")
                  .single()
              : await supabase
                  .from("messages")
                  .update({ content: action.content ?? "", edited_at: new Date().toISOString() })
                  .eq("id", id)
                  .eq("chat_id", chatId)
                  .select("id")
                  .single();
      if (result.error) throw result.error;
    },
    onMutate: async (action) => {
      await cache.cancelQueries({ queryKey: key });
      await cache.cancelQueries({ queryKey: ["pinned", userId, chatId] });
      const snapshot = cache.getQueryData<MessagePages>(key);
      const pins = cache.getQueryData<Message[]>(["pinned", userId, chatId]);
      patchMessage(cache, userId, chatId, action.message.id, (m) =>
        action.kind === "delete_me"
          ? null
          : action.kind === "pin"
            ? { ...m, is_pinned_in_chat: !!action.pin }
            : action.kind === "edit"
              ? { ...m, content: action.content ?? "", edited_at: new Date().toISOString() }
              : {
                  ...m,
                  deleted_for_everyone: true,
                  content: null,
                  reactions: [],
                  upload: undefined,
                  thumbnail: undefined,
                  media_peaks: null,
                  forwarded_from_message_id: null,
                },
      );
      if (action.kind === "pin" && action.pin)
        cache.setQueryData<Message[]>(["pinned", userId, chatId], (old) =>
          [
            ...(old ?? []).filter((m) => m.id !== action.message.id),
            { ...action.message, is_pinned_in_chat: true },
          ].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        );
      return { snapshot, pins };
    },
    onError: (_error, _action, context) => {
      if (context) {
        cache.setQueryData(key, context.snapshot);
        cache.setQueryData(["pinned", userId, chatId], context.pins);
      }
    },
    onSettled: () => invalidateActions(cache, userId, chatId),
  });
  const forward = useMutation({
    mutationFn: async ({
      message,
      chatIds,
      ids,
    }: {
      message: Message;
      chatIds: string[];
      ids: string[];
    }) => {
      if (chatIds.length < 1 || chatIds.length > 5) throw new Error("Select up to 5 chats");
      const result = await supabase.rpc("forward_chat_message", {
        p_message_id: message.id,
        p_chat_ids: chatIds,
        p_message_ids: ids,
      });
      if (result.error) throw result.error;
    },
    onMutate: ({ message, chatIds, ids }) => {
      for (const [index, target] of chatIds.entries())
        cache.setQueryData<Message[]>(outboxKey(userId, target), (old = []) => [
          ...old,
          {
            ...message,
            id: `temp-${ids[index]}`,
            clientId: ids[index],
            chat_id: target,
            sender_id: userId,
            sender: profile ?? undefined,
            created_at: new Date().toISOString(),
            edited_at: null,
            forwarded_from_message_id: message.id,
            reply_to_message_id: null,
            reply: undefined,
            reactions: [],
            receipts: [],
            mentions: null,
            unreadForMe: false,
            is_pinned_in_chat: false,
            localStatus: "pending",
          },
        ]);
    },
    onSettled: async (_data, _error, { chatIds, ids }) => {
      for (const target of chatIds) {
        await invalidateActions(cache, userId, target);
        cache.setQueryData<Message[]>(outboxKey(userId, target), (old = []) =>
          old.filter((m) => !m.clientId || !ids.includes(m.clientId)),
        );
      }
    },
  });
  return {
    busy: mutation.isPending || forward.isPending,
    edit: (message: Message, content: string) =>
      mutation.mutateAsync({ kind: "edit", message, content }),
    pin: (message: Message, pin: boolean) => mutation.mutateAsync({ kind: "pin", message, pin }),
    deleteForMe: (message: Message) => mutation.mutateAsync({ kind: "delete_me", message }),
    deleteForEveryone: (message: Message) =>
      mutation.mutateAsync({ kind: "delete_everyone", message }),
    forward: (message: Message, chatIds: string[], ids: string[]) =>
      forward.mutateAsync({ message, chatIds, ids }),
    copy: (content: string) => navigator.clipboard.writeText(content),
  };
}
