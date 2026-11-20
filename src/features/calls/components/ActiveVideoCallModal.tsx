// 12 — Active video call: remote fullscreen (object-cover, tap toggles to
// object-contain), draggable local PiP on desktop, glass info overlay.

import type { LocalVideoTrack, RemoteVideoTrack } from "livekit-client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { getInitials } from "@/lib/avatar";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { useCallText } from "../i18n";
import { hangupActiveCall } from "../lib/callActions";
import { formatDuration } from "../lib/callFormatter";
import { notifyCall, useCallStore } from "../stores/callStore";
import { useCallTimer } from "./ActiveCallModal";
import { CallControls } from "./CallControls";
import { CallModalShell } from "./CallModalShell";

/** 12.1/12.2 — attach a LiveKit track to a <video> element. Local (mirrored)
 * playback is muted to avoid feedback. */
function CallVideo({
  track,
  mirrored,
  className,
}: {
  track: RemoteVideoTrack | LocalVideoTrack | null;
  mirrored?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !track) return;
    void track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={mirrored}
      className={className}
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}

/** Desktop-draggable PiP (12.2): pointer-drag clamped to the viewport. */
function DraggablePiP({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggable = useRef(
    typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches,
  );
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  if (!draggable.current) return <div className="call-pip">{children}</div>;
  return (
    <div
      className="call-pip"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={(event) => {
        drag.current = {
          startX: event.clientX,
          startY: event.clientY,
          baseX: offset.x,
          baseY: offset.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state) return;
        setOffset({
          x: state.baseX + (event.clientX - state.startX),
          y: state.baseY + (event.clientY - state.startY),
        });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      {children}
    </div>
  );
}

export function ActiveVideoCallModal() {
  const say = useCallText();
  const call = useCallStore((state) => state.call);
  const other = useCallStore((state) => state.other);
  const answeredAt = useCallStore((state) => state.answeredAt);
  const remoteVideoTrack = useCallStore((state) => state.remoteVideoTrack);
  const localVideoTrack = useCallStore((state) => state.localVideoTrack);
  const isMicEnabled = useCallStore((state) => state.isMicEnabled);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const isSpeakerOn = useCallStore((state) => state.isSpeakerOn);
  const room = useCallStore((state) => state.room);
  const remoteAudioTrack = useCallStore((state) => state.remoteAudioTrack);
  const [fit, setFit] = useState<"cover" | "contain">("cover");

  useLiveKitRoom(call?.id ?? "", "video");
  const elapsed = useCallTimer(answeredAt);

  if (!call || !other) return null;
  const name = other.display_name?.trim() || say("Unavailable contact");

  const toggleMic = () => {
    const next = !isMicEnabled;
    void room?.localParticipant
      .setMicrophoneEnabled(next)
      .then(() => useCallStore.setState({ isMicEnabled: next }))
      .catch(() => notifyCall(say("Call failed. Try again.")));
  };
  const toggleCamera = () => {
    if (!room) return;
    const next = !isCameraEnabled;
    void room.localParticipant
      .setCameraEnabled(next)
      .then((publication) => {
        if (useCallStore.getState().room !== room) return;
        // Toggling unpublishes/publishes a new track: the PiP must follow the
        // publication or it keeps the stopped one (a frozen last frame).
        useCallStore.setState({
          isCameraEnabled: next,
          localVideoTrack: next ? (publication?.videoTrack ?? null) : null,
        });
      })
      .catch(() => notifyCall(say("Call failed. Try again.")));
  };
  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    try {
      remoteAudioTrack?.setVolume(next ? 1 : 0);
      useCallStore.setState({ isSpeakerOn: next });
    } catch {
      notifyCall(say("Call failed. Try again."));
    }
  };

  // Guardian round 4 (AUD-003): a failed hangup write is never silently
  // discarded — same feedback pattern as the voice modal.
  const hangup = () => {
    void hangupActiveCall("hangup").then((outcome) => {
      if (outcome === "error") notifyCall(say("Call failed. Try again."));
    });
  };

  return (
    <CallModalShell
      title={`${say("Video call")} — ${name}`}
      onClose={() => {}}
      className="call-modal-video"
    >
      <div className="absolute inset-0">
        {remoteVideoTrack ? (
          <button
            type="button"
            aria-label={say("Toggle video size")}
            onClick={() => setFit(fit === "cover" ? "contain" : "cover")}
            className="block size-full cursor-pointer"
          >
            <CallVideo
              track={remoteVideoTrack}
              className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
            />
          </button>
        ) : (
          <div className="grid size-full place-items-center bg-black">
            <div className="flex flex-col items-center gap-3 text-white/80">
              <Avatar
                src={other.avatar_url ?? undefined}
                initials={getInitials({
                  display_name: other.display_name ?? "",
                  username: other.username ?? "",
                })}
                gradient="linear-gradient(135deg, var(--neon), var(--neon-end))"
                size="xl"
                className="border-white/20 text-white"
                style={{ width: 64, height: 64 }}
              />
              <span className="text-sm">{say("Camera off")}</span>
            </div>
          </div>
        )}
        <DraggablePiP>
          {localVideoTrack ? (
            <CallVideo
              track={localVideoTrack}
              mirrored
              className="h-[120px] w-[90px] bg-black object-cover sm:h-[120px] sm:w-[160px]"
            />
          ) : (
            <div className="grid h-[120px] w-[90px] place-items-center bg-muted text-muted-foreground sm:w-[160px]">
              <span className="text-xs">{say("Camera off")}</span>
            </div>
          )}
        </DraggablePiP>
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2">
          <div className="call-glass-info text-white">
            <span className="text-sm">{name}</span>
            <span className="text-sm text-white/70" role="timer">
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <CallControls
            state={{ isMicEnabled, isCameraEnabled, isSpeakerOn }}
            showCamera
            onToggleMic={toggleMic}
            onToggleSpeaker={toggleSpeaker}
            onToggleCamera={toggleCamera}
            onHangup={hangup}
            labels={{
              mute: say("Mute microphone"),
              unmute: say("Unmute microphone"),
              speakerOn: say("Speaker on"),
              speakerOff: say("Speaker off"),
              cameraOn: say("Turn camera on"),
              cameraOff: say("Turn camera off"),
              hangup: say("Hangup"),
            }}
          />
        </div>
      </div>
    </CallModalShell>
  );
}
