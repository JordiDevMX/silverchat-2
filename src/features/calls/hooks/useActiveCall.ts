// Call lifecycle (9.3/9.5 + L1 timeout). Owns the UPDATE subscription for the
// active call row, the 15s ring timeout, and peer-disconnect detection.

import { RoomEvent } from "livekit-client";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { declineIncomingCall, hangupActiveCall } from "../lib/callActions";
import {
  type CallEndedNote,
  mapRemoteEnd,
  ringRemainingMs,
  ringTimeoutOutcome,
} from "../lib/callState";
import { resetCallStore, useCallStore } from "../stores/callStore";

export function useCallLifecycle(onEnded: (note: CallEndedNote) => void) {
  const notify = useRef(onEnded);
  notify.current = onEnded;
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const room = useCallStore((state) => state.room);
  const ringDeadline = useCallStore((state) => state.ringDeadline);
  const callId = call?.id ?? null;

  // Remote transitions of the active call row: the caller learns the callee
  // answered (or refused), and the callee learns the caller canceled before
  // answering (the simultaneous-cancel race resolves locally either way).
  useEffect(() => {
    if ((phase !== "outgoing-ringing" && phase !== "incoming-ringing") || !callId) return;
    const isOutgoing = phase === "outgoing-ringing";
    let disposed = false;
    const applyStatus = (updated: {
      status: string;
      decline_reason: string | null;
      answered_at: string | null;
    }) => {
      const current = useCallStore.getState();
      if (disposed || current.call?.id !== callId || current.phase !== phase) return;
      if (updated.status === "answered") {
        if (isOutgoing)
          useCallStore.setState({ phase: "answered", answeredAt: updated.answered_at });
      } else if (updated.status !== "ringing") {
        const note = mapRemoteEnd(updated.status, updated.decline_reason);
        resetCallStore();
        if (isOutgoing && note === "busy") useCallStore.setState({ busyPeer: current.other });
        else if (isOutgoing) notify.current(note);
      }
    };
    const channel = supabase
      .channel(`call:${callId}`)
      .on<{ status: string; decline_reason: string | null; answered_at: string | null }>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        ({ new: updated }) => applyStatus(updated),
      )
      .subscribe((status) => {
        // A quick busy reply may land between start_call and this subscription.
        if (status === "SUBSCRIBED" && isOutgoing) {
          void supabase
            .from("calls")
            .select("status, decline_reason, answered_at")
            .eq("id", callId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) applyStatus(data);
            });
        }
      });
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [phase, callId]);

  // 15s ring timeout (L1) measured on the monotonic clock. Incoming: mark
  // missed. Outgoing: silent reset — the cron marks the row missed within 20s.
  useEffect(() => {
    if (phase !== "incoming-ringing" && phase !== "outgoing-ringing") return;
    const remaining = ringRemainingMs(ringDeadline);
    const timer = setTimeout(() => {
      const outcome = ringTimeoutOutcome(useCallStore.getState().phase);
      if (outcome.kind === "incoming-timeout") void declineIncomingCall("missed");
      if (outcome.kind === "outgoing-timeout") {
        notify.current("no-answer");
        resetCallStore();
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [phase, ringDeadline]);

  // Peer disconnect (9.5): a 3s grace window allows LiveKit reconnection; if
  // the room stays empty, end the call as peer_hangup. The INITIAL join gets
  // a longer window (AUD-003 round 3): a peer that is still minting a token
  // or connecting is not a disconnect. The two windows are also honest about
  // what happened (round 4): an unseen peer's timeout is NOT a peer_hangup —
  // the row records ended_reason='timeout' and the user sees the failure
  // note; only the departure of a peer we actually observed is peer_hangup.
  useEffect(() => {
    if (phase !== "answered" || !room) return;
    const JOIN_GRACE_MS = 10_000;
    const PEER_DISCONNECT_GRACE_MS = 3_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A peer that was already in the room when the phase flipped (fast join
    // racing the render) counts as established from the start.
    let sawRemote = room.remoteParticipants.size > 0;

    const endIfStillAlone = (graceMs: number, reason: "peer_hangup" | "timeout") => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const current = useCallStore.getState();
        if (current.phase !== "answered" || current.room !== room) return;
        if (current.room && current.room.remoteParticipants.size === 0) {
          void hangupActiveCall(reason).then((outcome) => {
            if (outcome === "ok") {
              notify.current(reason === "timeout" ? "failed" : "peer-hangup");
            }
          });
        }
      }, graceMs);
    };
    const onPeerConnected = () => {
      sawRemote = true;
      clearTimeout(timer);
    };
    const onPeerDisconnected = () => {
      // Only an established peer's exit gets the short reconnect window;
      // the longer join grace below covers the pre-first-join phase.
      if (sawRemote || room.remoteParticipants.size > 0) {
        endIfStillAlone(PEER_DISCONNECT_GRACE_MS, "peer_hangup");
      }
    };

    room.on(RoomEvent.ParticipantDisconnected, onPeerDisconnected);
    room.on(RoomEvent.ParticipantConnected, onPeerConnected);
    room.on(RoomEvent.Disconnected, onPeerDisconnected);
    // Arm the join window immediately (AUD-003 round 2): a winner that
    // answered while this client's ring write lost never joins the room, so
    // no participant event would otherwise fire and the answered client
    // would wait alone forever. If the peer does join, the timer is cleared.
    if (!sawRemote) endIfStillAlone(JOIN_GRACE_MS, "timeout");
    return () => {
      clearTimeout(timer);
      room.off(RoomEvent.ParticipantDisconnected, onPeerDisconnected);
      room.off(RoomEvent.ParticipantConnected, onPeerConnected);
      room.off(RoomEvent.Disconnected, onPeerDisconnected);
    };
  }, [phase, room]);
}
