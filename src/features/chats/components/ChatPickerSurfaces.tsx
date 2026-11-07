import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Provider-free contact identity shared by direct and group pickers. */
export function ChatContactRow({
  avatar,
  name,
  username,
  bio,
  disabled,
  onSelect,
  checked,
  actionLabel,
}: {
  avatar: ReactNode;
  name: string;
  username: string;
  bio?: string | null;
  disabled: boolean;
  onSelect: () => void;
  checked?: boolean;
  actionLabel?: string;
}) {
  const identity = (
    <>
      <span className="chat-avatar">{avatar}</span>
      <span className="new-chat-user-copy">
        <span className="new-chat-user-identity">
          <strong className="new-chat-user-name">{name}</strong>
          <small className="new-chat-user-handle">@{username}</small>
        </span>
        {bio && <span className="new-chat-user-bio">{bio}</span>}
      </span>
    </>
  );
  return (
    <li className="new-chat-user-item">
      {checked === undefined ? (
        <button type="button" className="new-chat-user-row" disabled={disabled} onClick={onSelect}>
          {identity}
          <span className="new-chat-action-pill">{actionLabel}</span>
        </button>
      ) : (
        <label className={`new-group-candidate-row ${checked ? "is-checked" : ""}`}>
          <input
            type="checkbox"
            className="new-group-candidate-checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onSelect}
          />
          {identity}
        </label>
      )}
    </li>
  );
}

export function ChatListSkeleton({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <div className="chat-skeleton" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative placeholders have no identity or reorderable state
        <div key={index}>
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
