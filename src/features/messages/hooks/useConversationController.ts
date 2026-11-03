import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { readDrafts } from "@/features/chats/drafts";
import { useRequestMutation } from "@/features/chats/hooks/useMessageRequests";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useMessageText } from "../i18n";
import { detailKey, type Message, type SendInput } from "../types";
import { useChat } from "./useChat";
import { useInChatSearch } from "./useInChatSearch";
import { enrichMessages, useMessages } from "./useMessages";
import { useSendMessage } from "./useSendMessage";
export function useConversationController(chatId: string) {
  const chat = useChat(chatId);
  const send = useSendMessage(chatId);
  const router = useRouter();
  const { user } = useAuth();
  const cache = useQueryClient();
  const { say } = useMessageText();
  const requests = useRequestMutation();
  const query = useMessages(chatId);
  const [searchOpen, setSearchOpen] = useState(false);
  const search = useInChatSearch(query.messages);
  const [navigation, setNavigation] = useState<{ id: string; serial: number } | null>(null);
  const serial = useRef(0);
  const navigate = useCallback((id: string) => {
    setNavigation({ id, serial: ++serial.current });
  }, []);
  useEffect(() => {
    if (searchOpen && search.current) navigate(search.current);
    else if (searchOpen) setNavigation(null);
  }, [searchOpen, search.current, navigate]);
  const [replyId, setReplyId] = useState<string | null>(() => {
    try {
      return readDrafts(localStorage, user?.id ?? "").get(chatId)?.replyToId ?? null;
    } catch {
      return null;
    }
  });
  const replyKey = ["reply-draft", user?.id ?? "", chatId, replyId];
  const reply = useQuery({
    queryKey: replyKey,
    enabled: !!replyId,
    queryFn: async () => {
      const result = await supabase
        .from("messages")
        .select("*")
        .eq("id", replyId ?? "")
        .eq("chat_id", chatId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data
        ? ((await enrichMessages([result.data], user?.id ?? ""))[0] ?? null)
        : null;
    },
  });
  const chooseReply = (message: Message) => {
    cache.setQueryData(["reply-draft", user?.id ?? "", chatId, message.id], message);
    setReplyId(message.id);
    requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>(".composer-input textarea")?.focus(),
    );
  };
  const sendWithReply = async (input: SendInput) => {
    const id = replyId;
    await send.send({ ...input, reply_to_message_id: id });
    setReplyId((current) => (current === id ? null : current));
  };
  const [error, setError] = useState(false);
  const [decline, setDecline] = useState(false);

  useEffect(() => {
    if (chat.isSuccess && !chat.data)
      void router.navigate({ href: "/chats?notice=unavailable", replace: true });
  }, [chat.data, chat.isSuccess, router]);
  const act = async (accept: boolean) => {
    const details = chat.data;
    if (!details?.request) return;
    setError(false);
    try {
      await requests.run(
        {
          id: details.request.id,
          chatId,
          senderId: details.request.sender_id,
          name: details.name,
          username: details.other?.username ?? "",
          avatarUrl: details.avatar,
          preview: null,
        },
        accept,
      );
      setDecline(false);
      if (accept) await cache.invalidateQueries({ queryKey: detailKey(user?.id ?? "", chatId) });
      else await router.navigate({ href: "/chats" });
    } catch {
      setError(true);
    }
  };
  return {
    chat,
    send,
    say,
    requests,
    query,
    searchOpen,
    setSearchOpen,
    search,
    navigation,
    setNavigation,
    navigate,
    replyId,
    setReplyId,
    reply,
    chooseReply,
    sendWithReply,
    error,
    decline,
    setDecline,
    act,
  };
}
