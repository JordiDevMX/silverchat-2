import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readDrafts, writeDraft } from "@/features/chats/drafts";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { type Message, messageKey, outboxKey, type SendInput } from "../types";
export function useSendMessage(chatId: string, channelMode = false) {
  const { user, profile } = useAuth();
  const cache = useQueryClient();
  const userId = user?.id ?? "";
  const key = outboxKey(userId, chatId);
  const mutation = useMutation({
    mutationFn: async ({
      input,
      clientId = crypto.randomUUID(),
    }: {
      input: SendInput;
      clientId?: string;
    }) => {
      const { upload, thumbnail, ...fields } = input;
      const local: Message = {
        channel_id: channelMode ? chatId : null,
        chat_id: channelMode ? null : chatId,
        reply_to_story_id: null,
        contact_data: null,
        created_at: new Date().toISOString(),
        deleted_at: null,
        deleted_for_everyone: false,
        edited_at: null,
        file_upload_id: null,
        id: `temp-${clientId}`,
        clientId,
        is_pinned_in_chat: false,
        location_data: null,
        media_thumbnail_upload_id: null,
        mentions: null,
        media_peaks: null,
        forwarded_from_message_id: null,
        reply_to_message_id: null,
        sender_id: userId,
        ...fields,
        upload,
        thumbnail,
        sender: profile ?? undefined,
        receipts: [],
        reactions: [],
        unreadForMe: false,
        localStatus: "pending",
      };
      cache.setQueryData<Message[]>(key, (old = []) => [
        ...old.filter((m) => m.clientId !== clientId),
        local,
      ]);
      try {
        const result = await supabase
          .from("messages")
          .insert({
            ...fields,
            id: clientId,
            ...(channelMode ? { channel_id: chatId } : { chat_id: chatId }),
            sender_id: userId,
          })
          .select("id")
          .single();
        if (result.error) {
          // An ambiguous network failure may already have committed. The same UUID
          // makes retry idempotent; only reconcile an accessible row from this chat.
          const existing = await supabase
            .from("messages")
            .select("id")
            .eq("id", clientId)
            .eq(channelMode ? "channel_id" : "chat_id", chatId)
            .eq("sender_id", userId)
            .maybeSingle();
          if (existing.error || !existing.data) throw result.error;
        }
        await cache.invalidateQueries({ queryKey: messageKey(userId, chatId) });
        cache.setQueryData<Message[]>(key, (old = []) =>
          old.filter((m) => m.clientId !== clientId),
        );
        try {
          const draft = readDrafts(localStorage, userId).get(chatId);
          if (draft?.failed && draft.text.trim() === input.content?.trim())
            writeDraft(chatId, null);
        } catch {
          /* Optional storage. */
        }
        void cache.invalidateQueries({ queryKey: [channelMode ? "channels" : "chats", userId] });
      } catch (error) {
        cache.setQueryData<Message[]>(key, (old = []) =>
          old.map((m) => (m.clientId === clientId ? { ...m, localStatus: "failed" } : m)),
        );
        throw error;
      }
    },
  });
  return {
    send: (input: SendInput) => mutation.mutateAsync({ input }),
    retry: (m: Message) =>
      mutation.mutateAsync({
        clientId: m.clientId,
        input: {
          type: m.type,
          content: m.content,
          mentions: m.mentions,
          reply_to_message_id: m.reply_to_message_id,
          media_peaks: m.media_peaks,
          file_upload_id: m.file_upload_id,
          media_thumbnail_upload_id: m.media_thumbnail_upload_id,
          contact_data: m.contact_data,
          upload: m.upload,
          thumbnail: m.thumbnail,
        },
      }),
    isPending: mutation.isPending,
  };
}
