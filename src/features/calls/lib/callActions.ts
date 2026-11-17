// Call lifecycle actions (9). Each action owns its DB write via a single
// update helper; the generated Update type predates migration
// 20261116120000_calls_enhancements.sql, so reason columns are cast here in
// one place until `pnpm db:types` runs against a migrated environment.
import { supabase } from "@/lib/supabase";
import {
  canFinishLocally,
  hangupPatch,
  preconditionFor,
  reconcileRacingPatch,
} from "../lib/callState";
import { resetCallStore, resetCallStoreIfCurrent, useCallStore } from "../stores/callStore";
import type { CallPatch, CallStatus } from "../types";

export type CallActionOutcome = "ok" | "permission" | "error";

/** Result of a call-row write (AUD-003). "lost-race" means a concurrent
 * client (peer, other device, cron) already resolved the row: the loser
 * unwinds locally without surfacing an error, because the authoritative
 * outcome belongs to whichever writer met the precondition. */
export type CallWriteResult = "ok" | "lost-race" | "error";

/** One cast site for stale generated types (decline_reason / ended_reason /
 * "ended" status). RLS still governs the row: only chat members pass. The
 * UPDATE is conditional on the expected previous status and reports how
 * many rows actually changed (AUD-003). */
async function updateCall(id: string, patch: CallPatch): Promise<CallWriteResult> {
  const { data, error } = await supabase
    .from("calls")
    .update(patch as never)
    .eq("id", id)
    .eq("status", preconditionFor(patch) as never)
    .select("id");
  if (error) return "error";
  return data && data.length > 0 ? "ok" : "lost-race";
}

export function isPermissionError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  return name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError";
}

export async function requestCallPermissions(
  video: boolean,
): Promise<"ok" | "permission" | "error"> {
  try {
    // L6: permissions BEFORE connecting to LiveKit, so denied access never
    // reaches token minting or the calls table.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    // Tracks are released immediately; LiveKit re-acquires its own.
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    return "ok";
  } catch (error) {
    return isPermissionError(error) ? "permission" : "error";
  }
}

/** Incoming side accepts (9.1): permissions → status=answered → answered phase. */
export async function acceptIncomingCall(): Promise<CallActionOutcome> {
  const state = useCallStore.getState();
  if (state.phase !== "incoming-ringing" || !state.call) return "ok";
  const granted = await requestCallPermissions(state.call.type === "video");
  if (granted !== "ok") return granted;

  const answeredAt = new Date().toISOString();
  const callId = state.call.id;
  const outcome = await updateCall(callId, { status: "answered", answered_at: answeredAt });
  if (outcome === "error") return "error";
  if (outcome === "lost-race") {
    // AUD-003: the caller canceled (or the cron swept the row) first. The
    // realtime subscription / local reset closes the loop: end gracefully,
    // never surface an error for a call that is already resolved.
    resetCallStoreIfCurrent(callId);
    return "ok";
  }
  useCallStore.setState({
    phase: "answered",
    answeredAt,
    isCameraEnabled: state.call.type === "video",
  });
  return "ok";
}

/** Incoming side declines (8): reason is "declined" (user) or "missed" (15s timeout). */
export async function declineIncomingCall(
  reason: "declined" | "missed" = "declined",
): Promise<CallActionOutcome> {
  const state = useCallStore.getState();
  if (state.phase !== "incoming-ringing" || !state.call) return "ok";
  useCallStore.setState({ phase: "ending" });
  const callId = state.call.id;
  const outcome = await updateCall(callId, {
    status: reason,
    decline_reason: reason,
    ended_at: new Date().toISOString(),
  });
  // A "missed" timeout that lost to a peer accept stays passive (Guardian
  // round 2): the call lives on the OTHER device that answered; this client
  // just stops ringing. A "declined" that lost is already terminal.
  resetCallStoreIfCurrent(callId);
  return outcome === "error" ? "error" : "ok";
}

/** Local user leaves the call (9.4). LiveKit disconnects first (no orphaned
 * media), then the phase-dependent patch is written; when a concurrent peer
 * action already resolved the call, the patch is null and nothing is written. */
export async function hangupActiveCall(
  reason: "hangup" | "peer_hangup" | "network_lost" | "timeout" = "hangup",
): Promise<CallActionOutcome> {
  const state = useCallStore.getState();
  if (!state.call || !canFinishLocally(state.phase)) {
    resetCallStore();
    return "ok";
  }
  const callId = state.call.id;
  const patch = hangupPatch(state.phase, state.answeredAt, reason);
  useCallStore.setState({ phase: "ending" });
  try {
    await state.room?.disconnect();
  } catch {
    // Already disconnected (peer race or network drop); the DB write still applies.
  }
  const result = patch ? await updateCall(callId, patch) : ("ok" as const);
  let outcome = result;
  if (result === "lost-race") {
    // AUD-003 (Guardian round 2): a concurrent winner beat this ending write.
    // Honor the actual winning state instead of blindly resetting to idle:
    // when the winner answered, this client's hangup intent still must close
    // the call (ended/hangup, duration from the winner's answered_at) —
    // otherwise the callee would wait alone for a peer the cleanup cron never
    // sweeps (it only targets ringing rows). Any terminal winner needs no
    // write. Both races converge, in either order.
    const { data: winner, error: winnerError } = await supabase
      .from("calls")
      .select("status, answered_at")
      .eq("id", callId)
      .maybeSingle();
    if (winnerError) {
      // AUD-003 (round 3): a failed reconciliation is never swallowed — the
      // action reports error so the UI can toast it, while the local reset
      // below still runs so the client is never stuck on a dead call.
      console.error("[calls] lost-race reconciliation read failed", winnerError);
      outcome = "error";
    } else {
      const winnerStatus = (winner?.status ?? null) as CallStatus | null;
      const reconciliation = winnerStatus
        ? reconcileRacingPatch(winnerStatus, winner?.answered_at ?? null)
        : null;
      if (reconciliation) outcome = await updateCall(callId, reconciliation);
    }
  }
  resetCallStoreIfCurrent(callId);
  return outcome === "error" ? "error" : "ok";
}

/** Busy auto-reject (L12): silent conditional DB write, no modal is ever
 * rendered. The status filter keeps a concurrent winner's terminal status
 * intact (AUD-003). */
export async function busyRejectCall(callId: string): Promise<void> {
  const { error } = await supabase
    .from("calls")
    .update({
      status: "missed",
      decline_reason: "busy",
      ended_at: new Date().toISOString(),
    } as never)
    .eq("id", callId)
    .eq("status", "ringing");
  if (error) console.error("[calls] busy-reject failed", error);
}
