// 11 — Active voice call: avatar + waveform rings, timer, Mic/Speaker/Hangup.
import { useEffect, useState } from "react";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { useCallText } from "../i18n";
import { hangupActiveCall } from "../lib/callActions";
import { formatDuration } from "../lib/callFormatter";
import { notifyCall, useCallStore } from "../stores/callStore";
import { CallAvatar } from "./CallAvatar";
import { CallControls } from "./CallControls";
import { CallModalShell } from "./CallModalShell";

/** Elapsed seconds since answeredAt, ticked once per second (11.3). */
export function useCallTimer(answeredAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!answeredAt) return;
    const start = new Date(answeredAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [answeredAt]);
  return elapsed;
}

export function ActiveCallModal() {
  const say = useCallText();
  const call = useCallStore((state) => state.call);
  const other = useCallStore((state) => state.other);
  const answeredAt = useCallStore((state) => state.answeredAt);
  const remoteAudioLevel = useCallStore((state) => state.remoteAudioLevel);
  const isMicEnabled = useCallStore((state) => state.isMicEnabled);
  const isSpeakerOn = useCallStore((state) => state.isSpeakerOn);
  const room = useCallStore((state) => state.room);
  const remoteAudioTrack = useCallStore((state) => state.remoteAudioTrack);

  // LiveKit connect lives for the lifetime of the answered modal (13).
  useLiveKitRoom(call?.id ?? "", "voice");
  const elapsed = useCallTimer(answeredAt);

  if (!call || !other) return null;
  const name = other.display_name?.trim() || say("Unavailable contact");

  // Remote muted badge (11.1): below level 5 counts as silence.
  const remoteMuted = remoteAudioLevel < 5;

  const toggleMic = () => {
    const next = !isMicEnabled;
    void room?.localParticipant
      .setMicrophoneEnabled(next)
      .then(() => useCallStore.setState({ isMicEnabled: next }))
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
  // discarded — the modal closes via the guarded local reset, and the note
  // surfaces the failure.
  const hangup = () => {
    void hangupActiveCall("hangup").then((outcome) => {
      if (outcome === "error") notifyCall(say("Call failed. Try again."));
    });
  };

  return (
    <CallModalShell title={`${say("Voice call")} — ${name}`} onClose={() => {}}>
      <CallAvatar
        participant={other}
        size={120}
        mode="waveform"
        audioLevel={remoteAudioLevel}
        remoteMuted={remoteMuted}
      />
      <h2 className="text-2xl font-semibold text-white">{name}</h2>
      <p className="text-sm text-white/70">{say("Voice call")}</p>
      <p className="text-lg text-white" role="timer" aria-live="off">
        {formatDuration(elapsed)}
      </p>
      <div className="mt-6">
        <CallControls
          state={{ isMicEnabled, isSpeakerOn }}
          showCamera={false}
          onToggleMic={toggleMic}
          onToggleSpeaker={toggleSpeaker}
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
    </CallModalShell>
  );
}
