import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function CallRoundButton({
  label,
  active,
  danger,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "grid size-16 cursor-pointer place-items-center rounded-full text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          danger
            ? "bg-destructive hover:bg-destructive/90"
            : active
              ? "bg-white/10 hover:bg-white/20"
              : "bg-white/25 hover:bg-white/35",
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}

export interface CallControlState {
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  isSpeakerOn: boolean;
}

export function CallControls({
  state,
  onToggleMic,
  onToggleSpeaker,
  onToggleCamera,
  onHangup,
  labels,
}: {
  state: CallControlState;
  onToggleMic: () => void;
  onToggleSpeaker: () => void;
  onToggleCamera: () => void;
  onHangup: () => void;
  labels: {
    mute: string;
    unmute: string;
    speakerOn: string;
    speakerOff: string;
    cameraOn: string;
    cameraOff: string;
    hangup: string;
  };
}) {
  return (
    <div className="flex items-center gap-4">
      <CallRoundButton
        label={state.isMicEnabled ? labels.mute : labels.unmute}
        active={!state.isMicEnabled}
        onClick={onToggleMic}
      >
        {state.isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
      </CallRoundButton>
      <CallRoundButton
        label={state.isSpeakerOn ? labels.speakerOn : labels.speakerOff}
        active={!state.isSpeakerOn}
        onClick={onToggleSpeaker}
      >
        {state.isSpeakerOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </CallRoundButton>
      <CallRoundButton
        label={state.isCameraEnabled ? labels.cameraOff : labels.cameraOn}
        active={!state.isCameraEnabled}
        onClick={onToggleCamera}
      >
        {state.isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
      </CallRoundButton>
      <CallRoundButton label={labels.hangup} danger onClick={onHangup}>
        <PhoneOff size={24} />
      </CallRoundButton>
    </div>
  );
}
