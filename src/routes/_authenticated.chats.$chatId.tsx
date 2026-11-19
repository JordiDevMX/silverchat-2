import { useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { ConversationShell } from "@/components/ui/conversation-shell";
import { AppSkeleton, Modal } from "@/features/auth/components";
import { ChatGrowthHost } from "@/features/chat-growth/components/ChatGrowthHost";
import { useChatGrowthController } from "@/features/chat-growth/hooks/useChatGrowthController";
import { buildChatGrowthModel } from "@/features/chat-growth/lib/growthConfig";
import { ChatSettingsLayer } from "@/features/chat-settings/components/ChatSettingsLayer";
import { useCommunity } from "@/features/communities/hooks/useCommunity";
import { useCommunityMembers } from "@/features/communities/hooks/useCommunityMembers";
import { communityDetails } from "@/features/communities/lib/communityDetails";
import { ChatHeader } from "@/features/messages/components/ChatHeader";
import { Composer } from "@/features/messages/components/Composer";
import { InChatSearch } from "@/features/messages/components/InChatSearch";
import { MessageActionsProvider } from "@/features/messages/components/MessageActionsProvider";
import { MessageList } from "@/features/messages/components/MessageList";
import { PinnedMessagesBar } from "@/features/messages/components/PinnedMessagesBar";
import { useChat } from "@/features/messages/hooks/useChat";
import { useConversationController } from "@/features/messages/hooks/useConversationController";
import { useAuth } from "@/lib/auth-provider";
import "@/styles/messages.css";
export function ChatPage() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId" });
  const { scrollTo } = useSearch({ from: "/_authenticated/chats/$chatId" });
  const chat = useChat(chatId);
  const router = useRouter();
  const communityId = chat.data?.type === "community_chat" ? chat.data.communityId : null;
  useEffect(() => {
    if (communityId)
      void router.navigate({
        href: `/communities/${communityId}/chats/${chatId}${scrollTo ? `?scrollTo=${scrollTo}` : ""}`,
        replace: true,
      });
  }, [communityId, chatId, router, scrollTo]);
  if (communityId) return null;
  return <Conversation key={chatId} chatId={chatId} scrollTo={scrollTo} />;
}
export function Conversation({ chatId, scrollTo }: { chatId: string; scrollTo?: string }) {
  const { user } = useAuth();
  const {
    chat,
    send,
    say,
    language,
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
  } = useConversationController(chatId);
  const communityIdForGrowth =
    chat.data?.type === "community_chat" && chat.data.communityId ? chat.data.communityId : "";
  const community = useCommunity(communityIdForGrowth);
  const communityMembers = useCommunityMembers(communityIdForGrowth);
  const growthModel = chat.data
    ? buildChatGrowthModel(
        chat.data,
        user?.id,
        language,
        window.location.origin,
        community.data ?? null,
      )
    : null;
  const growth = useChatGrowthController({
    userId: user?.id,
    model: growthModel,
    messagesReady: !query.isPending && !query.isError,
    messageCount: query.messages.length,
  });
  if (chat.isPending) return <AppSkeleton />;
  if (chat.isError)
    return (
      <main id="main" className="conversation-error">
        <p role="alert">{say("This chat could not be loaded.", "No se pudo cargar este chat.")}</p>
        <button type="button" className="button secondary" onClick={() => void chat.refetch()}>
          {say("Try again", "Intentar de nuevo")}
        </button>
      </main>
    );
  if (!chat.data) return null;
  const details = chat.data;
  const addMembersChat =
    details.type === "group" && details.own?.role === "admin"
      ? details
      : details.type === "community_chat" && community.data?.role === "admin"
        ? communityDetails(community.data, communityMembers.data ?? [], user?.id ?? "")
        : null;
  return (
    <MessageActionsProvider
      chat={details}
      messages={query.messages}
      onReply={chooseReply}
      onNavigate={navigate}
    >
      <ConversationShell
        header={
          searchOpen ? (
            <InChatSearch
              search={search}
              onClose={() => {
                setSearchOpen(false);
                search.setText("");
                setNavigation(null);
              }}
            />
          ) : (
            <ChatHeader chat={details} onSearch={() => setSearchOpen(true)} />
          )
        }
        banners={
          <>
            <PinnedMessagesBar chatId={chatId} />
            <ChatSettingsLayer
              chat={details}
              onSearch={() => setSearchOpen(true)}
              onGrow={growth.openManually}
            />
            {details.request && (
              <div className="conversation-request" role="status">
                <span>
                  {details.readOnly
                    ? say("Accept this request to reply.", "Acepta esta solicitud para responder.")
                    : say(
                        "Waiting for your request to be accepted.",
                        "Esperando a que acepten tu solicitud.",
                      )}
                </span>
                {details.readOnly && (
                  <div>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={requests.busy}
                      onClick={() => setDecline(true)}
                    >
                      {say("Decline", "Rechazar")}
                    </button>
                    <button
                      className="button primary"
                      type="button"
                      disabled={requests.busy}
                      onClick={() => void act(true)}
                    >
                      {say("Accept", "Aceptar")}
                    </button>
                  </div>
                )}
              </div>
            )}
            {error && (
              <p role="alert">
                {say(
                  "Unable to update request. Try again.",
                  "No se pudo actualizar la solicitud. Inténtalo de nuevo.",
                )}
              </p>
            )}
          </>
        }
        footer={
          !details.readOnly ? (
            <Composer
              chat={details}
              onSend={sendWithReply}
              replyTo={reply.data ?? undefined}
              replyToId={replyId}
              onClearReply={() => setReplyId(null)}
            />
          ) : null
        }
      >
        <MessageList
          key={scrollTo ?? "history"}
          chat={details}
          query={query}
          navigation={navigation}
          scrollTo={scrollTo}
          onRetry={send.retry}
        />
        {decline && (
          <Modal
            title={say("Decline request?", "¿Rechazar solicitud?")}
            onClose={() => {
              if (!requests.busy) setDecline(false);
            }}
          >
            <p>
              {say(
                "This conversation will return to your chat requests only if they send a new request.",
                "La conversación volverá a tus solicitudes solo si envían una nueva solicitud.",
              )}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={requests.busy}
                onClick={() => setDecline(false)}
              >
                {say("Cancel", "Cancelar")}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={requests.busy}
                onClick={() => void act(false)}
              >
                {say("Decline", "Rechazar")}
              </button>
            </div>
          </Modal>
        )}
      </ConversationShell>
      <ChatGrowthHost
        model={growthModel}
        controller={growth}
        addMembersChat={addMembersChat}
        addMembersContext={details.type === "community_chat" ? "community" : "group"}
      />
    </MessageActionsProvider>
  );
}
