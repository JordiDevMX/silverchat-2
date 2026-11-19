import { LoaderCircle, Lock } from "lucide-react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { SystemPill } from "@/components/ui/conversation-surface";
import { Modal } from "@/features/auth/components";
import {
  isReactionUnread,
  reactionNotificationStore,
} from "@/features/chats/utils/reactionNotifications";
import { useAuth } from "@/lib/auth-provider";
import { useMarkAsRead } from "../hooks/useMarkAsRead";
import type { useMessages } from "../hooks/useMessages";
import { useSearchHighlight } from "../hooks/useSearchHighlight";
import { useMessageText } from "../i18n";
import { groupMessages, shouldShowDateSeparator } from "../lib/groupMessages";
import type { ChatDetails, Message } from "../types";
import { DateSeparator } from "./DateSeparator";
import { MediaLightbox } from "./MediaLightbox";
import { MessageBubble } from "./MessageBubble";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import { SearchHighlight } from "./SearchHighlight";
import { UnreadMarker } from "./UnreadMarker";

// Scoped to the signed-in user; no message content is persisted here.
const positions = new Map<
  string,
  { top: number; bottom: boolean; anchor?: string; offset?: number }
>();
export function MessageList({
  chat,
  scrollTo,
  onRetry,
  query,
  navigation,
  channelMode = false,
  topNotices,
  growthCard,
}: {
  chat: ChatDetails;
  channelMode?: boolean;
  topNotices?: ReactNode;
  growthCard?: ReactNode;
  query: Pick<
    ReturnType<typeof useMessages>,
    | "messages"
    | "hasNextPage"
    | "isFetching"
    | "isFetchNextPageError"
    | "fetchNextPage"
    | "isPending"
    | "isError"
    | "firstUnread"
    | "unreadLoading"
    | "unreadError"
    | "isFetchingNextPage"
    | "refetch"
  > & { refetchUnread: () => Promise<unknown> };
  navigation: { id: string; serial: number } | null;
  scrollTo?: string;
  onRetry: (m: Message) => Promise<void>;
}) {
  const { user } = useAuth();
  const { say, t } = useMessageText();
  const { highlightedId, highlight, clear } = useSearchHighlight();
  const navigated = useRef<number | null>(null);
  const { messages } = query;
  const box = useRef<HTMLElement>(null);
  const initialized = useRef(false);
  const [initialMarker, setInitialMarker] = useState<string | undefined>(undefined);
  const last = useRef<string | undefined>(undefined);
  const nearBottom = useRef(true);
  const prepend = useRef<{ height: number; top: number } | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(false);
  const [far, setFar] = useState(false);
  const [count, setCount] = useState(0);
  const [markerHidden, setMarkerHidden] = useState(false);
  const [media, setMedia] = useState<Message>();
  const [retry, setRetry] = useState<Message>();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const [targetMissing, setTargetMissing] = useState(false);
  const key = `${user?.id ?? ""}:${chat.id}`;
  const lastMessage = messages.at(-1);
  const newId = lastMessage?.clientId ?? lastMessage?.id;
  const checkPosition = () => {
    const el = box.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = distance < 100;
    setAtBottom(initialized.current && distance < 100);
    setFar(distance > 200);
    if (distance < 100) setCount(0);
    if (initialized.current) {
      const top = el.getBoundingClientRect().top;
      const anchor = [...el.querySelectorAll<HTMLElement>("[data-message-id]")].find(
        (node) => node.getBoundingClientRect().bottom > top,
      );
      positions.set(key, {
        top: el.scrollTop,
        bottom: distance < 100,
        anchor: anchor?.dataset.messageId,
        offset: anchor ? anchor.getBoundingClientRect().top - top : undefined,
      });
    }
    const marker = el.querySelector("[data-unread-marker]");
    if (marker && marker.getBoundingClientRect().bottom < el.getBoundingClientRect().top)
      setMarkerHidden(true);
  };
  const bottom = (smooth = false) => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
    checkPosition();
  };
  const loadOlder = () => {
    if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) {
      const el = box.current;
      if (el && initialized.current)
        prepend.current = { height: el.scrollHeight, top: el.scrollTop };
      void query.fetchNextPage();
    }
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || query.isPending || query.unreadLoading || query.isError) return;
    if (!initialized.current) {
      if (!initialMarker && query.firstUnread) setInitialMarker(query.firstUnread);
      const restore = positions.get(key);
      const target =
        scrollTo ??
        (restore && !restore.bottom ? restore.anchor : !restore ? query.firstUnread : undefined);
      const node = target
        ? el.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(target)}"]`)
        : null;
      if (target && !node && query.hasNextPage) {
        if (!query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage();
        return;
      }
      if (target && !node) setTargetMissing(!!scrollTo);
      initialized.current = true;
      last.current = newId;
      if (node) {
        el.scrollTop =
          node.offsetTop -
          el.offsetTop -
          (!scrollTo && restore
            ? (restore.offset ?? 0)
            : el.clientHeight / 2 - node.offsetHeight / 2);
        if (scrollTo) highlight(scrollTo);
      } else if (restore && !restore.bottom) el.scrollTop = restore.top;
      else el.scrollTop = el.scrollHeight;
      checkPosition();
      return;
    }
    if (prepend.current && !query.isFetchingNextPage) {
      el.scrollTop = prepend.current.top + el.scrollHeight - prepend.current.height;
      prepend.current = undefined;
      checkPosition();
    }
    if (newId && last.current !== newId) {
      if (nearBottom.current || lastMessage?.sender_id === (user?.id ?? "")) bottom();
      else setCount((n) => n + 1);
      last.current = newId;
    }
  });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (initialized.current && nearBottom.current) bottom();
      else checkPosition();
    });
    observer.observe(el);
    return () => observer.disconnect();
  });
  useEffect(() => {
    if (!navigation) {
      clear();
      return;
    }
    if (navigated.current === navigation.serial || !initialized.current) return;
    const loaded = messages.some((message) => message.id === navigation.id);
    const node = loaded
      ? box.current?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(navigation.id)}"]`)
      : null;
    if (node) {
      navigated.current = navigation.serial;
      node.scrollIntoView({ block: "center", behavior: "instant" });
      highlight(navigation.id);
      setTargetMissing(false);
    } else if (query.hasNextPage) {
      if (!query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage();
    } else {
      navigated.current = navigation.serial;
      setTargetMissing(true);
    }
  }, [
    navigation,
    query.isFetching,
    query.hasNextPage,
    query.isFetchNextPageError,
    query.fetchNextPage,
    messages,
    highlight,
    clear,
  ]);
  const storeReactionEntries = useStore(reactionNotificationStore, (s) => s.entries);
  const clearedAt = useStore(reactionNotificationStore, (s) => s.clearedAtByChat[chat.id]);
  const effectiveLastReadAt =
    clearedAt !== undefined
      ? new Date(
          Math.max(clearedAt, chat.own?.last_read_at ? Date.parse(chat.own.last_read_at) : 0),
        ).toISOString()
      : chat.own?.last_read_at;
  const hasUnreadMessages = messages.some((m) => m.unreadForMe);
  const hasUnreadReactions =
    Object.values(storeReactionEntries).some((e) => e.chatId === chat.id) ||
    messages.some(
      (m) =>
        m.sender_id === (user?.id ?? "") &&
        m.reactions.some(
          (r) =>
            r.user_id !== (user?.id ?? "") &&
            isReactionUnread(r.created_at, effectiveLastReadAt, chat.own?.joined_at),
        ),
    );
  const readError = useMarkAsRead(
    chat.id,
    atBottom || (!!scrollTo && !hasUnreadMessages && hasUnreadReactions),
    newId,
    hasUnreadMessages || !!chat.own?.manually_unread || hasUnreadReactions,
    !channelMode && !chat.readOnly && initialized.current,
  );
  const atConversationStart = !query.isPending && !query.isError && !query.hasNextPage;
  return (
    <div className="message-list-shell">
      <section
        ref={box}
        className="message-list"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll message history.
        tabIndex={0}
        aria-label={say("Conversation messages", "Mensajes de la conversación")}
        onScroll={() => {
          checkPosition();
          if (initialized.current && (box.current?.scrollTop ?? 999) < 100) loadOlder();
        }}
      >
        {(query.isPending || query.isFetchingNextPage) && (
          <div className="message-loading" role="status">
            <LoaderCircle className="spin" size={20} />
            {say("Loading messages…", "Cargando mensajes…")}
          </div>
        )}
        {(query.isError || query.unreadError) && (
          <div role="alert" className="message-load-error">
            <p>{say("Messages could not be loaded.", "No se pudieron cargar los mensajes.")}</p>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                if (query.unreadError) void query.refetchUnread();
                if (query.isFetchNextPageError) void query.fetchNextPage();
                else void query.refetch();
              }}
            >
              {say("Try again", "Intentar de nuevo")}
            </button>
          </div>
        )}
        {atConversationStart && (
          <div className="conversation-start-stack" data-slot="conversation-start-stack">
            <SystemPill data-slot="conversation-start-pill">{t("conversation.start")}</SystemPill>
            <SystemPill
              data-slot="conversation-encryption-pill"
              icon={<Lock size={12} aria-hidden="true" />}
            >
              {t("chat.encryptionNotice")}
            </SystemPill>
            {growthCard}
            {topNotices}
          </div>
        )}
        {targetMissing && (
          <p role="status" className="conversation-start">
            {say("That message is no longer available.", "Ese mensaje ya no está disponible.")}
          </p>
        )}
        {groupMessages(messages).map(({ message, groupedBefore, newDay }, index) => (
          <div key={message.clientId ?? message.id}>
            {shouldShowDateSeparator({
              newDay,
              isFirstMessage: index === 0,
              atConversationStart,
              createdAt: message.created_at,
            }) && <DateSeparator date={message.created_at} />}{" "}
            {!markerHidden && message.id === initialMarker && <UnreadMarker />}
            <SearchHighlight active={highlightedId === message.id}>
              <MessageBubble
                message={message}
                chat={chat}
                own={message.sender_id === (user?.id ?? "")}
                grouped={groupedBefore}
                showAvatar={
                  !channelMode &&
                  !groupedBefore &&
                  (chat.type === "group" || chat.type === "community_chat")
                }
                onMedia={setMedia}
                onRetry={(m) => {
                  setRetry(m);
                  setRetryError(false);
                }}
              />
            </SearchHighlight>
          </div>
        ))}
        {readError && (
          <p role="status" className="conversation-start">
            {say(
              "Read status could not be updated.",
              "No se pudo actualizar el estado de lectura.",
            )}
          </p>
        )}
      </section>
      {far && <ScrollToBottomButton count={count} onClick={() => bottom(true)} />}{" "}
      {media && <MediaLightbox message={media} onClose={() => setMedia(undefined)} />}{" "}
      {retry && (
        <Modal
          title={say("Retry message?", "¿Reintentar mensaje?")}
          onClose={() => {
            if (!retrying) setRetry(undefined);
          }}
        >
          <p>
            {say(
              "Your message was not confirmed. Try sending it again.",
              "No se confirmó tu mensaje. Intenta enviarlo de nuevo.",
            )}
          </p>
          {retryError && (
            <p role="alert">
              {say(
                "Still unable to send. Try again when connected.",
                "Aún no se puede enviar. Reintenta cuando tengas conexión.",
              )}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={retrying}
              onClick={() => setRetry(undefined)}
            >
              {say("Cancel", "Cancelar")}
            </button>
            <button
              className="button primary"
              type="button"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true);
                try {
                  await onRetry(retry);
                  setRetry(undefined);
                } catch {
                  setRetryError(true);
                } finally {
                  setRetrying(false);
                }
              }}
            >
              {say("Retry", "Reintentar")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
