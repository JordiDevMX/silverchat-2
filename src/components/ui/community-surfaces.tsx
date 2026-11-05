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
  panelId,
  children,
}: {
  name: string;
  description?: string | null;
  members: ReactNode;
  avatar: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  panelId: string;
  children: ReactNode;
}) {
  return (
    <article className="community-card">
      <button
        type="button"
        className="community-card-heading"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="community-avatar-frame">{avatar}</span>
        <span className="community-card-title">
          <strong>{name}</strong>
          <span>{description}</span>
          <small>{members}</small>
        </span>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
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
