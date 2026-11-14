import { MessageCircle } from "lucide-react";
import { type PropsWithChildren, type ReactNode, useSyncExternalStore } from "react";
import { ShellBackdrop } from "@/components/ui/shell-backdrop";
import { useMessageText } from "@/features/messages/i18n";
import { PendingDeletionBanner } from "@/features/settings/components/PendingDeletionBanner";
import { AppNavigation } from "./AppNavigation";

const desktop = matchMedia("(min-width: 1024px)");
const wide = matchMedia("(min-width: 80rem)");
function subscribeViewport(notify: () => void) {
  desktop.addEventListener("change", notify);
  wide.addEventListener("change", notify);
  return () => {
    desktop.removeEventListener("change", notify);
    wide.removeEventListener("change", notify);
  };
}
function viewport() {
  return wide.matches ? "wide" : desktop.matches ? "desktop" : "mobile";
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
  const size = useSyncExternalStore(subscribeViewport, viewport);
  return (
    <div className="app-shell">
      <AppNavigation />
      <div className="authenticated-content">
        <ShellBackdrop />
        <PendingDeletionBanner />
        {list ? (
          <div className="chat-workspace">
            {(size !== "mobile" || listOnly) && (
              <div id={listOnly ? "main" : undefined} className="chat-list-pane">
                {list}
              </div>
            )}
            {(size !== "mobile" || !listOnly) && (
              <div className="chat-content-pane">{children}</div>
            )}
            {size === "wide" && details}
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
