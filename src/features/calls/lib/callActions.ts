// Call lifecycle actions (9). Each action owns its DB write via a single
// update helper; the generated Update type predates migration
// 20261116120000_calls_enhancements.sql, so reason columns are cast here in
// one place until `pnpm db:types` runs against a migrated environment.
import { supabase } from "@/lib/supabase";
import { canFinishLocally, hangupPatch } from "../lib/callState";
import { resetCallStore, useCallStore } from "../stores/callStore";
import type { CallPatch } from "../types";

export type CallActionOutcome = "ok" | "permission" | "error";

/** One cast site for stale generated types (decline_reason / ended_reason /
 * "ended" status). RLS still governs the row: only chat members pass. */
async function updateCall(id: string, patch: CallPatch): Promise<boolean> {
  const { error } = await supabase
    .from("calls")
    .update(patch as never)
    .eq("id", id);
  return !error;
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
  const written = await updateCall(state.call.id, { status: "answered", answered_at: answeredAt });
  if (!written) return "error";
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
  const written = await updateCall(state.call.id, {
    status: reason,
    decline_reason: reason,
    ended_at: new Date().toISOString(),
  });
  resetCallStore();
  return written ? "ok" : "error";
}

/** Local user leaves the call (9.4). LiveKit disconnects first (no orphaned
 * media), then the phase-dependent patch is written; when a concurrent peer
 * action already resolved the call, the patch is null and nothing is written. */
export async function hangupActiveCall(
  reason: "hangup" | "peer_hangup" | "network_lost" = "hangup",
): Promise<CallActionOutcome> {
  const state = useCallStore.getState();
  if (!state.call || !canFinishLocally(state.phase)) {
    resetCallStore();
    return "ok";
  }
  const patch = hangupPatch(state.phase, state.answeredAt, reason);
  useCallStore.setState({ phase: "ending" });
  try {
    await state.room?.disconnect();
  } catch {
    // Already disconnected (peer race or network drop); the DB write still applies.
  }
  const written = patch ? await updateCall(state.call.id, patch) : true;
  resetCallStore();
  return written ? "ok" : "error";
}

/** Busy auto-reject (L12): silent DB write, no modal is ever rendered. */
export async function busyRejectCall(callId: string): Promise<void> {
  const { error } = await supabase
    .from("calls")
    .update({
      status: "missed",
      decline_reason: "busy",
      ended_at: new Date().toISOString(),
    } as never)
    .eq("id", callId);
  if (error) console.error("[calls] busy-reject failed", error);
}
