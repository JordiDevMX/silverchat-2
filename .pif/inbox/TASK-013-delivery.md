# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Submission:** Round-3 corrected delivery honoring Guardian's audit of the second corrective delivery (`.pif/handoffs/TASK-013-guardian-audit-7edce3e.md`, disposition `CHANGES REQUIRED`: AUD-007 plus residual scope of AUD-003..AUD-005). Prior commits: `29d7146` (implementation), `90e095b` (round-1), `7edce3e` (round-2).
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorizations of 2026-11-16 (original, round-1, round-2, and round-3 plans — the round-3 plan explicitly chose the roadmap-L12 busy path over a recipient-busy pre-check).
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):** the round-3 correction commit containing this report (its SHA is reported to the Product Owner separately; it cannot be self-referenced). `3272a27` (pif-instructions pointer) remains outside TASK-013 scope.

**Claim status:** `REPORTED` (each claim classified; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Round-3 corrections per Guardian finding

### AUD-007 (blocking) — `text <> uuid` comparison in `start_call` — FIXED

- Root cause confirmed: the round-2 recipient check compared `string_to_array(direct_pair_key,'::')[…]` (text) against `auth.uid()` (uuid). PostgreSQL has no `text <> uuid` operator, so `start_call` would have raised `operator does not exist` at runtime for every direct call — the round-2 code never executed.
- Fix: the whole string-based resolution is **gone**. The busy-path design of this round no longer needs the callee identity at all (see AUD-004 below), and every remaining comparison in `start_call` is uuid-typed (`chat_members.user_id`, `calls.initiator_id`, `auth.uid()`). The migration header and the RPC comment record both the defect and the removed approach.
- Runtime proof (fresh direct call reaching insertion and returning an ID) remains gated on a migrated instance: **NOT RUN** (no local Postgres/Docker, `RISK-003`; remotes unauthorized). The suite below exercises `start_call` end-to-end through the CRITICAL path — AAL1/AAL2 probes, busy checks, room-name-bearing INSERT — so any residual type error would fail it; but until it executes, this is REPORTED-only, as Guardian requires.

### AUD-004 — INSERT grant reality + busy-path semantics — FIXED

- **Grant premise corrected.** Guardian is right and the round-2 delivery was wrong: `0002_rls_policies.sql:704-705` grants `INSERT(id,initiator_id,chat_id,type,livekit_room_name)` on `calls` (the statement is split across two lines; the round-2 verification missed it). Direct member INSERTs are therefore a permitted write path, and the round-2 suite's `permission denied` assertions were wrong. Consequences handled this round:
  - The one-active-call invariant rests on the two partial UNIQUE indexes for **every** permitted write path (they constrain client INSERTs the `calls_insert` policy permits — the migration's 2b comment already says as much, and the suite now proves it on the real boundary: same-chat duplicate INSERT → `uq_calls_active_chat`; second ringing call by the same initiator in another chat → `uq_calls_active_initiator`).
  - A forged-initiator INSERT — executed by a **distinct actor** (Bob, a chat member) naming Alice as initiator — now targets the real RLS `WITH CHECK (initiator_id = auth.uid())` failure (`row-level security policy`).
  - **Effective column privileges — a further gap found while verifying Guardian's "verify effective column privileges" requirement:** `decline_reason` and `ended_reason` are columns **added by this migration** and are absent from 0002's column-list UPDATE grant, so every client busy-reject, decline, conditionally-ended hangup and reconciliation write would have failed with `permission denied` even with correct RLS. The migration now re-states the grant with the full lifecycle column set: `GRANT UPDATE(status,answered_at,ended_at,duration_seconds,decline_reason,ended_reason) ON public.calls TO authenticated;` (2c). Effective privileges still need runtime confirmation on a migrated instance (NOT RUN).
- **Busy-path semantics (roadmap L12) — Product Owner decision, option A.** Guardian's residual point stands: the round-2 recipient-busy pre-check rejected the second call *before* the INSERT, so no `missed/busy` row was ever persisted — contradicting L12's logged busy entry. Per the authorized round-3 plan, the **recipient pre-check is removed**: a second call toward a busy callee is inserted and rings normally; the busy callee's client then **silently rejects it** (`busyRejectCall`, conditional on `ringing`) writing `status='missed', decline_reason='busy'` — the persisted call-log entry L12 requires; if the callee is offline, the stale-ring cron records it as missed. Trade-off accepted by the Product Owner: a transient second ringing row may coexist with the first active call (bounded by the callee's <3s online rejection or the ≤~80s cron sweep). The caller-side/existing "You are already in a call" checks are unchanged. The suite exercises the full path: Erin's `start_call` toward busy Bob **succeeds**, Bob's conditional busy write lands exactly 1 row, and the original a111 call is untouched.

### AUD-003 residual — round-3 points — FIXED

1. **Failed reconciliation is no longer swallowed.** `hangupActiveCall` now distinguishes the reconciliation read (winner row) and the follow-up write: a read failure logs the error and makes the action return `"error"` (UI can toast it) while still performing the guarded local reset — the client is never stuck and the failure is never reported as success. A reconciliation write that itself returns `error`/`lost-race` propagates the same way.
2. **Initial connection is no longer a peer disconnect.** The answered-phase effect now distinguishes the **initial join window (10s)** from the **established-peer disconnect window (3s)**: the short disconnect grace only arms after a remote participant has been observed (`ParticipantConnected` or a non-empty room); a peer still minting a token or connecting gets the full join window and is never labeled `peer_hangup` during it. `ParticipantConnected` still clears any armed timer.
3. **Late callbacks verify room/call ownership.** `useLiveKitRoom`'s `RoomEvent.Disconnected` handler and its `connect().catch` path now check `useCallStore.getState().call?.id === callId` before invoking the global `hangupActiveCall` — a stale room's late callback after unmount or after a new call claimed the store no longer tears down the new call. (Ownership is checked by call id rather than room reference because a failed connect never stored its room; the call id is the invariant both handlers hold.)
4. **Terminal-status reconciliation across clients** remains as delivered in round 2 (`reconcileRacingPatch` + guarded resets) and is exercised in the suite's race sections; live two-client behavior stays a human check (NOT RUN).

### AUD-005 residual — aligned to effective grants and policies — FIXED IN THE SUITE; EXECUTION STILL NOT RUN

- The contradictory outsider block is resolved: RLS genuinely **filters** for a non-member, so the suite asserts only the filtered-state pattern (`UPDATE … RETURNING` → 0 rows; `SELECT count(*)` of the hidden row → 0; unchanged state re-verified under a member identity). The `rejects … 'permission denied'` assertion — impossible to satisfy for the same statement — is removed.
- The three INSERT assertions now match the real privilege boundary (see AUD-004): index-based rejections on permitted paths, RLS rejection for the forged-initiator path with a **distinct actor (Bob) and forged initiator (Alice)**.
- Suite header documents each round's boundary reasoning so the audit trail is self-contained.
- Execution remains **NOT RUN** (environment block, unchanged); Guardian is asked to weigh the suite as REPORTED-only.

### AUD-001 and AUD-002 — unchanged

Static corrections stand; migration application and MFA runtime probes remain pending environment/authorization.

---

## Changes made (this round)

| Path | Change |
|---|---|
| `supabase/migrations/20261116120000_calls_enhancements.sql` | Removed the `text <> uuid` recipient resolution entirely (AUD-007); removed the recipient-busy pre-check in favor of the L12 busy path (PO option A, documented in-file); added the lifecycle UPDATE columns grant (2c). |
| `supabase/tests/calls.sql` | Round-3 rewrite of the boundary sections: real INSERT grants exploited (`uq_calls_active_chat` / `uq_calls_active_initiator` rejections), forged-initiator via distinct actor under RLS, contradictory outsider assertion removed, busy-path L12 flow added (ring succeeds → callee's silent missed/busy write → original call untouched). |
| `src/features/calls/lib/callActions.ts` | Reconciliation read/write errors propagate (`"error"`) with guarded local reset; errors never reported as success. |
| `src/features/calls/hooks/useActiveCall.ts` | Initial-join grace (10s) separated from established-peer disconnect grace (3s). |
| `src/features/calls/hooks/useLiveKitRoom.ts` | Late `Disconnected` and `connect().catch` callbacks verify the stored call id before ending anything. |
| `.pif/inbox/TASK-013-delivery.md` | This round-3 report. |

## Checks and evidence (all run locally this session)

| Check | Command | Result | Classification |
|---|---|---|---|
| Type check | `pnpm typecheck` | **PASS** — exit 0 | `VERIFIED` |
| Unit tests | `pnpm test` | **PASS** — 114/114 | `VERIFIED` |
| Lint (touched files) | `npx biome check <touched files>` | **PASS** — exit 0 | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 | `VERIFIED` |
| Edge Function type check | `deno check supabase/functions/livekit-token/index.ts` | **PASS** — exit 0 (`deno.lock` byproduct deleted again) | `VERIFIED` |
| Migration + test file LF | byte scan | **PASS** — 0 CR bytes each | `VERIFIED` |
| Migration application proof incl. AUD-007 runtime | disposable-env apply + fresh direct call | **NOT RUN** — no local Postgres/psql, no Docker (`RISK-003`), remotes unauthorized | `NOT_RUN` |
| `supabase/tests/calls.sql` execution (AUD-004/005) | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Effective column privileges probe | `\dP`/`has_column_privilege` on migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Genuinely concurrent DB sessions (AUD-003/004) | two racing psql sessions | **NOT RUN** — same limits | `NOT_RUN` |
| Live two-browser flows (slow join, both race orders, failed reconciliation, late callback after a new call), MFA runtime probe, outsider token denial, distinct-client realtime | human/live | **NOT RUN** | `NOT_RUN` |

## Known type-lag (unchanged)

`src/types/database.ts` predates the migration; casts remain in the two documented sites (`lib/startCallRpc.ts`, `lib/callActions.ts`) until `pnpm db:types` runs against a migrated environment.

## Risks / open gates

1. Gate status: `G0 PASS`. `G1 REPORTED` (PO authorizations of 2026-11-16, incl. the round-3 option-A decision). `G2`: AUD-007 fixed in code, AUD-003/004/005 residuals addressed; **re-verdict pending on Guardian**; SQL-execution evidence still missing (environment-bound). `G3` partially BLOCKED. `G4 NOT RUN`. `G5 BLOCKED`. `G6 NOT RUN`.
2. `RISK-006`: CLI still linked to Production; any Staging write must first run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` after re-linking. No remote operation was performed.
3. LiveKit secrets remain unset; the token endpoint fails until authorized `supabase secrets set`.
4. Branch sits behind the recorded `origin/main` by three commits; reconciliation happens only when integration is authorized.
5. Pre-existing untouched: `RISK-002`..`RISK-005`.

## Human verification needed (round-3 deltas in bold)

1. Incoming call modal, ringtone, 15s countdown; ring stops at 15s locally.
2. Abandoned-call cleanup: ≤~80s worst-case cron sweep; frontend's own 15s timeout drives the UI.
3. Accept/cancel races in both orders; no zombie modal either side.
4. Decline → "Call declined"; no-answer → "No answer" at 15s.
5. **Busy second call: never renders on the busy callee's client; caller sees the call end (no-answer note); a `missed/busy` row persists in the log. With the callee offline, the cron records it missed (≤~80s).**
6. **Slow-join path: answering on device A while device B hesitates >3s must not label B as peer_hangup; the 10s join window governs.**
7. Permission denial → status note, no `calls` row, no LiveKit join.
8. Video/voice controls; calls log behaviors (unchanged from earlier rounds).
9. After authorized Staging apply: run `supabase/tests/calls.sql`; `pnpm db:types`; effective-privileges probe; AAL1-with-factor MFA probes on `start_call` and the token function; two-client realtime observation.

## Pending operations (separate PO authorization each)

Staging migration apply (db-guard first) · LiveKit secrets · `functions deploy livekit-token` · branch push + PR.

## Requested Guardian action

Re-audit the round-3 corrections (new diff on `feature/calls`, this delivery revision), create `AUD-…` findings for anything unresolved, and propose canonical updates for `TASK-013` and the gate table. Engineer has not modified canonical `.pif/` records.
