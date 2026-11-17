// Prompt #12 call state machine tests. Pure logic only (lib/callState,
// lib/callFormatter) — no Supabase, no React. Covers Guardian's requested
// scenarios: busy/permission gating decisions, incoming notification
// handling (self/stale/busy), and simultaneous-cancel idempotency.
import assert from "node:assert/strict";
import test from "node:test";
import { formatDuration, groupCallsByDay } from "../src/features/calls/lib/callFormatter.ts";
import {
  busyRejectPatch,
  type CallLogEntry,
  callDirection,
  canFinishLocally,
  decideIncomingCall,
  hangupPatch,
  mapRemoteEnd,
  noteText,
  preconditionFor,
  ringTimeoutOutcome,
} from "../src/features/calls/lib/callState.ts";

const ME = "user-me";
const PEER = "user-peer";
const NOW = new Date("2026-11-16T12:00:00Z").getTime();

const ringing = (overrides: Partial<Parameters<typeof decideIncomingCall>[0]> = {}) => ({
  id: "call-1",
  chat_id: "chat-1",
  initiator_id: PEER,
  status: "ringing",
  type: "voice" as const,
  started_at: new Date(NOW - 2_000).toISOString(),
  livekit_room_name: "call_test",
  ...overrides,
});

// ─── Incoming notification decisions (roadmap 7.2, L12) ────────────────────

test("an incoming ringing call from a peer rings when idle", () => {
  assert.deepEqual(decideIncomingCall(ringing(), ME, "idle", NOW), { kind: "ring" });
});

test("my own outgoing call INSERT never rings my client", () => {
  assert.deepEqual(decideIncomingCall(ringing({ initiator_id: ME }), ME, "idle", NOW), {
    kind: "ignore",
    reason: "self",
  });
});

test("events older than the 15s ring window are ignored as stale", () => {
  const stale = ringing({ started_at: new Date(NOW - 16_000).toISOString() });
  assert.deepEqual(decideIncomingCall(stale, ME, "idle", NOW), { kind: "ignore", reason: "stale" });
});

test("exactly at the 15s boundary the event is still fresh", () => {
  const boundary = ringing({ started_at: new Date(NOW - 15_000).toISOString() });
  assert.deepEqual(decideIncomingCall(boundary, ME, "idle", NOW), { kind: "ring" });
});

test("non-ringing rows (answered/missed/canceled) never notify", () => {
  assert.deepEqual(decideIncomingCall(ringing({ status: "answered" }), ME, "idle", NOW), {
    kind: "ignore",
    reason: "status",
  });
  assert.deepEqual(decideIncomingCall(ringing({ status: "missed" }), ME, "idle", NOW), {
    kind: "ignore",
    reason: "status",
  });
});

test("a call received while busy is auto-rejected, never shown (L12)", () => {
  for (const phase of ["incoming-ringing", "outgoing-ringing", "answered", "ending"] as const) {
    assert.deepEqual(decideIncomingCall(ringing(), ME, phase, NOW), { kind: "busy-reject" });
  }
});

test("busy auto-reject writes missed/busy with an ended_at", () => {
  const patch = busyRejectPatch(new Date(NOW));
  assert.equal(patch.status, "missed");
  assert.equal(patch.decline_reason, "busy");
  assert.equal(patch.ended_at, new Date(NOW).toISOString());
});

// ─── Simultaneous cancellation / double hangup idempotency ─────────────────

test("hangup patches per phase: cancel, decline, ended+duration", () => {
  const now = new Date(NOW);
  const canceled = hangupPatch("outgoing-ringing", null, "hangup", now);
  assert.equal(canceled?.status, "canceled");
  assert.equal(canceled.decline_reason, "canceled");

  const declined = hangupPatch("incoming-ringing", null, "hangup", now);
  assert.equal(declined?.status, "declined");
  assert.equal(declined.decline_reason, "declined");

  const ended = hangupPatch("answered", new Date(NOW - 62_000).toISOString(), "hangup", now);
  assert.equal(ended?.status, "ended");
  assert.equal(ended.ended_reason, "hangup");
  assert.equal(ended.duration_seconds, 62);
});

test("the second writer of a simultaneous cancel is a no-op (null patch)", () => {
  // Both peers hang up at once: whoever transitions to `ending` first owns the
  // row write; the other side observes phase ending/idle and writes nothing.
  assert.equal(hangupPatch("ending", null, "hangup", new Date(NOW)), null);
  assert.equal(hangupPatch("idle", null, "hangup", new Date(NOW)), null);
});

test("canFinishLocally gates every local write to owned phases", () => {
  assert.equal(canFinishLocally("incoming-ringing"), true);
  assert.equal(canFinishLocally("outgoing-ringing"), true);
  assert.equal(canFinishLocally("answered"), true);
  assert.equal(canFinishLocally("ending"), false);
  assert.equal(canFinishLocally("idle"), false);
});

// ─── Conditional-write preconditions (Guardian AUD-003) ────────────────────

