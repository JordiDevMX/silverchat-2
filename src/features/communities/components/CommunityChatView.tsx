import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useChat } from "@/features/messages/hooks/useChat";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { Conversation } from "@/routes/_authenticated.chats.$chatId";
import { CommunityChatHeader } from "./CommunityChatHeader";
export function CommunityChatView({
  communityId,
  chatId,
  scrollTo,
}: {
  communityId: string;
  chatId: string;
  scrollTo?: string;
}) {
  const chat = useChat(chatId);
  const { user } = useAuth();
  const cache = useQueryClient();
  const { say } = useMessageText();
  const valid = chat.data?.type === "community_chat" && chat.data.communityId === communityId;
  const [readError, setReadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    void attempt;
    if (!valid || !user) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await supabase.rpc("mark_chat_as_read", { p_chat_id: chatId });
        if (active) setReadError(!!result.error);
        if (!result.error) {
          void cache.invalidateQueries({ queryKey: ["community-chats", user.id, communityId] });
          void cache.invalidateQueries({ queryKey: ["chats", user.id] });
        }
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [valid, user, chatId, communityId, cache, attempt]);
  if (!valid)
    return (
      <main id="main" className="p-6">
        <NavLink href={`/communities/${communityId}`}>← {say("Back", "Volver")}</NavLink>
        <QueryState loading={chat.isPending} error={chat.error} retry={() => void chat.refetch()} />
        {chat.isSuccess && (
          <p>
            {say("Chat unavailable in this community.", "Chat no disponible en esta comunidad.")}
          </p>
        )}
      </main>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {readError && (
        <button
          type="button"
          className="text-sm text-destructive"
          onClick={() => setAttempt((a) => a + 1)}
        >
          {say("Unable to mark read. Retry", "No se pudo marcar como leído. Reintentar")}
        </button>
      )}
      <Conversation key={chatId} chatId={chatId} Header={CommunityChatHeader} scrollTo={scrollTo} />
    </div>
  );
}
