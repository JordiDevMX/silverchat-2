import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { enqueueAndSendMessage } from "../lib/outboxSync";
import type { Message, SendInput } from "../types";

export function useSendMessage(chatId: string, channelMode = false) {
  const { user, profile } = useAuth();
  const cache = useQueryClient();
  const userId = user?.id ?? "";
  const mutation = useMutation({
    networkMode: "always",
    mutationFn: ({
      input,
      clientId = crypto.randomUUID(),
    }: {
      input: SendInput;
      clientId?: string;
    }) =>
      enqueueAndSendMessage({
        cache,
        userId,
        chatId,
        channelMode,
        input,
        sender: profile ?? undefined,
        clientId,
      }),
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
