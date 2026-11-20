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

/** A verdict with less window left than this never renders: the modal would
 * flash for a frame and vanish, which reads as a glitch, not a call. */
export const MIN_RING_MS = 1_000;

/** One row of answerable_incoming_calls(): the server's verdict on a call.
 * The function only returns rows that are still ringing, still inside the
 * ring window and not originated by me, so the client never compares
 * started_at with its own clock. */
export interface IncomingCallVerdict {
  id: string;
  chat_id: string;
  initiator_id: string | null;
  type: CallType;
  started_at: string;
  livekit_room_name: string;
  /** Remaining ring window measured on the server's now(). */
  expires_in_ms: number;
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
  | { kind: "ignore"; reason: "expired" }
  | { kind: "busy-reject" }
  | { kind: "ring"; expiresInMs: number };
