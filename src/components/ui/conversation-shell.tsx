import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChatDoodlePattern } from "./chat-doodle-pattern";

/**
 * Shared conversation layout for all chat types (channels, direct, group, self, community).
 * Chat-type specifics compose through the header, banners, children (timeline), and footer slots.
 */
export function ConversationShell({
  header,
  banners,
  children,
  footer,
  className,
  id = "main",
}: {
  header: ReactNode;
  banners?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <main id={id} data-slot="conversation-shell" className={cn("conversation-page", className)}>
      <div className="conversation-shell-header" data-slot="conversation-shell-header">
        {header}
      </div>
      {banners}
      <div className="conversation-canvas" data-slot="conversation-canvas">
        <ChatDoodlePattern />
        <div className="conversation-canvas-content">{children}</div>
      </div>
      {footer && (
        <div className="conversation-shell-footer" data-slot="conversation-shell-footer">
          {footer}
        </div>
      )}
    </main>
  );
}
