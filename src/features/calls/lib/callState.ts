// Pure call state machine (Prompt #12 L7). No React, no Supabase: every rule
// here is unit-tested in tests/calls-state.test.ts.
import {
  type CallParticipant,
  type CallPatch,
  type CallPhase,
  type CallStatus,
  type CallType,
  type IncomingCallRow,
  type IncomingDecision,
  RING_TIMEOUT_MS,
} from "../types.ts";

/** Resolve a realtime INSERT on the calls table into a local action.
 * Locked decisions: self-calls are ignored (7.2), stale events are ignored
 * (7.2), and a call received while busy is auto-rejected as missed/busy
 * (L12) without ever rendering a modal. */
export function decideIncomingCall(
  call: IncomingCallRow,
  userId: string,
  currentPhase: CallPhase,
  now: number = Date.now(),
): IncomingDecision {
  if (call.initiator_id === userId) return { kind: "ignore", reason: "self" };
  if (call.status !== "ringing") return { kind: "ignore", reason: "status" };
  if (now - new Date(call.started_at).getTime() > RING_TIMEOUT_MS) {
    return { kind: "ignore", reason: "stale" };
  }
  if (currentPhase !== "idle") return { kind: "busy-reject" };
  return { kind: "ring" };
}

/** Busy auto-reject (L12): immediately missed, never shown. */
export function busyRejectPatch(now: Date = new Date()): CallPatch {
  return { status: "missed", decline_reason: "busy", ended_at: now.toISOString() };
}

/** Conditional-write precondition (AUD-003). Every lifecycle write is a
 * conditional UPDATE filtered on the row status the action expects, so
 * concurrent clients (peer, other device, cron) cannot overwrite each
 * other: a zero-row update means the row already moved on and the loser
 * must unwind locally instead of forcing its own transition. Any
 * pre-connected termination only applies to a still-ringing row; "ended"
 * only applies to an answered row. */
export function preconditionFor(patch: CallPatch): CallStatus {
  return patch.status === "ended" ? "answered" : "ringing";
}

/** Lost-race reconciliation (Guardian round 2, AUD-003). A user whose
 * "end this call" intent lost a conditional race against a concurrent
 * terminal write must honor the actual winning state: if the winner
 * answered, the hangup-intent client closes the call with an honest
 * ended/hangup patch (duration measured from the winner's answered_at);
 * any other winning status is already terminal and needs no write. */
export function reconcileRacingPatch(
  winnerStatus: CallStatus,
  answeredAt: string | null,
  now: Date = new Date(),
): CallPatch | null {
  if (winnerStatus !== "answered") return null;
  const duration = answeredAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(answeredAt).getTime()) / 1000))
    : 0;
  return {
    status: "ended",
    ended_reason: "hangup",
    ended_at: now.toISOString(),
    duration_seconds: duration,
  };
}

/** The phases in which this client still owns a mutable call row. When the
 * phase is idle or ending, a concurrent hangup/decline (including the
 * simultaneous-cancel race) already resolved the call and no patch must be
 * written — the second writer stays a no-op. */
export function canFinishLocally(phase: CallPhase): boolean {
  return phase === "incoming-ringing" || phase === "outgoing-ringing" || phase === "answered";
}

/** DB patch for the local user leaving the call (9.4). Returns null when
 * there is nothing left to write. Room disconnect happens before this patch
 * is applied so no orphaned media stream outlives the row update. */
export function hangupPatch(
  phase: CallPhase,
  answeredAt: string | null,
  reason: "hangup" | "peer_hangup" | "network_lost" | "timeout" = "hangup",
  now: Date = new Date(),
): CallPatch | null {
  switch (phase) {
    case "outgoing-ringing":
      // I hung up before the peer answered.
      return { status: "canceled", decline_reason: "canceled", ended_at: now.toISOString() };
    case "incoming-ringing":
      // Declining before answering.
      return { status: "declined", decline_reason: "declined", ended_at: now.toISOString() };
    case "answered": {
      const duration = answeredAt
        ? Math.max(0, Math.floor((now.getTime() - new Date(answeredAt).getTime()) / 1000))
        : 0;
      return {
        status: "ended",
        ended_reason: reason,
        ended_at: now.toISOString(),
        duration_seconds: duration,
      };
    }
    default:
      return null;
  }
}

export type RingTimeoutOutcome =
  | { kind: "incoming-timeout"; patch: CallPatch }
  | { kind: "outgoing-timeout" }
  | { kind: "none" };

/** 15s ring timeout (L1). Incoming: mark missed. Outgoing: silently stop
 * ringing locally; the cron marks the DB row missed within 20s. */
export function ringTimeoutOutcome(phase: CallPhase, now: Date = new Date()): RingTimeoutOutcome {
  if (phase === "incoming-ringing") {
    return {
      kind: "incoming-timeout",
      patch: { status: "missed", decline_reason: "missed", ended_at: now.toISOString() },
    };
  }
  if (phase === "outgoing-ringing") return { kind: "outgoing-timeout" };
  return { kind: "none" };
}

export type CallEndedNote = "declined" | "no-answer" | "canceled" | "failed" | "peer-hangup";

/** Local status note for a remotely-ended call (CallProvider renders it via
 * the store note; kept pure so tests cover every notification path). */
export function noteText(note: CallEndedNote, say: (text: string) => string): string {
  switch (note) {
    case "declined":
      return say("Call declined");
    case "no-answer":
      return say("No answer");
    case "canceled":
      return say("Call canceled");
    case "peer-hangup":
      return say("Call ended");
    case "failed":
      return say("Call failed. Try again.");
  }
}

/** Map a remote UPDATE on my outgoing call to the local "call ended" note. */
export function mapRemoteEnd(status: string, declineReason: string | null): CallEndedNote {
  if (status === "declined") return "declined";
  if (status === "missed" || declineReason === "busy") return "no-answer";
  if (status === "canceled") return "canceled";
  return "failed";
}

export type CallDirection =
  | "outgoing-answered"
  | "incoming-answered"
  | "incoming-missed"
  | "incoming-declined"
  | "outgoing-canceled"
  | "outgoing-no-answer";

/** Log entry shaped by useCalls (pure view so tests cover the direction
 * matrix without importing Supabase-aware modules). */
export interface CallLogEntry {
  id: string;
  chatId: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  declineReason: string | null;
  endedReason: string | null;
  isOutgoing: boolean;
  other: CallParticipant;
}

/** Log entry direction/state (6.3): which arrow to draw and how to label it. */
export function callDirection(call: { isOutgoing: boolean; status: CallStatus }): CallDirection {
  if (call.isOutgoing) {
    if (call.status === "answered" || call.status === "ended") return "outgoing-answered";
    if (call.status === "canceled") return "outgoing-canceled";
    return "outgoing-no-answer";
  }
  if (call.status === "answered" || call.status === "ended") return "incoming-answered";
  if (call.status === "declined") return "incoming-declined";
  return "incoming-missed";
}
