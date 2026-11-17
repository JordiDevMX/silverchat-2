# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Submission:** Corrected delivery honoring Guardian's `CHANGES REQUIRED` audit (`.pif/handoffs/TASK-013-guardian-audit.md`, disposition `CHANGES REQUIRED`, findings AUD-001..AUD-005).
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorization of 2026-11-16 (timestamped migration after `20261114000000`; 15s frontend ring stop with 20s DB sweep; Guardian's test scenarios included) and the Product Owner's explicit correction authorization of the same date ("Revisa la auditoría de Guardian… Corrige los problemas confirmados…").
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):**
- `29d7146eaefea838036e94058a894a0881a6156a` — `feat(calls): voice & video calls via LiveKit (Prompt #12)` (original implementation)
- The correction commit containing the AUD-001..AUD-005 fixes and this updated report (its SHA is reported to the Product Owner separately; it cannot be self-referenced)
- `3272a27` (pif-instructions pointer update) is outside TASK-013's implementation scope, as recorded in the first submission.

**Claim status:** `REPORTED` (each claim classified; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Corrections per Guardian finding (this round)

### AUD-001 — migration index used `now()` — FIXED

- `idx_calls_recent` (partial index whose predicate contained `now() - interval '90 days'`) is **removed**: PostgreSQL requires immutable index predicates, so the statement would have failed.
- `idx_calls_chat_started` is also removed: it exactly duplicated 0001's `idx_calls_chat (chat_id, started_at DESC)`.
- **No replacement index was added.** The verification table/log paths used by this feature (per-chat and per-initiator listing, ringing rows) are already served by 0001's `idx_calls_chat`, `idx_calls_initiator` and the partial `idx_calls_ringing`. Complexity was reduced rather than substituted.
- **Migration application is still NOT RUN** (Guardian asked for a demonstrated application in an authorized disposable/local environment): no local Postgres/psql and no Docker exist on this machine (`RISK-003`), and no remote environment is authorized. The file is byte-level LF (0 CR bytes) but only statically reviewed; the corrected delivery cannot claim a successful application.

### AUD-002 — MFA boundary on the privileged entry points — FIXED

- `start_call` (SECURITY DEFINER, bypasses RLS) now re-checks the project's existing MFA policy as its first statement: `IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF;` — the same function and error contract the 0004 RPC guards use. `auth_mfa_satisfied()` permits AAL2 sessions and users with **no verified factor enrolled**, and denies AAL1 sessions with an enrolled, verified factor.
- `supabase/functions/livekit-token` now performs the equivalent check **with the caller's own JWT** (`supabase.rpc("auth_mfa_satisfied")` against the user-scoped client) *before* any service-role read, returning `403 {"error":"mfa required"}` on failure. The function is already typed in `src/types/database.ts` (generated `auth_mfa_satisfied` RPC), so no cast was needed.
- Note for re-verification: the table RLS path was already MFA-covered — 0004's `DO` block applied the `mfa_assurance_required` RESTRICTIVE policy to every public table existing at that time **including `calls`**. The finding was therefore about the two definer/service-role bypasses, both now closed. Runtime verification with an AAL1 session holding a verified factor on a migrated instance remains a human/live check (`NOT RUN`).

### AUD-003 — concurrent call transitions could overwrite each other — FIXED

- Every lifecycle write is now a **conditional UPDATE**: `updateCall` filters on `.eq("status", preconditionFor(patch))` and returns the number of rows actually changed.
- `preconditionFor` (pure, in `lib/callState.ts`): any pre-connected termination (`answered`/`declined`/`canceled`/`missed`) only applies while the row is still `ringing`; `ended` only applies to an `answered` row.
- A zero-row result is a distinct `lost-race` outcome: the losing client unwinds locally (reset, no error surface) because the authoritative resolution belongs to the writer that met the precondition. Applied to accept (vs caller cancel), decline, hangup/cancel, timeout and busy-reject.
- Busy-reject is likewise conditional on `ringing`, so a stale busy write can no longer clobber a terminal status.
- The realtime UPDATE handler no longer resets the incoming side on its own `answered` echo (the accept flow owns that transition), and keeps notifying+resetting the outgoing side when the callee's terminal status arrives.
- Unit test added: `every lifecycle patch carries the row-status precondition it may beat` (109 tests total, was 108).
- **Genuinely concurrent DB sessions / two live clients remain NOT RUN** (no migrated instance); the corrected integration suite exercises both race orders sequentially with conditional effects (below).

### AUD-004 — concurrent `start_call` could bypass busy checks — FIXED

- Two partial UNIQUE indexes are now the hard invariant:
  - `uq_calls_active_chat ON calls(chat_id) WHERE status IN ('ringing','answered')` — one active call per chat;
  - `uq_calls_active_initiator ON calls(initiator_id) WHERE status IN ('ringing','answered')` — one active call per initiator across all chats.
  These also constrain direct client INSERTs that the `calls_insert` RLS policy permits.
- `start_call` additionally takes `pg_advisory_xact_lock` on every member of the target chat (keys via `hashtextextended(user_id::text, 0)`, acquired in `user_id` order so overlapping member sets cannot deadlock). Any two in-flight starts sharing a member serialize, so check-then-insert is atomic between them, including caller-busy and callee-busy across different chats.
- The INSERT catches `unique_violation` and re-raises `'A call is already in progress in this chat'`, mapping the backstop to the client's existing busy-note matching (`isBusyError`).
- The integration suite verifies each index deterministically without needing true concurrency (below). Genuinely concurrent sessions remain NOT RUN.

### AUD-005 — evidence did not establish the requested scenarios — FIXED IN THE SUITE; EXECUTION STILL NOT RUN

`supabase/tests/calls.sql` was rewritten so every assertion matches the real security boundary:

- **Conditional races with winner/loser counts** (instead of sequential unconditional writes): callee accept wins (1 row) → caller's late conditional cancel touches **0 rows** and the `answered` status survives; fresh call → callee conditional decline wins (1 row) → caller's conditional cancel touches **0 rows** and the winner's terminal `declined` status stays intact. A stale busy write against a non-ringing row also proves 0-row behavior.
- **Outsider UPDATE**: RLS *filters* rather than errors — the suite now asserts `UPDATE ... RETURNING` yields **0 rows**, the target row is **unchanged**, and no answered status was fabricated. The old "expect permission denied" assertion is gone.
- **Forged initiator INSERT**: performed by **Bob (a chat member)** naming **Alice** as initiator, so the failure isolates the `initiator_id = auth.uid()` WITH CHECK (expected `row-level security policy`). The old assertion — Bob inserting with his *own* id, which the policy actually permits — is gone.
- **MFA (AUD-002)**: AAL1 without enrolled factors → `start_call` succeeds; AAL1 after inserting a verified `totp` factor for Alice → `MFA required`; AAL2 with the factor → succeeds. Fixture shape matches the other suites (`auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)`).
- **AUD-004 index detection**: while the a111 call is ringing, Alice's legitimate RLS-permitted direct INSERT of a second active call in the same chat must fail with `uq_calls_active*`.
- **Cross-chat exclusivity**: new fixtures a333 (bob+carol, Bob is callee of the active a111 call → `'You are already in a call'`) and a444 (alice+carol, Alice is initiator of the active a111 call → same error), proving both directions across chats.
- Kept and re-validated: realtime publication membership, callee read path, `ended_reason`/duration writes, non-member `start_call` rejection, direct-only rule.
- **Execution status: NOT RUN** — no migrated local instance exists (no Postgres, no Docker; `RISK-003`) and no remote environment is authorized. The suite is ready to run; the delivery cannot claim a pass.
- No outsider token-denial or distinct-client realtime test exists in any runnable form on this machine; both are recorded as pending live checks.

### Timing note (cron) — checklist corrected

The cron runs **once per minute** and selects `ringing` rows **older than 20 seconds** — an age threshold, not a latency bound. Human-checklist expectation corrected to: *"the abandoned row becomes `missed` on the next cron run (every minute, rows older than 20s): up to ~80s worst-case after the ring started; the frontend never waits for the cron — its own 15s timeout drives the UI."* The migration's cron comment now states this explicitly.

### `deno.lock` — resolved

Deleted. It was an untracked byproduct of running `deno check`; the repository has no Deno policy for lockfiles, and the Edge Function's imports are URL-pinned by version in source.

---

## Changes made (this correction round)

| Path | Change |
|---|---|
| `supabase/migrations/20261116120000_calls_enhancements.sql` | Removed the `now()` partial index and the duplicate index (AUD-001); added the two partial UNIQUE indexes and per-member advisory locking + `unique_violation` mapping in `start_call` (AUD-004); added the `auth_mfa_satisfied()` gate in `start_call` (AUD-002); corrected cron comment with the latency semantics. |
| `supabase/functions/livekit-token/index.ts` | Caller-JWT MFA check via `auth_mfa_satisfied` before service-role reads (AUD-002). |
| `src/features/calls/lib/callState.ts` | New pure `preconditionFor(patch)` (AUD-003). |
| `src/features/calls/lib/callActions.ts` | `updateCall` conditional + row-count semantics (`ok` / `lost-race` / `error`); all four write paths updated; `busyRejectCall` conditional (AUD-003). |
| `src/features/calls/hooks/useActiveCall.ts` | Realtime handler ignores the incoming side's own `answered` echo (AUD-003 follow-up). |
| `tests/calls-state.test.ts` | Precondition-matrix test added (AUD-003). |
| `supabase/tests/calls.sql` | Fully rewritten per AUD-005 (see above). |
| `.pif/inbox/TASK-013-delivery.md` | This corrected report. |
| `deno.lock` (untracked) | Deleted. |

The original implementation scope (feature module, page, route, provider, i18n, sounds, dependency additions) is unchanged from commit `29d7146…` and its first-submission change table.

## Checks and evidence (this round, all run locally this session)

| Check | Command | Result | Classification |
|---|---|---|---|
| Type check | `pnpm typecheck` | **PASS** — exit 0 | `VERIFIED` |
| Unit tests | `pnpm test` | **PASS** — 109/109 (was 108; +1 precondition test) | `VERIFIED` |
| Lint (touched) | `npx biome check src/features/calls tests/calls-state.test.ts` | **PASS** — exit 0 | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 | `VERIFIED` |
| Edge Function type check | `deno check supabase/functions/livekit-token/index.ts` | **PASS** — exit 0 | `VERIFIED` |
| Migration + test file LF | byte scan | **PASS** — 0 CR bytes each | `VERIFIED` |
| Migration application proof (AUD-001) | apply to disposable env | **NOT RUN** — no local Postgres (`psql` absent), no Docker (`RISK-003`), remotes unauthorized | `NOT_RUN` |
| `supabase/tests/calls.sql` execution (AUD-005) | pgtap-style run against migrated instance | **NOT RUN** — same environment limits | `NOT_RUN` |
| Genuinely concurrent DB sessions (AUD-003/004) | two psql sessions racing | **NOT RUN** — same limits; suite covers both race orders sequentially | `NOT_RUN` |
| Live two-browser flows, MFA runtime probe, outsider token denial, distinct-client realtime | human/live | **NOT RUN** | `NOT_RUN` |

Audit still actionable for `G2`: the SQL itself has never executed. Guardian should weigh the corrected suite as REPORTED-only until a migrated instance runs it.

## Known type-lag (unchanged)

`src/types/database.ts` predates the migration (`'ended'`, reason columns, `start_call` RPC); regeneration needs `pnpm db:types` against a migrated environment. Casts remain in the two documented sites.

## Risks / open gates

1. Gate status: `G0 PASS` (isolated `feature/calls`; no push/merge). `G1 REPORTED` (PO authorizations of 2026-11-16; not independently available to this Engineer). `G2`: prior FAIL causes addressed in code; **re-verdict pending on Guardian**, with SQL execution evidence still missing. `G3 BLOCKED` partially (reportable checks pass; DB/live suites NOT RUN). `G4 NOT RUN`. `G5 BLOCKED`. `G6 NOT RUN`.
2. `RISK-006`: CLI still linked to Production; any Staging write must first run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` after re-linking. No remote operation was performed.
3. LiveKit secrets remain unset; token endpoint fails until authorized `supabase secrets set`.
4. Branch sits behind the recorded `origin/main` by three commits (per Guardian's observation); reconciliation happens only when integration is authorized.
5. Pre-existing untouched: `RISK-002`..`RISK-005`.

## Human verification needed (corrected)

Do not mark PASS without confirmation (two browsers/devices, two accounts):

1. Incoming call modal, ringtone, 15s countdown; ring stops at 15s locally.
2. Abandoned-call cleanup: leave a call ringing; the row becomes `missed` on the **next cron minute-tick with started_at older than 20s** — observed latency up to ~80s worst-case, never driving UI state.
3. Accept on one side while the caller cancels — in both orders; exactly one terminal DB status; no zombie modal either side.
4. Decline → "Call declined" note; no-answer → "No answer" at 15s.
5. Busy second call never renders; row ends `missed`/`busy`.
6. Permission denial → status note, no `calls` row, no LiveKit join.
7. Video: PiP drag, cover/contain toggle, camera/mic/speaker toggles; voice: Mic/Speaker/Hangup only.
8. Calls log: grouping, arrows, missed styling, duration, callback.
9. After authorized Staging apply: run `supabase/tests/calls.sql`; `pnpm db:types` regeneration; AAL1-with-factor MFA probe against `start_call` and the token function; two-client realtime observation.

## Pending operations (separate PO authorization each)

Staging migration apply (db-guard first) · LiveKit secrets · `functions deploy livekit-token` · branch push + PR · decision on `deno.lock` policy (now moot — file deleted).

## Requested Guardian action

Re-audit the corrections (new implementation diff on `feature/calls`, new delivery revision), create `AUD-…` findings for anything unresolved, and propose canonical updates for `TASK-013` and the gate table. Engineer has not modified canonical `.pif/` records.
