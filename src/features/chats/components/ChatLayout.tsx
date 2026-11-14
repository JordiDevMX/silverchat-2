import { MessageCircle } from "lucide-react";
import { type PropsWithChildren, type ReactNode, useSyncExternalStore } from "react";
import { ShellBackdrop } from "@/components/ui/shell-backdrop";
import { useMessageText } from "@/features/messages/i18n";
import { PendingDeletionBanner } from "@/features/settings/components/PendingDeletionBanner";
import { AppNavigation } from "./AppNavigation";

const desktopQuery = "(min-width: 1024px)";
function subscribeDesktop(notify: () => void) {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function ChatLayout({
  list,
  listOnly = false,
  details,
  children,
}: PropsWithChildren<{
  list?: ReactNode;
  listOnly?: boolean;
  details?: ReactNode;
}>) {
  const desktop = useSyncExternalStore(subscribeDesktop, () => matchMedia(desktopQuery).matches);
  const { say } = useMessageText();
  return (
    <div className="app-shell">
      <AppNavigation />
      <div className="authenticated-content">
        <ShellBackdrop />
        <PendingDeletionBanner />
        {list ? (
          <div className="chat-workspace">
            {(desktop || listOnly) && (
              <div id={listOnly ? "main" : undefined} className="chat-list-pane">
                {list}
              </div>
            )}
            {(desktop || !listOnly) && <div className="chat-content-pane">{children}</div>}
            {desktop && (
              <aside
                className="chat-details-pane"
                aria-label={say("Chat details", "Detalles del chat")}
              >
                {details || <h2>{say("Chat details", "Detalles del chat")}</h2>}
              </aside>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function ChatEmptyPane() {
  const { say } = useMessageText();
  return (
    <div className="chat-empty-pane">
      <MessageCircle size={32} aria-hidden="true" />
      <p>{say("Select a chat", "Selecciona un chat")}</p>
    </div>
  );
}
