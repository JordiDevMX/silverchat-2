import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InChatSearch } from "@/features/messages/components/InChatSearch";
import { MessageActionsProvider } from "@/features/messages/components/MessageActionsProvider";
import { MessageList } from "@/features/messages/components/MessageList";
import { useInChatSearch } from "@/features/messages/hooks/useInChatSearch";
import { useSendMessage } from "@/features/messages/hooks/useSendMessage";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useChannelInfo } from "../../hooks/channels/useChannelInfo";
import { useChannelMessages } from "../../hooks/channels/useChannelMessages";
import { useChannelReadCursor } from "../../hooks/channels/useChannelReadCursor";
import { channelChat } from "../../lib/channelChat";
import { ChannelComposer } from "./ChannelComposer";
import { ChannelHeader } from "./ChannelHeader";
import "@/styles/messages.css";
export function ChannelView({ channelId }: { channelId: string }) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const info = useChannelInfo(channelId);
  const channel = info.data?.channel;
  const owner = channel?.owner_id === user?.id;
  const following = !!info.data?.follow;
  const messages = useChannelMessages(channelId, following || owner);
  const send = useSendMessage(channelId, true);
  const [searchOpen, setSearchOpen] = useState(
    () => new URLSearchParams(window.location.search).get("search") === "true",
  );
  const search = useInChatSearch(messages.messages);
  const [navigation, setNavigation] = useState<{ id: string; serial: number } | null>(null);
  const serial = useRef(0);
  const navigate = useCallback((id: string) => setNavigation({ id, serial: ++serial.current }), []);
  useEffect(() => {
    if (searchOpen && search.current) navigate(search.current);
    else if (searchOpen) setNavigation(null);
  }, [searchOpen, search.current, navigate]);
  const { readError, retryRead } = useChannelReadCursor(channelId, following);
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
      {searchOpen ? (
        <InChatSearch
          search={search}
          onClose={() => {
            setSearchOpen(false);
            search.setText("");
            setNavigation(null);
          }}
        />
      ) : (
        <ChannelHeader
          channel={channel}
          follow={info.data?.follow ?? null}
          onSearch={() => setSearchOpen(true)}
        />
      )}
      {readError && (
        <Button type="button" variant="outline" className="channel-read-retry" onClick={retryRead}>
          {say("Retry marking channel read", "Reintentar marcar como leído")}
        </Button>
      )}
      {following || owner ? (
        <MessageActionsProvider
          chat={chat}
          messages={messages.messages}
          onReply={() => {}}
          onNavigate={navigate}
        >
          <MessageList
            key={channelId}
            channelMode
            chat={chat}
            query={messages}
            navigation={navigation}
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
