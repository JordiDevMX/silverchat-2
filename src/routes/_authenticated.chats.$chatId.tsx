import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSkeleton, Modal } from "@/features/auth/components";
import { useRequestMutation } from "@/features/chats/hooks/useMessageRequests";
import { ChatHeader } from "@/features/messages/components/ChatHeader";
import { Composer } from "@/features/messages/components/Composer";
import { MessageList } from "@/features/messages/components/MessageList";
import { useChat } from "@/features/messages/hooks/useChat";
import { useRealtimeMessages } from "@/features/messages/hooks/useRealtimeMessages";
import { useSendMessage } from "@/features/messages/hooks/useSendMessage";
import { useMessageText } from "@/features/messages/i18n";
import { detailKey } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import "@/styles/messages.css";
export function ChatPage() {
  const { chatId } = useParams({ from: "/_authenticated/chats/$chatId" });
  return <Conversation key={chatId} chatId={chatId} />;
}
function Conversation({ chatId }: { chatId: string }) {
  const { scrollTo } = useSearch({ from: "/_authenticated/chats/$chatId" });
  const chat = useChat(chatId);
  const send = useSendMessage(chatId);
  const router = useRouter();
  const { user } = useAuth();
  const cache = useQueryClient();
  const { say } = useMessageText();
  const requests = useRequestMutation();
  const [error, setError] = useState(false);
  const [decline, setDecline] = useState(false);
  useRealtimeMessages(chatId);
  useEffect(() => {
    if (chat.isSuccess && !chat.data)
      void router.navigate({ href: "/chats?notice=unavailable", replace: true });
  }, [chat.data, chat.isSuccess, router]);
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
  const act = async (accept: boolean) => {
    if (!details.request) return;
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
  return (
    <main id="main" className="conversation-page">
      <ChatHeader chat={details} />
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
      <MessageList
        key={scrollTo ?? "history"}
        chat={details}
        scrollTo={scrollTo}
        onRetry={send.retry}
      />
      {!details.readOnly && <Composer chat={details} onSend={send.send} />}{" "}
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
    </main>
  );
}
