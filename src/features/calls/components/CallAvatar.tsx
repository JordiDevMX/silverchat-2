import { MicOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import type { CallParticipant } from "../stores/callStore";

function initialsOf(participant: CallParticipant): string {
  return getInitials({
    display_name: participant.display_name ?? "",
    username: participant.username ?? "",
  });
}

/** 11.1 — avatar with three modes: pulse rings while ringing, concentric
 * waveform rings while the peer speaks, and a muted badge after 2s of
 * silence. Pure presentation; the store supplies the level. */
export function CallAvatar({
  participant,
  size = 120,
  mode,
  audioLevel,
  remoteMuted,
}: {
  participant: CallParticipant;
  size?: number;
  mode: "pulse" | "waveform" | "still";
  audioLevel: number;
  remoteMuted?: boolean;
}) {
  const level = Math.max(0, Math.min(100, audioLevel)) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {mode === "pulse" && (
        <>
          <span className="call-pulse-ring" aria-hidden="true" />
          <span className="call-pulse-ring" aria-hidden="true" />
          <span className="call-pulse-ring" aria-hidden="true" />
        </>
      )}
      {mode === "waveform" &&
        [0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className="call-wave-ring"
            style={{
              transform: `scale(${1 + level * (0.28 + index * 0.14)})`,
              opacity: level * (0.75 - index * 0.2),
            }}
          />
        ))}
      <Avatar
        src={participant.avatar_url ?? undefined}
        initials={initialsOf(participant)}
        gradient="linear-gradient(135deg, var(--neon), var(--neon-end))"
        size="xl"
        className="border-white/20 text-white"
        style={{ fontSize: size * 0.3, width: size, height: size }}
      />
      {remoteMuted && (
        <span
          className="absolute -bottom-1 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full border border-white/20 bg-black/70 text-white"
          aria-hidden="true"
        >
          <MicOff size={14} />
        </span>
      )}
    </div>
  );
}
