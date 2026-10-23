import { useState } from "react";
import { usePinnedMessages } from "../hooks/usePinnedMessages";
import { useMessageText } from "../i18n";
import { useMessageActionUI } from "./MessageActionsProvider";
export function PinnedMessagesBar({ chatId }: { chatId: string }) {
  const query = usePinnedMessages(chatId);
  const [expanded, setExpanded] = useState(false);
  const { say } = useMessageText();
  const ui = useMessageActionUI();
  if (query.isError)
    return (
      <div className="pinned-messages">
        <button type="button" onClick={() => void query.refetch()}>
          {say("Reload pinned messages", "Recargar mensajes fijados")}
        </button>
      </div>
    );
  if (!query.data?.length) return null;
  return (
    <aside className="pinned-messages" aria-label={say("Pinned messages", "Mensajes fijados")}>
      <button
        type="button"
        className="pinned-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {say("Pinned messages", "Mensajes fijados")} · {query.data.length}{" "}
        <span>{expanded ? "⌃" : "⌄"}</span>
      </button>
      {(expanded ? query.data : query.data.slice(0, 1)).map((message) => (
        <div key={message.id}>
          <span>{message.content || say("Attachment", "Archivo adjunto")}</span>
          <button type="button" onClick={() => ui.navigate(message.id)}>
            {say("Go to message", "Ir al mensaje")}
          </button>
          {!ui.readOnly && (
            <button type="button" disabled={ui.busy} onClick={() => ui.unpin(message)}>
              {say("Unpin", "Desfijar")}
            </button>
          )}
        </div>
      ))}
    </aside>
  );
}
