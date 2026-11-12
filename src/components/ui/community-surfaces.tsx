import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

/** Pure community presentation; adapters retain routing, membership and signed avatars. */
export function CommunityCardSurface({
  name,
  description,
  members,
  avatar,
  expanded,
  onToggle,
  toggleLabel,
  panelId,
  children,
}: {
  /** Adapter-rendered name; keep the link outside the toggle so both stay reachable. */
  name: ReactNode;
  description?: string | null;
  members: ReactNode;
  avatar: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Accessible name of the header toggle, e.g. "Show chats for Design". */
  toggleLabel: string;
  panelId: string;
  children: ReactNode;
}) {
  return (
    <article className="community-card">
      <div className="community-card-heading">
        <span className="community-avatar-frame">{avatar}</span>
        <span className="community-card-title">
          {name}
          <span>{description}</span>
          <small>{members}</small>
        </span>
        <button
          type="button"
          className="community-card-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          {expanded ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </button>
      </div>
      <div
        id={panelId}
        className="community-card-chats"
        data-state={expanded ? "open" : "closed"}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="community-card-chats-clip">
          <div className="community-card-chats-content">{children}</div>
        </div>
      </div>
    </article>
  );
}

export function CommunityChatRowContent({
  name,
  preview,
  timestamp,
  status,
}: {
  name: string | null;
  preview: string;
  timestamp?: string;
  status?: ReactNode;
}) {
  return (
    <>
      <span className="community-chat-icon">
        <MessageCircle size={20} aria-hidden="true" />
      </span>
      <span className="community-chat-copy">
        <strong>{name}</strong>
        <span>{preview}</span>
      </span>
      <span className="community-chat-meta">
        <time>{timestamp}</time>
        {status}
      </span>
    </>
  );
}
