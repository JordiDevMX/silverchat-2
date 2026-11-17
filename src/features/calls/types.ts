// Prompt #12 — shared call types. DB column types for decline_reason /
// ended_reason / "ended" status are added by migration
// 20261116120000_calls_enhancements.sql; the generated database.ts lags
// behind until `pnpm db:types` runs against a migrated environment.
export type CallType = "voice" | "video";

export type CallPhase = "idle" | "incoming-ringing" | "outgoing-ringing" | "answered" | "ending";

/** Client view of the status column, including the newly added "ended". */
export type CallStatus =
  | "ringing"
  | "answered"
  | "ended"
  | "missed"
  | "declined"
  | "canceled"
  | "failed";

/** Immutable ring window from the locked decisions (L1): the frontend gives
 * up at 15s; the cleanup_stale_calls cron sweeps leftovers after 20s. */
export const RING_TIMEOUT_MS = 15_000;

/** LiveKit event payload subset used by the incoming-call pipeline. */
export interface IncomingCallRow {
  id: string;
  chat_id: string;
  initiator_id: string | null;
  status: string;
  type: CallType;
  started_at: string;
  livekit_room_name: string;
}

/** Peer profile subset shared by the store, hooks and log. */
export interface CallParticipant {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
}

/** Column patch applied to the calls table. Mirrors the generated Update
 * shape for the lifecycle columns; kept explicit so the state helpers do not
 * depend on the generated file. */
export interface CallPatch {
  status?: CallStatus;
  decline_reason?: string;
  ended_reason?: string;
  ended_at?: string;
  answered_at?: string;
  duration_seconds?: number;
}

export type IncomingDecision =
  | { kind: "ignore"; reason: "self" | "stale" | "status" }
  | { kind: "busy-reject" }
  | { kind: "ring" };
