// Call lifecycle (9.3/9.5 + L1 timeout). Owns the UPDATE subscription for the
// active call row, the 15s ring timeout, and peer-disconnect detection.

import { RoomEvent } from "livekit-client";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { declineIncomingCall, hangupActiveCall } from "../lib/callActions";
import { type CallEndedNote, mapRemoteEnd, ringTimeoutOutcome } from "../lib/callState";
import { resetCallStore, useCallStore } from "../stores/callStore";
import { RING_TIMEOUT_MS } from "../types";

export function useCallLifecycle(onEnded: (note: CallEndedNote) => void) {
  const notify = useRef(onEnded);
  notify.current = onEnded;
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const room = useCallStore((state) => state.room);
  const ringStartedAt = useCallStore((state) => state.ringStartedAt);
  const callId = call?.id ?? null;

  // Remote transitions of the active call row: the caller learns the callee
  // answered (or refused), and the callee learns the caller canceled before
  // answering (the simultaneous-cancel race resolves locally either way).
  useEffect(() => {
    if ((phase !== "outgoing-ringing" && phase !== "incoming-ringing") || !callId) return;
    const isOutgoing = phase === "outgoing-ringing";
    const channel = supabase
      .channel(`call:${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
        ({ new: updated }) => {
          const current = useCallStore.getState();
          if (current.call?.id !== callId) return;
          if (updated.status === "answered" && isOutgoing) {
            useCallStore.setState({
              phase: "answered",
              answeredAt: updated.answered_at ?? new Date().toISOString(),
            });
            return;
          }
          if (updated.status !== "ringing") {
            // The peer already resolved the row; nothing left to write.
            if (isOutgoing) notify.current(mapRemoteEnd(updated.status, updated.decline_reason));
            resetCallStore();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [phase, callId]);

  // 15s ring timeout (L1). Incoming: mark missed. Outgoing: silent reset —
  // the cron marks the row missed within 20s.
  useEffect(() => {
    if (phase !== "incoming-ringing" && phase !== "outgoing-ringing") return;
    const started = ringStartedAt ? new Date(ringStartedAt).getTime() : Date.now();
    const remaining = Math.max(0, started + RING_TIMEOUT_MS - Date.now());
    const timer = setTimeout(() => {
      const outcome = ringTimeoutOutcome(useCallStore.getState().phase);
      if (outcome.kind === "incoming-timeout") void declineIncomingCall("missed");
      if (outcome.kind === "outgoing-timeout") {
        notify.current("no-answer");
        resetCallStore();
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [phase, ringStartedAt]);

  // Peer disconnect (9.5): a 3s grace window allows LiveKit reconnection; if
  // the room stays empty, end the call as peer_hangup.
  useEffect(() => {
    if (phase !== "answered" || !room) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedulePeerHangup = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const current = useCallStore.getState();
        if (current.phase !== "answered" || current.room !== room) return;
        if (current.room && current.room.remoteParticipants.size === 0) {
          void hangupActiveCall("peer_hangup").then((outcome) => {
            if (outcome === "ok") notify.current("peer-hangup");
          });
        }
      }, 3_000);
    };
    const clearPeerHangup = () => clearTimeout(timer);
    room.on(RoomEvent.ParticipantDisconnected, schedulePeerHangup);
    room.on(RoomEvent.ParticipantConnected, clearPeerHangup);
    room.on(RoomEvent.Disconnected, schedulePeerHangup);
    return () => {
      clearTimeout(timer);
      room.off(RoomEvent.ParticipantDisconnected, schedulePeerHangup);
      room.off(RoomEvent.ParticipantConnected, clearPeerHangup);
      room.off(RoomEvent.Disconnected, schedulePeerHangup);
    };
  }, [phase, room]);
}
