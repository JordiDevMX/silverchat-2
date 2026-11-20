// 14 — Global provider mounted inside the authenticated layout: realtime
// incoming calls, lifecycle effects, sounds, and the phase-matched modal.
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { useCallLifecycle } from "../hooks/useActiveCall";
import { useCallSounds } from "../hooks/useCallSounds";
import { useIncomingCall } from "../hooks/useIncomingCall";
import { useCallText } from "../i18n";
import { noteText } from "../lib/callState";
import { notifyCall, useCallStore } from "../stores/callStore";
import { ActiveCallModal } from "./ActiveCallModal";
import { CallModalShell } from "./CallModalShell";
import { IncomingCallModal } from "./IncomingCallModal";
import { OutgoingCallModal } from "./OutgoingCallModal";

function CallNotice() {
  const note = useCallStore((state) => state.note);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => notifyCall(null), 4_000);
    return () => clearTimeout(timer);
  }, [note]);
  return note ? (
    <div className="chat-settings-notice chat-settings-notice-v2" role="status">
      {note}
    </div>
  ) : null;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const say = useCallText();
  const { user, mfaRequired } = useAuth();
  const phase = useCallStore((state) => state.phase);

  const busyPeer = useCallStore((state) => state.busyPeer);
  const closeBusy = () => useCallStore.setState({ busyPeer: null });
  const busyTitle = say("{name} is busy").replace(
    "{name}",
    () => busyPeer?.display_name?.trim() || say("Unavailable contact"),
  );

  useIncomingCall(user && !mfaRequired ? user.id : undefined);
  useCallLifecycle((note) => notifyCall(noteText(note, say)));
  useCallSounds(phase);

  return (
    <>
      {children}
      <CallNotice />
      {user && phase === "idle" && busyPeer && (
        <CallModalShell title={busyTitle} onClose={closeBusy}>
          <h2 className="text-2xl font-semibold">{busyTitle}</h2>
          <p>{say("Try again later.")}</p>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground"
            onClick={closeBusy}
          >
            {say("Close")}
          </button>
        </CallModalShell>
      )}
      {phase === "incoming-ringing" && <IncomingCallModal />}
      {phase === "outgoing-ringing" && <OutgoingCallModal />}
      {phase === "answered" && <ActiveCallModal />}
    </>
  );
}
