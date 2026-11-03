import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BubbleSurface } from "./bubble-surface";

/** Presentation only: live conversations and the offline gallery share these surfaces. */
export function ConversationHeaderSurface({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      {...props}
      data-slot="conversation-header"
      className={cn(
        "conversation-header bg-gradient-silver backdrop-blur-xl shadow-silver",
        className,
      )}
    />
  );
}

export function MessageSurface({
  own,
  sticker = false,
  className,
  ...props
}: ComponentProps<"div"> & { own: boolean; sticker?: boolean }) {
  if (sticker)
    return (
      <div
        {...props}
        data-slot="sticker-surface"
        className={cn("message-bubble sticker-bubble", className)}
      />
    );
  return (
    <BubbleSurface
      {...props}
      own={own}
      className={cn(
        "message-bubble px-3.5 py-2 text-sm",
        own ? "rounded-br-md" : "rounded-bl-md border border-border/60 shadow-silver",
        className,
      )}
    />
  );
}

export function TimelineDate({ children }: { children: ReactNode }) {
  return (
    <div className="message-date">
      <span>{children}</span>
    </div>
  );
}

export function TimelineUnread({ children }: { children: ReactNode }) {
  return (
    <div className="message-unread" data-unread-marker>
      <span>{children}</span>
    </div>
  );
}

export function ReactionChip(props: ComponentProps<"button">) {
  return <button type="button" {...props} />;
}
