import { Plus, X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ComposerDock({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="composer-dock" className={cn("conversation-composer", className)} {...props} />
  );
}

/** Presentation only. Playback, native audio events and capture stay in their hooks. */
export function VoiceWaveform({
  peaks,
  progress = 0,
  live = false,
}: {
  peaks: number[];
  progress?: number;
  live?: boolean;
}) {
  return (
    <svg className={live ? "live-wave" : undefined} viewBox="0 0 160 40" aria-hidden="true">
      {peaks.map((peak, i) => {
        const height = Math.max(2, peak * (live ? 0.4 : 0.38));
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: Waveform slots have no identity or state.
            key={i}
            x={i * 4}
            y={20 - height / 2}
            width={live ? 2 : 2.5}
            height={height}
            rx="1"
            className={i / peaks.length < progress ? "played" : undefined}
          />
        );
      })}
    </svg>
  );
}

export function ReplySurface({
  label,
  children,
  bar = false,
  unavailable,
  onNavigate,
  onClear,
  clearLabel,
}: {
  label: string;
  children: ReactNode;
  bar?: boolean;
  unavailable?: boolean;
  onNavigate?: () => void;
  onClear?: () => void;
  clearLabel?: string;
}) {
  return (
    <div className={cn("message-reply", bar && "reply-bar")}>
      <button type="button" disabled={unavailable} onClick={onNavigate}>
        <strong>{label}</strong>
        <span>{children}</span>
      </button>
      {bar && (
        <button type="button" className="message-icon" aria-label={clearLabel} onClick={onClear}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export const quickReactionEmoji = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"] as const;
export function QuickReactions({
  busy,
  mine,
  onSelect,
  onMore,
  moreLabel,
}: {
  busy?: boolean;
  mine?: string;
  onSelect: (emoji: string) => void;
  onMore?: () => void;
  moreLabel?: string;
}) {
  return (
    <div className="quick-reactions">
      {quickReactionEmoji.map((emoji) => (
        <button
          type="button"
          key={emoji}
          disabled={busy}
          aria-label={emoji}
          aria-pressed={emoji === mine}
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
      {onMore && (
        <button type="button" disabled={busy} aria-label={moreLabel} onClick={onMore}>
          <Plus size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
