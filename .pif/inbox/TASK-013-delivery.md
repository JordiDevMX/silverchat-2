# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Submission:** Round-5 corrected delivery honoring Guardian's audit of the round-4 delivery (`.pif/handoffs/TASK-013-guardian-audit-0e7bab2.md`, disposition `CHANGES REQUIRED`). Prior commits: `29d7146` (implementation), `90e095b` (round-1), `7edce3e` (round-2), `f26c6b0` (round-3), `0e7bab2` (round-4).
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorizations of 2026-11-16 (original through round-4; round 5 is a defect closure within the same authorized scope — no new privileges, no remote operations, no product-behavior change).
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):** the round-5 correction commit containing this report (its SHA is reported to the Product Owner separately; it cannot be self-referenced).

**Claim status:** `REPORTED` (each claim classified; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Round-5 corrections per Guardian finding

### AUD-003 residual (open, high) — media lifecycle of a disposed attempt — FIXED

- Guardian's probe is confirmed by code reading: the round-4 guards covered the token rejection, the `disconnected` event and the final store write, but the three media-event handlers in `src/features/calls/lib/roomConnection.ts` wrote store state without a `disposed` check, and the camera publish was requested before the post-publish re-check.
- Code review found the defect is slightly wider than the probe showed: a late `trackSubscribed` from the disposed room could overwrite the replacement's remote tracks AND `attach()` the stale audio track to the DOM (not only the `trackUnsubscribed` nulling the probe reproduced), and `activeSpeakersChanged` could keep driving the replacement's remote waveform.
- Fix:
  - `trackSubscribed` and `activeSpeakersChanged` return early when `disposed`;
  - `trackUnsubscribed` guards only the two store writes — the track's own `detach()` still runs unconditionally, preserving cleanup of the old room's DOM element (Guardian's explicit requirement);
  - a `disposed` re-check now sits between the microphone and camera publishes, so a disposed attempt never issues the obsolete camera enable (Guardian's second observation) and unwinds with a single teardown.
- Regression: two new cases in `tests/calls-room-connection.test.ts` replicate the probe's interleavings with injected fakes: (1) old attempt parked at its mic publish → disposed → replacement connects and receives a video subscription → the old room's late `trackUnsubscribed`/`activeSpeakersChanged` must not touch the replacement's state while still detaching its own track; (2) a disposed attempt parked between publishes never requests the camera, self-disconnects once, never writes the store. The suite is now 6 cases (was 4).

### AUD-005 fixture labeling — FIXED

- Guardian is right: case (c) claimed "Bob inserts a row claiming Alice" while the active claims were still Alice's; the Bob switch was in case (d). The identity switch now precedes case (c) (and the duplicate in (d) is removed), so the forged-initiator scenario is described truthfully. The comment notes that after the REVOKE the denial is the privilege boundary either way — the RLS WITH CHECK that historically guarded this scenario is unreachable for clients now. No assertion changes.

### AUD-004 / AUD-001 / AUD-002 / AUD-007 — unchanged

Guardian's round-5 note on the PostgreSQL 15 revocation semantics (table-level `REVOKE` also removes the corresponding column grants) matches the intended boundary. Execution on a migrated instance and the effective-privileges probe remain **NOT RUN** (environment-bound). AUD-006 remains closed.

---

## Changes made (this round)

| Path | Change |
|---|---|
| `src/features/calls/lib/roomConnection.ts` | Disposed guards in the three media-event handlers (with unconditional `detach()` of the old room's own track); disposed re-check between the mic and camera publishes. |
| `tests/calls-room-connection.test.ts` | Two new regression cases mirroring Guardian's probe; fake room extended with a mic gate and mic/camera publish counters. |
| `supabase/tests/calls.sql` | Case (c) identity switch moved before the forged-initiator INSERT (duplicate removed from (d)); round-5 header note. |
| `.pif/inbox/TASK-013-delivery.md` | This round-5 report. |

## Checks and evidence (all run locally this session)

| Check | Command | Result | Classification |
|---|---|---|---|
| Unit tests | `pnpm test` | **PASS** — 120/120 (118 prior + 2 new regression cases) | `VERIFIED` |
| Focused regression | `npx tsx --test tests/calls-room-connection.test.ts` | **PASS** — 6/6 | `VERIFIED` |
| Type check | `pnpm typecheck` | **PASS** — exit 0 | `VERIFIED` |
| Lint (touched files) | `npx biome check <touched>` | **PASS** — exit 0 | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 | `VERIFIED` |
| LF endings | byte scan `supabase/tests/calls.sql` | **PASS** — 0 CR bytes | `VERIFIED` |
| Migration application proof | disposable-env apply + fresh direct call | **NOT RUN** — no local Postgres/psql, no Docker (`RISK-003`), remotes unauthorized | `NOT_RUN` |
| `supabase/tests/calls.sql` execution | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Effective privileges probe (REVOKE/`has_column_privilege`) | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Real StrictMode double-mount probe | browser/dev server | **NOT RUN** — covered by the extracted-function regression instead | `NOT_RUN` |
| Genuinely concurrent DB sessions, live MFA, outsider token denial, two-browser flows | human/live | **NOT RUN** | `NOT_RUN` |

No Deno changes this round; the Edge Function is untouched.

## Known type-lag (unchanged)

`src/types/database.ts` predates the migration; casts remain in the two documented sites (`lib/startCallRpc.ts`, `lib/callActions.ts`) until `pnpm db:types` runs against a migrated environment.

## Risks / open gates

1. Gate status: `G0 PASS`. `G1 REPORTED` (PO authorizations of 2026-11-16). `G2`: all round-5 findings addressed in code; **re-verdict pending on Guardian**; SQL-execution evidence still missing (environment-bound). `G3` partially BLOCKED. `G4 NOT RUN`. `G5 BLOCKED`. `G6 NOT RUN`.
2. `RISK-006`: CLI still linked to Production; any Staging write must first run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` after re-linking. No remote operation was performed.
3. LiveKit secrets remain unset; the token endpoint fails until authorized `supabase secrets set`.
4. Branch sits behind the recorded `origin/main` by three commits; reconciliation happens only when integration is authorized.
5. Pre-existing untouched: `RISK-002`..`RISK-005`.

## Human verification needed (round-5 deltas in bold)

1. Incoming call modal, ringtone, 15s countdown; ring stops at 15s locally.
2. Abandoned-call cleanup: ≤~80s worst-case cron sweep; frontend's own 15s timeout drives the UI.
3. Accept/cancel races in both orders; no zombie modal either side.
4. Decline → "Call declined"; no-answer → "No answer" at 15s.
5. Busy second call: never renders on the busy callee's client; caller sees the call end; a `missed/busy` row persists (≤~80s when offline).
6. Slow-join path: answering on device A while device B hesitates >3s must not label B as peer_hangup (10s join window). If the peer never connects within 10s, the call ends with note "Call failed. Try again." (not "Call ended").
7. Permission denial → status note, no `calls` row, no LiveKit join.
8. A failed cancel/decline/hangup write now shows "Call failed. Try again." instead of closing silently.
9. **StrictMode/dev remount while the other side's video is already subscribed: the remote video must stay visible (the disposed room's late events must not blank it).**
10. After authorized Staging apply: run `supabase/tests/calls.sql`; `pnpm db:types`; effective-privileges probe (now includes confirming the INSERT revoke); AAL1-with-factor MFA probes; two-client realtime observation.

## Pending operations (separate PO authorization each)

Staging migration apply (db-guard first) · LiveKit secrets · `functions deploy livekit-token` · branch push + PR.

## Requested Guardian action

Re-audit the round-5 corrections (new diff on `feature/calls`, this delivery revision), create `AUD-…` findings for anything unresolved, and propose canonical updates for `TASK-013` and the gate table. Engineer has not modified canonical `.pif/` records.
