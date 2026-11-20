// 8 — Incoming call: fullscreen modal, pulsing avatar, 15s countdown ring,
// accept/decline. The 15s auto-timeout is owned by useCallLifecycle (L1).
import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useCallText } from "../i18n";
import { acceptIncomingCall, declineIncomingCall } from "../lib/callActions";
import { ringRemainingMs } from "../lib/callState";
import { notifyCall, useCallStore } from "../stores/callStore";
import { RING_TIMEOUT_MS } from "../types";
import { CallAvatar } from "./CallAvatar";
import { CallModalShell } from "./CallModalShell";

function ActionButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={`grid size-16 cursor-pointer place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
      >
        {children}
      </button>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}

export function IncomingCallModal() {
  const say = useCallText();
  const call = useCallStore((state) => state.call);
  const other = useCallStore((state) => state.other);
  const ringDeadline = useCallStore((state) => state.ringDeadline);
  const [remaining, setRemaining] = useState(RING_TIMEOUT_MS);

  useEffect(() => {
    const tick = () => setRemaining(ringRemainingMs(ringDeadline));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [ringDeadline]);

  if (!call || !other) return null;

  const accept = async () => {
    const outcome = await acceptIncomingCall();
    if (outcome === "permission") {
      notifyCall(say("Camera/microphone access is required. Enable it in your browser settings."));
    } else if (outcome === "error") {
      notifyCall(say("Call failed. Try again."));
    }
  };

  const ratio = remaining / RING_TIMEOUT_MS;
  const circumference = 2 * Math.PI * 67;
  const name = other.display_name?.trim() || say("Unavailable contact");

  // Guardian round 4 (AUD-003): a failed decline write is never silently
  // discarded — same feedback pattern as the accept path above.
  const decline = () => {
    void declineIncomingCall("declined").then((outcome) => {
      if (outcome === "error") notifyCall(say("Call failed. Try again."));
    });
  };

  return (
    <CallModalShell
      title={`${say(call.type === "video" ? "Incoming video call" : "Incoming voice call")} — ${name}`}
      onClose={decline}
    >
      <div className="relative grid place-items-center">
        <CallAvatar participant={other} size={120} mode="pulse" audioLevel={0} />
        <svg className="call-countdown" viewBox="0 0 148 148" aria-hidden="true">
          <circle
            cx="74"
            cy="74"
            r="67"
            stroke="color-mix(in oklab, var(--neon) 25%, transparent)"
          />
          <circle
            cx="74"
            cy="74"
            r="67"
            stroke="var(--neon)"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 74 74)"
          />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-white">{name}</h2>
      <p className="text-sm text-white/70">
        {say(call.type === "video" ? "Incoming video call" : "Incoming voice call")}
      </p>
      <p className="text-sm text-white/50" aria-live="polite">
        {Math.ceil(remaining / 1000)}s
      </p>
      <div className="mt-6 flex items-center gap-16">
        <ActionButton
          label={say("Decline")}
          className="bg-destructive hover:bg-destructive/90"
          onClick={decline}
        >
          <PhoneOff size={26} />
        </ActionButton>
        <ActionButton
          label={say("Accept")}
          className="call-breathe bg-neon hover:brightness-110"
          onClick={() => void accept()}
        >
          <Phone size={26} />
        </ActionButton>
      </div>
    </CallModalShell>
  );
}
