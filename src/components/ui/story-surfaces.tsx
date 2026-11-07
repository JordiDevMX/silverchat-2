import { Camera, Plus, Send } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { Button } from "./button";

/** Presentation only: media URLs, privacy, ordering and actions belong to adapters. */
export function StoryCardSurface({
  containerRef,
  label,
  name,
  unseen = false,
  empty = false,
  background,
  preview,
  text,
  avatar,
  onOpen,
  onCreate,
  addLabel,
}: {
  containerRef?: Ref<HTMLDivElement>;
  label: string;
  name: string;
  unseen?: boolean;
  empty?: boolean;
  background?: string;
  preview?: ReactNode;
  text?: string | null;
  avatar?: ReactNode;
  onOpen?: () => void;
  onCreate?: () => void;
  addLabel?: string;
}) {
  return (
    <div ref={containerRef} className="story-card-wrap">
      <button
        type="button"
        className={`story-card ${unseen ? "unwatched" : "seen"} ${empty ? "empty" : ""}`}
        style={{ background }}
        onClick={onOpen}
        aria-label={label}
      >
        {preview}
        {text && <span className="story-card-text">{text}</span>}
        {empty ? (
          <span className="story-camera">
            <Camera size={26} />
          </span>
        ) : (
          <span className="story-avatar-ring">{avatar}</span>
        )}
        <strong>{name}</strong>
      </button>
      {onCreate && (
        <button type="button" className="story-add" aria-label={addLabel} onClick={onCreate}>
          <Plus size={16} />
        </button>
      )}
    </div>
  );
}

export function StoryProgressSurface({
  count,
  index,
  progress,
  label = "Story progress",
}: {
  count: number;
  index: number;
  progress: number;
  label?: string;
}) {
  return (
    <div role="img" className="story-progress" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Progress slots have fixed positional identity.
        <div key={`segment-${i}`}>
          <span style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
        </div>
      ))}
    </div>
  );
}

export function StoryReplySurface({
  text,
  onChange,
  onSubmit,
  label,
  placeholder,
  sendLabel,
  busy = false,
  error,
  onFocus,
  onBlur,
}: {
  text: string;
  onChange: (text: string) => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  label: string;
  placeholder: string;
  sendLabel: string;
  busy?: boolean;
  error?: ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <form className="story-reply" onSubmit={onSubmit}>
      <input
        value={text}
        maxLength={500}
        disabled={busy}
        aria-label={label}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        type="submit"
        className="story-send"
        disabled={busy || !text.trim()}
        aria-label={sendLabel}
      >
        <Send size={18} />
        <span className="sr-only">{sendLabel}</span>
      </Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function StoryStageSurface({
  children,
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={`story-stage ${className}`}>
      {children}
    </div>
  );
}
