# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Submission:** Round-2 corrected delivery honoring Guardian's re-audit (`.pif/handoffs/TASK-013-guardian-reaudit.md`, disposition `CHANGES REQUIRED`: new finding AUD-006 plus residual scope of AUD-001..AUD-005). The round-1 corrected delivery (commit `90e095bc75d3a00e13a4d71201c6e586bdb3dec3`) already carried the round-1 fixes; this report covers this round's corrections.
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorizations of 2026-11-16 (original plan, round-1 correction plan, and round-2 correction plan).
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):**
- `29d7146eaefea838036e94058a894a0881a6156a` — `feat(calls)` (original implementation)
- `90e095bc75d3a00e13a4d71201c6e586bdb3dec3` — round-1 corrections (AUD-001..AUD-005)
- The round-2 correction commit containing this report (its SHA is reported to the Product Owner separately; it cannot be self-referenced)
- `3272a27` (pif-instructions pointer update) remains outside TASK-013's implementation scope.

**Claim status:** `REPORTED` (each claim classified; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Round-2 corrections per Guardian finding

### AUD-006 (blocking) — RPC invoked without its receiver — FIXED

- Root cause: `useStartCall.ts` assigned `supabase.rpc` to a standalone const and invoked it detached; the installed SDK's builder reads `this.rest`, so every outgoing call threw `TypeError: Cannot read properties of undefined (reading 'rest')` **before any request was issued**.
- Fix: new single-purpose module `src/features/calls/lib/startCallRpc.ts` exporting `invokeStartCall(client, args)`. The one invocation site is `rpc.call(client, "start_call", args)` — the receiver stays bound, which is exactly the call form Guardian verified as working. `useStartCall.ts` now calls `invokeStartCall(supabase, …)` and no longer detaches the method.
- **Regression test** `tests/calls-start-rpc.test.ts`: uses the real installed `@supabase/supabase-js` client with a stubbed fetch and asserts the invocation issues an actual HTTP `POST` to `/rest/v1/rpc/start_call` carrying `p_chat_id` and `p_type`. A detached receiver (the audited bug) or a never-issued request both fail the test. Runs green in the normal Node suite (no network).

### AUD-003 residual — lost races left stale state — FIXED

- New pure helper `reconcileRacingPatch(winnerStatus, answeredAt, now)` in `lib/callState.ts`: when a client's conditional ending write loses (`lost-race`) against a winner that **answered**, the loser's end intent still closes the call with an honest `ended/hangup` patch and duration measured from the winner's `answered_at` (`hangupActiveCall` reads the winner row and applies it). That removes the audited residue where a canceled caller lost to an accept and left an `answered` row the ringing-cleanup cron never sweeps. Any **terminal** winning status (`canceled`/`declined`/`missed`/`ended`/`failed`) needs no write — the helper returns `null`.
- A lost `missed` timeout stays **passive** by design: the call lives on the other device that answered; the timing-out device only stops ringing (`declineIncomingCall`). Documented in code and in this report for Guardian review.
- Every post-await reset now goes through `resetCallStoreIfCurrent(callId)` (new, in `lib/callStore.ts`): the reset only fires when the given call is still the active one, so a lost race can no longer wipe out a call that arrived meanwhile. Applied to accept, decline, hangup and the reconciliation paths in `lib/callActions.ts`.
- `useActiveCall.ts`: the peer-disconnect 3-second grace timer is now armed **immediately on `answered`** (not only on a participant event). This covers the audited interleaving where the answered client's peer never joins the room (the winner of the accept race was a different device) — without an event, the previously event-armed timer never fired and the callee waited alone. If the peer does join, the timer is cleared.
- The incoming side's realtime handler continues to ignore its own `answered` echo (round-1 fix, retained).
- Unit tests added for `reconcileRacingPatch` (answered winner → ended/hangup with duration; future/clamped `answered_at`; missing `answered_at` → duration 0; every terminal status → `null`).

### AUD-004 residual — cross-chat role races — FIXED

- Correlated-race analysis confirmed Guardian's substantive gap: with locks only over the callers' chats, "Bob calls Carol while Alice rings Bob" could pass both sides' checks. `start_call` (SECURITY DEFINER, fully definer-visible) now extracts the recipient from the target chat's `direct_pair_key` and, **after the advisory locks and the existing chat/caller-busy checks**, rejects with `The recipient is already in a call` if the recipient has any active (`ringing`/`answered`) call in any chat. The check runs inside the same lock window as the other checks, so the earlier-verified serialization argument now covers this race as well.
- The rejection message deliberately embeds the substring `already in a call`, so the client's existing `isBusyError` mapping (busy toast) applies without a new match branch — verified by reading the current matcher.
- Direct-INSERT hardening assessment of the audit's premise: the finding suggested strengthening INSERT grants, but **no INSERT grant exists anywhere** — 0002's hardening loop runs `REVOKE ALL … GRANT SELECT` on `calls` (verified exhaustively across all migrations), so every client INSERT fails with `permission denied` and the RPC is the only write path. Unique indexes remain as the hard invariant against any future grant-based writer. No grant change was needed; the boundary is now asserted as-is in the suite.

### AUD-005 residual — evidence matched the real boundary — FIXED IN THE SUITE; EXECUTION STILL NOT RUN

`supabase/tests/calls.sql` fully rewritten to Guardian's corrections:

- **Profiles are NOT inserted explicitly.** Fixtures only insert `auth.users`; the `on_auth_user_created` trigger (`0001_initial_schema.sql:340-354`) creates `profiles` + `user_settings` (`user_e1111111`, etc.). The round-1 suite's explicit profile inserts would have collided with the trigger; that is removed.
- **Outsider invisibility** is asserted via filtered-state patterns: `UPDATE … RETURNING` yields **0 rows**, a plain `SELECT count(*)` for the row is **0**, the unchanged state is then verified **under a member identity** (where the scalar lookup returns the real value). No NULL-comparison assertions remain.
- **Direct client INSERTs** now assert the real boundary: `permission denied` (no INSERT grant exists after 0002's hardening REVOKE+SELECT loop), including the forged-initiator variant, with the explicit note that the RPC plus the two unique indexes is the sole supported write path.
- New **cancel-then-accept** race order added alongside accept-then-cancel and decline-then-cancel: cancel wins (1 row) → callee accept touches **0 rows** → terminal `canceled` intact.
- Lost-race reconciliation is exercised: after assert-then-cancel loses to accept, the winner row is re-read (`answered`, `answered_at` present — the values the client reconciles from) and the conditional `ended/hangup` write applies to the `answered` winner (1 row).
- New **recipient-busy** test (AUD-004 round 2): fixture users alice/bob/carol/erin, chats a111 (alice+bob), a222 (group), a333 (bob+carol), a444 (alice+carol), a666 (erin+bob). With the a111 call active: alice's second chat start → caller busy; bob's (as callee of a111) → callee busy across a333; erin calling busy-bob via a666 → `The recipient is already in a call`.
- Catalog assertions for **both** unique indexes (`uq_calls_active_chat`, `uq_calls_active_initiator`), MFA AAL1/AAL2 gates, realtime publication membership, callee read path, membership and direct-only rules retained.

### AUD-001 / AUD-002 — status unchanged (NOT RUN components remain)

Round-1 fixes stand (`now()`-free index set, MFA gates on both bypass paths). Migration **application proof** and **MFA runtime probes** remain NOT RUN (environment limits, unchanged).

### Timing note (cron) — corrected in round 1, unchanged

Cron runs **once per minute** selecting `ringing` rows **older than 20 seconds** → worst-case sweep latency **~80s**; the UI never waits for the cron (own 15s timeout).

### `deno.lock`

Deleted (untracked `deno check` byproduct; no repo Deno policy). It reappears only when `deno check` runs and is removed again before delivery; not part of the commit.

---

## Changes made (this round)

| Path | Change |
|---|---|
| `src/features/calls/lib/startCallRpc.ts` | **NEW** — receiver-safe `invokeStartCall` wrapper for the `start_call` RPC (AUD-006). |
| `src/features/calls/hooks/useStartCall.ts` | Uses `invokeStartCall`; detached `supabase.rpc` const removed (AUD-006). |
| `tests/calls-start-rpc.test.ts` | **NEW** — regression test proving the real POST to `/rest/v1/rpc/start_call` (AUD-006). |
| `src/features/calls/lib/callState.ts` | New pure `reconcileRacingPatch(winnerStatus, answeredAt, now)` (AUD-003). |
| `src/features/calls/lib/callActions.ts` | Hangup lost-race path reconciles from the winner row; all resets gated via `resetCallStoreIfCurrent` (AUD-003). |
| `src/features/calls/stores/callStore.ts` | New `resetCallStoreIfCurrent(callId)` (AUD-003). |
| `src/features/calls/hooks/useActiveCall.ts` | Peer-disconnect grace timer armed on entering `answered` (AUD-003 residual). |
| `supabase/migrations/20261116120000_calls_enhancements.sql` | `start_call` recipient-busy check after the advisory locks (AUD-004). |
| `supabase/tests/calls.sql` | Rewritten per AUD-005 round-2 corrections (see above). |
| `tests/calls-state.test.ts` | `reconcileRacingPatch` unit tests (4 new). |
| `.pif/inbox/TASK-013-delivery.md` | This round-2 report. |

## Checks and evidence (all run locally this session)

| Check | Command | Result | Classification |
|---|---|---|---|
| Type check | `pnpm typecheck` | **PASS** — exit 0 | `VERIFIED` |
| Unit tests | `pnpm test` | **PASS** — 114/114 (was 109: +1 start-call RPC regression, +4 `reconcileRacingPatch`) | `VERIFIED` |
| Lint (touched files) | `npx biome check <8 touched files>` | **PASS** — exit 0 | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 (chunk-size warning is pre-existing advice, not an error) | `VERIFIED` |
| Edge Function type check | `deno check supabase/functions/livekit-token/index.ts` | **PASS** — exit 0 | `VERIFIED` |
| Migration + test file LF | byte scan | **PASS** — 0 CR bytes each | `VERIFIED` |
| Migration application proof (AUD-001) | disposable-env apply | **NOT RUN** — no local Postgres/psql, no Docker (`RISK-003`), remotes unauthorized | `NOT_RUN` |
| `supabase/tests/calls.sql` execution (AUD-005) | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Genuinely concurrent DB sessions (AUD-003/004) | two racing psql sessions | **NOT RUN** — same limits; suite covers both race orders sequentially | `NOT_RUN` |
| Live two-browser flows, MFA runtime probe, outsider token denial, distinct-client realtime | human/live | **NOT RUN** | `NOT_RUN` |

Guardian note for `G2`: the round-2 suite has not executed either; Guardian should weigh it as REPORTED-only until a migrated instance runs it.

## Known type-lag (unchanged)

`src/types/database.ts` predates the migration (`'ended'` status, reason columns, `start_call` RPC); the RPC entry point is isolated behind `lib/startCallRpc.ts`'s cast until `pnpm db:types` runs against a migrated environment.

## Risks / open gates

1. Gate status: `G0 PASS`. `G1 REPORTED` (PO authorizations of 2026-11-16). `G2`: AUD-006 fixed with a regression test, AUD-003/004/005 residuals addressed; **re-verdict pending on Guardian**, SQL execution evidence still missing. `G3` partially BLOCKED (runnable checks pass; DB/live items NOT RUN). `G4 NOT RUN`. `G5 BLOCKED`. `G6 NOT RUN`.
2. `RISK-006`: CLI still linked to Production; any Staging write must first run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` after re-linking. No remote operation was performed.
3. LiveKit secrets remain unset; the token endpoint fails until authorized `supabase secrets set`.
4. Branch sits behind the recorded `origin/main` by three commits; reconciliation happens only when integration is authorized.
5. Pre-existing untouched: `RISK-002`..`RISK-005`.

## Human verification needed

Unchanged from the round-1 report (two browsers/devices, two accounts): incoming modal/ringtone/15s countdown, cron cleanup at ≤~80s worst-case, accept/cancel races in both orders with no zombie modal, decline/no-answer notes, busy rejection, permission denial, video/voice controls, calls log; plus the after-Staging items (`supabase/tests/calls.sql` run, `pnpm db:types`, AAL1-with-factor MFA probes, two-client realtime).

## Pending operations (separate PO authorization each)

Staging migration apply (db-guard first) · LiveKit secrets · `functions deploy livekit-token` · branch push + PR.

## Requested Guardian action

Re-audit the round-2 corrections (new diff on `feature/calls`, this delivery revision), create `AUD-…` findings for anything unresolved, and propose canonical updates for `TASK-013` and the gate table. Engineer has not modified canonical `.pif/` records.
