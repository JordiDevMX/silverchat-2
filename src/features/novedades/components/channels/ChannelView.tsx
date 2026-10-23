import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageActionsProvider } from "@/features/messages/components/MessageActionsProvider";
import { MessageList } from "@/features/messages/components/MessageList";
import { useSendMessage } from "@/features/messages/hooks/useSendMessage";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useChannelInfo } from "../../hooks/channels/useChannelInfo";
import { useChannelMessages } from "../../hooks/channels/useChannelMessages";
import { channelChat } from "../../lib/channelChat";
import { ChannelComposer } from "./ChannelComposer";
import { ChannelHeader } from "./ChannelHeader";
import "@/styles/messages.css";
export function ChannelView({ channelId }: { channelId: string }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const { say } = useMessageText();
  const info = useChannelInfo(channelId);
  const channel = info.data?.channel;
  const owner = channel?.owner_id === user?.id;
  const following = !!info.data?.follow;
  const messages = useChannelMessages(channelId, following || owner);
  const send = useSendMessage(channelId, true);
  const [readError, setReadError] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  useEffect(() => {
    void readAttempt;
    if (!following || !user?.id) return;
    let disposed = false;
    void (async () => {
      const r = await supabase
        .from("channel_followers")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", user.id);
      if (!disposed) setReadError(!!r.error);
      if (!r.error) void cache.invalidateQueries({ queryKey: ["channels", user.id] });
    })();
    return () => {
      disposed = true;
    };
  }, [following, user?.id, channelId, cache, readAttempt]);
  if (!channel)
    return (
      <main id="main" className="novedades-page">
        <NavLink href="/novedades">← {say("Novedades", "Novedades")}</NavLink>
        <QueryState loading={info.isPending} error={info.error} retry={() => void info.refetch()} />
        {!info.isPending && !info.error && (
          <p>{say("Channel unavailable", "Canal no disponible")}</p>
        )}
      </main>
    );
  const chat = channelChat(channel, following || owner);
  return (
    <main id="main" className="conversation-page channel-view">
      <ChannelHeader channel={channel} follow={info.data?.follow ?? null} />
      {readError && (
        <button type="button" onClick={() => setReadAttempt((n) => n + 1)}>
          {say("Retry marking channel read", "Reintentar marcar como leído")}
        </button>
      )}
      {following || owner ? (
        <MessageActionsProvider
          chat={chat}
          messages={messages.messages}
          onReply={() => {}}
          onNavigate={() => {}}
        >
          <MessageList
            key={channelId}
            channelMode
            chat={chat}
            query={messages}
            navigation={null}
            onRetry={send.retry}
          />
          {owner && <ChannelComposer channel={channel} onSend={send.send} />}
        </MessageActionsProvider>
      ) : (
        <p className="novedades-empty">
          {say(
            "Follow this channel to see its posts.",
            "Sigue este canal para ver sus publicaciones.",
          )}
        </p>
      )}
    </main>
  );
}
