# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Submission:** Round-4 corrected delivery honoring Guardian's audit of the round-3 delivery (`.pif/handoffs/TASK-013-guardian-audit-f26c6b0.md`, disposition `CHANGES REQUIRED`). Prior commits: `29d7146` (implementation), `90e095b` (round-1), `7edce3e` (round-2), `f26c6b0` (round-3).
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorizations of 2026-11-16 (original through round-3; the round-4 plan — REVOKE INSERT option — was authorized by the Product Owner before implementation).
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):** the round-4 correction commit containing this report (its SHA is reported to the Product Owner separately; it cannot be self-referenced).

**Claim status:** `REPORTED` (each claim classified; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Round-4 corrections per Guardian finding

### AUD-003 (open, high) — disposed attempt with a shared call id — FIXED

- Guardian's premise is confirmed by code reading: the round-3 guards checked only `useCallStore.getState().call?.id === callId`, which cannot distinguish two attempts of the SAME call (StrictMode in `src/app/main.tsx` double-invokes the effect with one call id). The probing result (two token requests, one `network_lost` hangup while the second attempt was pending) is consistent with the code, and code review found the defect extends further than the probe showed: the intentional-unwind path `if (cancelled) { await room.disconnect(); return; }` itself fired `Disconnected` through the same insufficient guard, and a dispose landing between the post-connect check and the store write could overwrite the store's room with the disposed room.
- Fix: the connection lifecycle is extracted from the hook into `src/features/calls/lib/roomConnection.ts` (`startRoomConnection`) with injectable dependencies (`fetchToken`, `createRoom`, `onNetworkLost`) so the guards are unit-testable — the same shape as Guardian's offline probe. Every late callback (`disconnected` event, `connect().catch`) and every post-await step now checks the per-attempt `disposed` flag in addition to the call-id ownership check:
  - a disposed attempt's late token rejection never hangs up (identical ids included);
  - a disposed attempt's intentional cleanup disconnect emits no `network_lost`;
  - a disposed attempt unwinds with a single self-disconnect (a `roomTornDown` flag deduplicates the cleanup and unwind paths) and never claims the store's room — the store write is re-checked after every await;
  - the LIVE attempt's failure still reports network lost (verified in the regression).
- `useLiveKitRoom.ts` is now a thin wrapper supplying the real Room/token and mapping `onNetworkLost` → `hangupActiveCall("network_lost")`.
- Regression: `tests/calls-room-connection.test.ts` (4 cases, all passing): disposed rejection with identical ids, disposed connected-room teardown, disposed attempt never claims the store (parked mid-publish via an injected camera gate), live failure still reports. Runtime imports of `livekit-client` stay out of the extracted module (type-only), so the node test runner never loads the browser library.
- The probe-level "real StrictMode render" is still not reproduced in a DOM environment — the regression drives the extracted function directly, which is the same unit Guardian probed, with the guards now in place.

### AUD-003 (timing) — honest join-timeout labeling + cancel feedback — FIXED

- The two grace windows are now semantically distinct end-to-end: the 10s INITIAL join window ends the call with `ended_reason='timeout'` (a value the migration's column comment already declares; there is no CHECK constraint on the column) and notifies the existing "Call failed. Try again." note; the 3s established-peer disconnect window keeps `peer_hangup` / "Call ended". An unseen peer's timeout is no longer labeled as the peer leaving.
- The union `"hangup" | "peer_hangup" | "network_lost" | "timeout"` is extended in `hangupActiveCall` and `hangupPatch` (pure function, covered by `tests/calls-state.test.ts` typing via compilation).
- `OutgoingCallModal`'s discarded cancel outcome: both the cancel button and the shell `onClose` now consume the outcome and surface "Call failed. Try again." through the existing `notifyCall` pattern on `"error"` (the modal itself still closes via the guarded local reset, so the client is never stuck on a dead call). The same wiring was applied to the other lifecycle call sites that discarded outcomes: `IncomingCallModal` decline (button + `onClose`), `ActiveCallModal` hangup, `ActiveVideoCallModal` hangup. Accept already handled its outcomes.

### AUD-004 (open, high) — receiver-then-originator via direct INSERT — FIXED (REVOKE, PO-authorized)

- Guardian's conclusion is confirmed from the repository policies: the RPC's caller-busy check (as callee across all chats, and as initiator) is authoritative, but the 0002 column-list INSERT grant plus `calls_insert` RLS let a chat member bypass it — a user RECEIVING an active call could originate another in a different chat (neither the per-chat nor the per-initiator unique index conflicts). Code review adds a second bypass on the same path: the RPC's direct/self chat-type restriction.
- Fix (Product Owner authorized the REVOKE option before implementation): migration section 2c is now `REVOKE INSERT ON public.calls FROM authenticated;` — the application never inserts into `calls` directly (verified: all six `.from("calls")` sites are SELECT/UPDATE only; every creation goes through `start_call`), so `start_call` becomes the single supported creation path and its invariants (MFA, membership, chat activity, chat type, caller-busy as callee and initiator) hold on every path; the partial UNIQUE indexes remain the hard backstop.
- Suite: every direct INSERT variant now asserts `permission denied` against the real post-REVOKE boundary — including the new receiver-then-originator case (d): Bob, the CALLEE of the active a111 call, attempting a direct INSERT into his idle a333 chat. The RPC side of the same invariant is asserted separately (Bob `start_call('a333…')` → "already in a call"). The approved inbound missed/busy behavior (L12) was re-checked: it is unaffected (RPC start + client conditional UPDATE), and the suite's busy-path block still exercises the full flow.
- History note recorded in the suite header: round-2 asserted `permission denied` (correct boundary, wrong premise — the grant existed); round-3 exercised the grant; round-4 closes it deliberately with PO authorization.

### AUD-005 (partially corrected) — FIXED

- The index-name ambiguity is resolved by the REVOKE itself: the same-chat duplicate fixture no longer depends on which partial unique index fires, because the direct INSERT boundary is now uniformly `permission denied`. The three INSERT probes plus the receiver-then-originator probe all target one boundary.
- Execution of the SQL suite remains **NOT RUN** (environment-bound; unchanged).

### AUD-007 — unchanged

Executable SQL contains no string-based callee resolution (grep: only the two historical comment mentions); runtime closure still requires a migrated instance (**NOT RUN**).

### Delivery provenance — CORRECTED (Engineer error acknowledged)

- Guardian is right: the lifecycle column UPDATE grant pre-existed in the migration's section 5 since the original implementation; the round-3 delivery's claim of "a further gap found" was wrong, and the round-3 commit added a redundant duplicate grant (lines 75-76 alongside 218-219). This round removes the duplicate (section 5's statement and comment stand as the single source) and the round-3 delivery's provenance claim is hereby corrected: there was no new privilege gap in round 3 — the columns were already writable.

---

## Changes made (this round)

| Path | Change |
|---|---|
| `supabase/migrations/20261116120000_calls_enhancements.sql` | Round-4 header; section 2c converted from the duplicate UPDATE grant to `REVOKE INSERT` with rationale; 2b comment updated. |
| `supabase/tests/calls.sql` | Round-4 header (incl. provenance correction); INSERT boundary rewritten to the post-REVOKE `permission denied` boundary with the receiver-then-originator case (d). |
| `src/features/calls/lib/roomConnection.ts` | NEW: extracted connection lifecycle with per-attempt disposed guards and injectable deps. |
| `src/features/calls/hooks/useLiveKitRoom.ts` | Thin wrapper over `startRoomConnection`; supplies real Room/token, maps network loss to hangup. |
| `src/features/calls/hooks/useActiveCall.ts` | Join timeout → `timeout` reason + "Call failed" note; established disconnect unchanged. |
| `src/features/calls/lib/callState.ts` / `lib/callActions.ts` | `"timeout"` added to the hangup reason unions. |
| `src/features/calls/components/OutgoingCallModal.tsx`, `IncomingCallModal.tsx`, `ActiveCallModal.tsx`, `ActiveVideoCallModal.tsx` | Outcomes consumed; errors surfaced via the existing `notifyCall` note pattern. |
| `src/features/calls/stores/callStore.ts` | Import extension fix (`../types.ts`) so the store is importable from the node test runner (nodenext). |
| `tests/calls-room-connection.test.ts` | NEW: 4-case regression for the disposed-attempt guards. |
| `.pif/inbox/TASK-013-delivery.md` | This round-4 report. |
| (working tree only) | Touched files normalized to LF (they carried CRLF from the original checkout; `core.autocrlf=true` normalizes on commit — no repo content change beyond the intended edits). |

## Checks and evidence (all run locally this session)

| Check | Command | Result | Classification |
|---|---|---|---|
| Unit tests | `pnpm test` | **PASS** — 118/118 (114 prior + 4 new regression cases) | `VERIFIED` |
| Type check | `pnpm typecheck` | **PASS** — exit 0 (also verified exit 0 on clean HEAD via stash, isolating the one new import-extension fix) | `VERIFIED` |
| Lint (touched files) | `npx biome check <touched files>` | **PASS** — exit 0 | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 | `VERIFIED` |
| Edge Function type check | `deno check supabase/functions/livekit-token/index.ts` | **PASS** — exit 0 (`deno.lock` byproduct deleted) | `VERIFIED` |
| LF endings | byte scan migration + suite | **PASS** — 0 CR bytes each | `VERIFIED` |
| `string_to_array` residue | grep | **PASS** — only the two historical comment mentions | `VERIFIED` |
| Migration application proof | disposable-env apply + fresh direct call | **NOT RUN** — no local Postgres/psql, no Docker (`RISK-003`), remotes unauthorized | `NOT_RUN` |
| `supabase/tests/calls.sql` execution | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Effective privileges probe (REVOKE/`has_column_privilege`) | migrated instance | **NOT RUN** — same limits | `NOT_RUN` |
| Real StrictMode double-mount probe | browser/dev server | **NOT RUN** — covered by the extracted-function regression instead | `NOT_RUN` |
| Genuinely concurrent DB sessions, live MFA, outsider token denial, two-browser flows | human/live | **NOT RUN** | `NOT_RUN` |

## Known type-lag (unchanged)

`src/types/database.ts` predates the migration; casts remain in the two documented sites (`lib/startCallRpc.ts`, `lib/callActions.ts`) until `pnpm db:types` runs against a migrated environment.

## Risks / open gates

1. Gate status: `G0 PASS`. `G1 REPORTED` (PO authorizations of 2026-11-16, now including the round-4 REVOKE decision). `G2`: all round-4 findings addressed in code; **re-verdict pending on Guardian**; SQL-execution evidence still missing (environment-bound). `G3` partially BLOCKED. `G4 NOT RUN`. `G5 BLOCKED`. `G6 NOT RUN`.
2. `RISK-006`: CLI still linked to Production; any Staging write must first run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` after re-linking. No remote operation was performed.
3. LiveKit secrets remain unset; the token endpoint fails until authorized `supabase secrets set`.
4. Branch sits behind the recorded `origin/main` by three commits; reconciliation happens only when integration is authorized.
5. Pre-existing untouched: `RISK-002`..`RISK-005`.

## Human verification needed (round-4 deltas in bold)

1. Incoming call modal, ringtone, 15s countdown; ring stops at 15s locally.
2. Abandoned-call cleanup: ≤~80s worst-case cron sweep; frontend's own 15s timeout drives the UI.
3. Accept/cancel races in both orders; no zombie modal either side.
4. Decline → "Call declined"; no-answer → "No answer" at 15s.
5. Busy second call: never renders on the busy callee's client; caller sees the call end; a `missed/busy` row persists (≤~80s when offline).
6. Slow-join path: answering on device A while device B hesitates >3s must not label B as peer_hangup (10s join window). **If the peer never connects within 10s, the call ends with note "Call failed. Try again." (not "Call ended").**
7. Permission denial → status note, no `calls` row, no LiveKit join.
8. **A failed cancel/decline/hangup write now shows "Call failed. Try again." instead of closing silently.**
9. After authorized Staging apply: run `supabase/tests/calls.sql`; `pnpm db:types`; effective-privileges probe (now includes confirming the INSERT revoke); AAL1-with-factor MFA probes; two-client realtime observation.

## Pending operations (separate PO authorization each)

Staging migration apply (db-guard first) · LiveKit secrets · `functions deploy livekit-token` · branch push + PR.

## Requested Guardian action

Re-audit the round-4 corrections (new diff on `feature/calls`, this delivery revision), create `AUD-…` findings for anything unresolved, and propose canonical updates for `TASK-013` and the gate table. Engineer has not modified canonical `.pif/` records.
