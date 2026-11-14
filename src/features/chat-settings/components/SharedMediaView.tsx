import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChatSettingsScreenSurface } from "@/components/ui/chat-settings-surfaces";
import { useChat } from "@/features/messages/hooks/useChat";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink } from "@/features/settings/components/shared";
import { useSharedMedia } from "../hooks/useSharedMedia";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";
import { SharedFilesTab } from "./SharedFilesTab";
import { SharedMediaTab } from "./SharedMediaTab";
export function SharedMediaView({
  chatId,
  tab,
  communityId,
}: {
  chatId: string;
  tab: "media" | "files";
  communityId?: string;
}) {
  const chat = useChat(chatId);
  const { say } = useMessageText();
  const router = useRouter();
  const base = communityId ? `/communities/${communityId}/chats/${chatId}` : `/chats/${chatId}`;
  const available = !!chat.data && (!communityId || chat.data.communityId === communityId);
  const changeTab = (value: "media" | "files") =>
    void router.navigate({ href: `${base}/media?tab=${value}` });
  const media = useSharedMedia(chatId, "media", available && tab === "media");
  const files = useSharedMedia(chatId, "files", available && tab === "files");
  const query = tab === "media" ? media : files;
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!available) return;
    const el = marker.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          query.hasNextPage &&
          !query.isFetching &&
          !query.isFetchNextPageError
        )
          void query.fetchNextPage();
      },
      { rootMargin: "150px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    query.hasNextPage,
    query.isFetching,
    query.isFetchNextPageError,
    query.fetchNextPage,
    available,
  ]);
  if (!available || !chat.data) return <ChatSettingsLoading query={chat} />;
  const messages = [...new Map((query.data?.pages.flat() ?? []).map((m) => [m.id, m])).values()];
  return (
    <ChatSettingsScreenSurface
      className="shared-media-screen"
      header={
        <>
          <NavLink href={base}>← {say("Back to chat", "Volver al chat")}</NavLink>
          <h1>{say("Shared media", "Archivos compartidos")}</h1>
        </>
      }
    >
      <div
        className="shared-tabs"
        role="tablist"
        aria-label={say("Shared content", "Contenido compartido")}
      >
        {(["media", "files"] as const).map((value) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls="shared-panel"
            id={`shared-${value}`}
            key={value}
            onClick={() => changeTab(value)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                const next = value === "media" ? "files" : "media";
                changeTab(next);
                document.getElementById(`shared-${next}`)?.focus();
              }
            }}
          >
            {value === "media" ? say("Media", "Multimedia") : say("Files", "Archivos")}
          </button>
        ))}
      </div>
      <section
        className="shared-content-panel"
        id="shared-panel"
        role="tabpanel"
        aria-labelledby={`shared-${tab}`}
      >
        {query.isPending && <p role="status">{say("Loading…", "Cargando…")}</p>}
        {query.isError && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
            }
          >
            {say("Reload shared content", "Recargar contenido compartido")}
          </Button>
        )}
        {!query.isPending && !query.isError && !messages.length && (
          <p>{say("Nothing shared here yet.", "Aún no hay contenido compartido.")}</p>
        )}
        {tab === "media" ? (
          <SharedMediaTab messages={messages} />
        ) : (
          <SharedFilesTab messages={messages} />
        )}
        <div ref={marker} />
        {query.hasNextPage && (
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage()}
          >
            {say("Load more", "Cargar más")}
          </Button>
        )}
      </section>
      <ChatSettingsLayer chat={chat.data} />
    </ChatSettingsScreenSurface>
  );
}
