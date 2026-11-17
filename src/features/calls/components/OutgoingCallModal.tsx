// 10 — Outgoing call: same fullscreen language as the incoming modal, but no
// countdown UI (L10 note): at 15s useCallLifecycle resets silently with a
// "No answer" note; the cron marks the DB row missed within 20s.
import { PhoneOff } from "lucide-react";
import { useCallText } from "../i18n";
import { hangupActiveCall } from "../lib/callActions";
import { useCallStore } from "../stores/callStore";
import { CallAvatar } from "./CallAvatar";
import { CallModalShell } from "./CallModalShell";

export function OutgoingCallModal() {
  const say = useCallText();
  const call = useCallStore((state) => state.call);
  const other = useCallStore((state) => state.other);

  if (!call || !other) return null;
  const name = other.display_name?.trim() || say("Unavailable contact");

  return (
    <CallModalShell
      title={`${say("Calling…")} — ${name}`}
      onClose={() => void hangupActiveCall("hangup")}
    >
      <CallAvatar participant={other} size={120} mode="pulse" audioLevel={0} />
      <h2 className="text-2xl font-semibold text-white">{name}</h2>
      <p className="text-sm text-white/70" aria-live="polite">
        {say("Calling…")}
      </p>
      <div className="mt-6">
        <button
          type="button"
          aria-label={say("Cancel")}
          onClick={() => void hangupActiveCall("hangup")}
          className="flex cursor-pointer flex-col items-center gap-1.5"
        >
          <span className="grid size-16 place-items-center rounded-full bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <PhoneOff size={26} />
          </span>
          <span className="text-xs text-white/60">{say("Cancel")}</span>
        </button>
      </div>
    </CallModalShell>
  );
}
