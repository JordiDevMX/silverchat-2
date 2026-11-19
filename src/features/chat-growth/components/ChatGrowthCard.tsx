import { CircleArrowOutUpRight, Megaphone, Plus, UserPlus, Users } from "lucide-react";
import { useId } from "react";
import { Avatar } from "@/features/settings/components/shared";
import type { GrowthChatModel } from "../types";

/**
 * Reusable inline CTA card rendered at the start of empty channels, groups, and community chats
 * for owners and admins. Sits in normal document flow with no modal or dismissal mechanics.
 */
export function ChatGrowthCard({
  model,
  onShareToStatus,
  onSecondaryAction,
  onEditDescription,
}: {
  model: GrowthChatModel;
  onShareToStatus: () => void;
  onSecondaryAction: () => void;
  onEditDescription?: () => void;
}) {
  const titleId = useId();
  const FallbackAvatarIcon = model.fallbackAvatarKind === "channel" ? Megaphone : Users;
  const SecondaryIcon = model.secondaryAction.icon === "plus" ? Plus : UserPlus;

  return (
    <section
      data-slot="chat-growth-card"
      data-chat-type={model.type}
      className="chat-growth-card"
      aria-labelledby={titleId}
    >
      <div className="chat-growth-avatar">
        {model.avatarUrl ? (
          <Avatar
            profile={{ id: model.id, display_name: model.name, avatar_url: model.avatarUrl }}
            size="large"
          />
        ) : (
          <span className="chat-growth-avatar-fallback" aria-hidden="true">
            <FallbackAvatarIcon size={34} />
          </span>
        )}
      </div>

      <h2 id={titleId} className="chat-growth-title">
        {model.title}
      </h2>

      <p className="chat-growth-subtitle">{model.subtitle}</p>

      {model.description ? (
        <p className="chat-growth-description">{model.description}</p>
      ) : onEditDescription ? (
        <button type="button" className="chat-growth-add-description" onClick={onEditDescription}>
          {model.emptyDescriptionLabel}
        </button>
      ) : (
        <p className="chat-growth-add-description">{model.emptyDescriptionLabel}</p>
      )}

      <div className="chat-growth-actions">
        <button
          type="button"
          className="chat-growth-action-btn"
          data-slot="growth-share-status"
          onClick={onShareToStatus}
        >
          <CircleArrowOutUpRight size={18} aria-hidden="true" />
          <span>{model.primaryAction.label}</span>
        </button>

        <button
          type="button"
          className="chat-growth-action-btn"
          data-slot="growth-secondary-action"
          onClick={onSecondaryAction}
        >
          <SecondaryIcon size={18} aria-hidden="true" />
          <span>{model.secondaryAction.label}</span>
        </button>
      </div>
    </section>
  );
}
