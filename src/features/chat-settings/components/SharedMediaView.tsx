import { useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useChat } from "@/features/messages/hooks/useChat";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink } from "@/features/settings/components/shared";
import { useSharedMedia } from "../hooks/useSharedMedia";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";
import { SharedFilesTab } from "./SharedFilesTab";
import { SharedMediaTab } from "./SharedMediaTab";
export function SharedMediaView({ chatId }: { chatId: string }) {
  const chat = useChat(chatId);
  const { say } = useMessageText();
  const router = useRouter();
  const { tab } = useSearch({ from: "/_authenticated/chats/$chatId/media" });
  const media = useSharedMedia(chatId, "media", !!chat.data && tab === "media");
  const files = useSharedMedia(chatId, "files", !!chat.data && tab === "files");
  const query = tab === "media" ? media : files;
  const marker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chat.data || !["media", "files"].includes(tab)) return;
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
    tab,
    chat.data,
  ]);
  if (!chat.data) return <ChatSettingsLoading query={chat} />;
  const messages = [...new Map((query.data?.pages.flat() ?? []).map((m) => [m.id, m])).values()];
  return (
    <main id="main" className="chat-settings-screen shared-media-screen">
      <header>
        <NavLink href={`/chats/${chatId}`}>← {say("Back to chat", "Volver al chat")}</NavLink>
        <h1>{say("Shared media", "Archivos compartidos")}</h1>
      </header>
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
            onClick={() =>
              void router.navigate({
                to: "/chats/$chatId/media",
                params: { chatId },
                search: { tab: value },
              })
            }
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                const next = value === "media" ? "files" : "media";
                void router.navigate({
                  to: "/chats/$chatId/media",
                  params: { chatId },
                  search: { tab: next },
                });
                document.getElementById(`shared-${next}`)?.focus();
              }
            }}
          >
            {value === "media" ? say("Media", "Multimedia") : say("Files", "Archivos")}
          </button>
        ))}
      </div>
      <section id="shared-panel" role="tabpanel" aria-labelledby={`shared-${tab}`}>
        {query.isPending && <p role="status">{say("Loading…", "Cargando…")}</p>}
        {query.isError && (
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
            }
          >
            {say("Reload shared content", "Recargar contenido compartido")}
          </button>
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
          <button
            type="button"
            className="button secondary"
            disabled={query.isFetching}
            onClick={() => void query.fetchNextPage()}
          >
            {say("Load more", "Cargar más")}
          </button>
        )}
      </section>
      <ChatSettingsLayer chat={chat.data} />
    </main>
  );
}
