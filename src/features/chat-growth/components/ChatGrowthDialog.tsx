import { CircleArrowOutUpRight, Megaphone, Plus, UserPlus, Users, X } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useId, useRef } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar } from "@/features/settings/components/shared";
import type { GrowthChatModel } from "../types";

function isPointerOutsideDialog(
  event: ReactPointerEvent<HTMLDialogElement>,
  dialog: HTMLDialogElement,
) {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/**
 * Reusable floating CTA dialog for owners and admins of empty channels, groups, and communities.
 * Uses native `<dialog>` top-layer modal semantics with light-dismiss and Escape support.
 */
export function ChatGrowthDialog({
  open,
  model,
  onClose,
  onShareToStatus,
  onSecondaryAction,
  onEditDescription,
}: {
  open: boolean;
  model: GrowthChatModel | null;
  onClose: () => void;
  onShareToStatus: () => void;
  onSecondaryAction: () => void;
  onEditDescription?: () => void;
}) {
  const { say } = useMessageText();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedOutsideRef = useRef(false);
  const programmaticCloseRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    programmaticCloseRef.current = false;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) {
        programmaticCloseRef.current = true;
        dialog.close();
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  if (!open || !model) return null;

  const supportsClosedBy =
    typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;
  const FallbackAvatarIcon = model.fallbackAvatarKind === "channel" ? Megaphone : Users;
  const SecondaryIcon = model.secondaryAction.icon === "plus" ? Plus : UserPlus;

  return (
    <dialog
      ref={dialogRef}
      data-slot="chat-growth-dialog"
      data-chat-type={model.type}
      className="chat-growth-dialog"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, unknown>)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (programmaticCloseRef.current) {
          programmaticCloseRef.current = false;
          return;
        }
        onClose();
      }}
      onPointerDown={(event) => {
        if (supportsClosedBy || !dialogRef.current) return;
        pressedOutsideRef.current = isPointerOutsideDialog(event, dialogRef.current);
      }}
      onPointerUp={(event) => {
        if (supportsClosedBy || !dialogRef.current) return;
        if (pressedOutsideRef.current && isPointerOutsideDialog(event, dialogRef.current)) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
    >
      <button
        type="button"
        className="chat-growth-close"
        aria-label={say("Close", "Cerrar")}
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>

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
    </dialog>
  );
}
