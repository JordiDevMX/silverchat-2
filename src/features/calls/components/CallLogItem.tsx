// 6.3 — Call log row: avatar + presence dot, direction indicator, metadata
// line, relative timestamp, and callback buttons (voice/video).
import { ArrowDownLeft, ArrowUpRight, Phone, Video } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { useCallText } from "../i18n";
import { formatCallTimestamp, formatDuration } from "../lib/callFormatter";
import { type CallDirection, type CallLogEntry, callDirection } from "../lib/callState";

const directionIcon: Record<CallDirection, typeof ArrowUpRight> = {
  "outgoing-answered": ArrowUpRight,
  "outgoing-canceled": ArrowUpRight,
  "outgoing-no-answer": ArrowUpRight,
  "incoming-answered": ArrowDownLeft,
  "incoming-missed": ArrowDownLeft,
  "incoming-declined": ArrowDownLeft,
};

const directionClass: Record<CallDirection, string> = {
  "outgoing-answered": "text-neon",
  "outgoing-canceled": "text-muted-foreground",
  "outgoing-no-answer": "text-muted-foreground",
  "incoming-answered": "text-neon",
  "incoming-missed": "text-destructive",
  "incoming-declined": "text-muted-foreground",
};

function isPresent(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60_000;
}

export function CallLogItem({
  entry,
  locale,
  dayLabels,
  onCall,
}: {
  entry: CallLogEntry;
  locale: string;
  dayLabels: { today: string; yesterday: string };
  onCall: (entry: CallLogEntry, type: "voice" | "video") => void;
}) {
  const say = useCallText();
  const direction = callDirection(entry);
  const DirectionIcon = directionIcon[direction];
  const missed = direction === "incoming-missed" || direction === "outgoing-no-answer";
  const connected = entry.durationSeconds != null && entry.durationSeconds > 0;
  const label =
    entry.declineReason === "busy"
      ? say(entry.isOutgoing ? "Busy" : "Missed while busy")
      : connected
        ? say(entry.type === "video" ? "Video call" : "Voice call")
        : entry.status === "declined"
          ? say("Declined")
          : entry.status === "canceled"
            ? say("Canceled")
            : say("Missed");

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60 focus-within:bg-muted",
        missed && "border-l-2 border-destructive",
      )}
    >
      <span className="relative shrink-0">
        <Avatar
          src={entry.other.avatar_url ?? undefined}
          initials={getInitials({
            display_name: entry.other.display_name ?? "",
            username: entry.other.username ?? "",
          })}
          size="md"
        />
        {isPresent(entry.other.last_seen_at) && (
          <span
            className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background bg-[color:var(--color-ok,#22c55e)]"
            aria-label={say("Online")}
            role="img"
          />
        )}
        <DirectionIcon
          size={13}
          aria-hidden="true"
          className={cn("absolute -bottom-1 -right-1", directionClass[direction])}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {entry.other.display_name?.trim() || say("Unavailable contact")}
        </p>
        <p
          className={cn("truncate text-xs", missed ? "text-destructive" : "text-muted-foreground")}
        >
          {label}
          {connected && entry.durationSeconds
            ? ` · ${formatDuration(entry.durationSeconds)}`
            : null}
          {" · "}
          {formatCallTimestamp(entry.startedAt, dayLabels, locale)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          aria-label={`${say("Start voice call")} ${entry.other.display_name ?? ""}`}
          onClick={() => onCall(entry, "voice")}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Phone size={16} />
        </button>
        <button
          type="button"
          aria-label={`${say("Start video call")} ${entry.other.display_name ?? ""}`}
          onClick={() => onCall(entry, "video")}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Video size={16} />
        </button>
      </div>
    </li>
  );
}