test("every lifecycle patch carries the row-status precondition it may beat", () => {
  // Accept, decline, cancel, timeout and busy only apply while ringing.
  assert.equal(preconditionFor({ status: "answered" }), "ringing");
  assert.equal(preconditionFor({ status: "declined", decline_reason: "declined" }), "ringing");
  assert.equal(preconditionFor({ status: "canceled", decline_reason: "canceled" }), "ringing");
  assert.equal(preconditionFor({ status: "missed", decline_reason: "missed" }), "ringing");
  assert.equal(preconditionFor(busyRejectPatch()), "ringing");
  // Leaving a connected call only applies to an answered row.
  assert.equal(preconditionFor({ status: "ended", ended_reason: "hangup" }), "answered");
});

// ─── Remote end notifications (outgoing side) ──────────────────────────────

test("remote end statuses map to the right user-facing note", () => {
  assert.equal(mapRemoteEnd("declined", "declined"), "declined");
  assert.equal(mapRemoteEnd("missed", "missed"), "no-answer");
  assert.equal(mapRemoteEnd("missed", "busy"), "no-answer");
  assert.equal(mapRemoteEnd("canceled", "canceled"), "canceled");
  assert.equal(mapRemoteEnd("failed", null), "failed");
});

test("every end note resolves to a non-empty status string", () => {
  const say = (text: string) => text;
  for (const note of ["declined", "no-answer", "canceled", "failed", "peer-hangup"] as const) {
    assert.ok(noteText(note, say).length > 0);
  }
});

// ─── Ring timeout (L1: 15s frontend, cron sweeps after 20s) ────────────────

test("incoming ring timeout marks the call missed", () => {
  const outcome = ringTimeoutOutcome("incoming-ringing", new Date(NOW));
  assert.equal(outcome.kind, "incoming-timeout");
  if (outcome.kind === "incoming-timeout") {
    assert.equal(outcome.patch.status, "missed");
    assert.equal(outcome.patch.decline_reason, "missed");
  }
});

test("outgoing ring timeout resets locally without a DB write", () => {
  assert.deepEqual(ringTimeoutOutcome("outgoing-ringing"), { kind: "outgoing-timeout" });
  assert.deepEqual(ringTimeoutOutcome("answered"), { kind: "none" });
  assert.deepEqual(ringTimeoutOutcome("idle"), { kind: "none" });
});

// ─── Call log direction matrix (6.3) ───────────────────────────────────────

const entry = (overrides: Partial<CallLogEntry>): CallLogEntry => ({
  id: "call-1",
  chatId: "chat-1",
  type: "voice",
  status: "ended",
  startedAt: new Date(NOW).toISOString(),
  answeredAt: null,
  endedAt: null,
  durationSeconds: null,
  declineReason: null,
  endedReason: null,
  isOutgoing: false,
  other: { id: PEER, display_name: "Peer" },
  ...overrides,
});

test("call log direction covers every outgoing/incoming outcome", () => {
  assert.equal(callDirection(entry({ isOutgoing: true, status: "ended" })), "outgoing-answered");
  assert.equal(callDirection(entry({ isOutgoing: true, status: "canceled" })), "outgoing-canceled");
  assert.equal(callDirection(entry({ isOutgoing: true, status: "missed" })), "outgoing-no-answer");
  assert.equal(callDirection(entry({ isOutgoing: false, status: "ended" })), "incoming-answered");
  assert.equal(
    callDirection(entry({ isOutgoing: false, status: "declined" })),
    "incoming-declined",
  );
  assert.equal(callDirection(entry({ isOutgoing: false, status: "missed" })), "incoming-missed");
});

// ─── Formatters (6.2/6.3) ──────────────────────────────────────────────────

test("durations format as mm:ss, or h:mm:ss from one hour", () => {
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(59), "00:59");
  assert.equal(formatDuration(60), "01:00");
  assert.equal(formatDuration(754), "12:34");
  assert.equal(formatDuration(3661), "1:01:01");
});

test("calls group by day with Today/Yesterday labels first", () => {
  const labels = { today: "Hoy", yesterday: "Ayer" };
  const calls = [
    { id: "a", startedAt: new Date(NOW - 3_600_000).toISOString() }, // today
    { id: "b", startedAt: new Date(NOW - 26 * 3_600_000).toISOString() }, // yesterday
    { id: "c", startedAt: new Date(NOW - 2 * 3_600_000).toISOString() }, // today
    { id: "d", startedAt: new Date(NOW - 50 * 86_400_000).toISOString() }, // older
  ];
  const groups = groupCallsByDay(calls, labels, "es", new Date(NOW));
  assert.equal(groups.length, 3);
  assert.equal(groups[0]?.label, "Hoy");
  assert.deepEqual(
    groups[0]?.calls.map((call) => call.id),
    ["a", "c"],
  );
  assert.equal(groups[1]?.label, "Ayer");
  assert.ok(groups[2]?.label && groups[2].label !== "Hoy" && groups[2].label !== "Ayer");
});
