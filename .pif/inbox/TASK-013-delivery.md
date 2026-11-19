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

---

## Round-6 addendum — CI, regenerated database types, PR #46 (2026-11-18)

Round 6 changes no product behavior. It closes the "no migrated instance available" gap by running the SQL suite in CI on a disposable local Supabase stack, regenerates `src/types/database.ts` from the complete schema, and records the integration state so the next agent resumes from here instead of repeating round 5.

**Branch:** `feature/calls`, HEAD `46f710d9d44fbe83c627707921504625d1f5fabb`.

| Commit | Purpose |
|---|---|
| `2814ecf` | Add `.github/workflows/ci.yml`: unit, typecheck, build, scoped lint, `supabase start` with every migration, `supabase/tests/calls.sql`, type generation + equality check, artifact upload. |
| `73cae37` | Scope the lint step to files changed by the PR (repo-wide biome has pre-existing formatting debt) and format `supabase/functions/livekit-token/index.ts`. |
| `3452e0c` | WIP snapshot of the calls work; also re-added `graphify-out/` artifacts (see `46f710d`). |
| `f4879a3` | Fix the three type errors the regenerated types exposed (see below). |
| `46f710d` | Untrack the local `graphify-out/` index; local files preserved. |

**CI run:** https://github.com/jordidevmx/silverchat-2/actions/runs/44221437398 → **success** on every step: unit 120/120, typecheck, production build, lint of changed files, `supabase start` (all migrations), `pnpm test:db` (`supabase/tests/calls.sql`), type generation, types-diff verification, artifact upload.

**PR:** https://github.com/JordiDevMX/silverchat-2/pull/46 → `OPEN`, `MERGEABLE`, merge state `CLEAN`. The merge is the owner's; the agent does not merge.

**Regenerated types.** `src/types/database.ts` now comes from the complete local schema (all migrations, including `20261114000000_community_chat_avatar.sql`, which Staging does not have yet), so the calls RPCs and the Community types are both present. This **supersedes the "Known type-lag (unchanged)" section above**: the documented casts in `lib/startCallRpc.ts` and `lib/callActions.ts` are gone. Three real errors surfaced and were fixed:

- `lib/communityApi.ts`: `mute_community(p_muted_until)` is nullable in SQL (NULL clears the mute) but the generator exposes function arguments as non-nullable; narrow documented cast.
- `hooks/useSendMessage.ts`, `hooks/useMessageActions.ts`: the auth `profile` is a `profiles` row while `Message.sender` is the `profiles_visible` projection (which now includes `avatar_initials`); new `lib/senderProfile.ts` maps to the public shape using the existing `getInitials` helper.

**Pending tests / operations (unchanged by round 6):**

1. LiveKit secrets and `functions deploy livekit-token` — separate PO authorization.
2. Staging apply of the calls migration is done; the Community migration (`20261114000000_community_chat_avatar.sql`) remains pending for its owner.
3. Environment-bound checks still **NOT RUN**: genuinely concurrent DB sessions, real JWT/PostgREST outsider denial, GoTrue MFA runtime probes, two-device/two-browser call flows, and the StrictMode dev-server remount probe (covered by the extracted-function regression instead).
4. Human verification items 1–10 above remain the acceptance checklist; item 10 is now partially covered by CI (SQL suite + effective-privileges probe), but still needs a real Staging run.

**Local verification at `46f710d`:** `pnpm test` 120/120, `pnpm typecheck` exit 0, `pnpm build` exit 0, biome clean on the touched files (checked with LF copies, because the Windows checkout is CRLF while CI is LF). `git merge-tree --write-tree origin/main HEAD` exits 0: no code conflicts with `origin/main` @ `e89a04f`.

**Note on history.** `3452e0c` still contains `graphify-out/` artifacts; `46f710d` removes them, so the net merge does not reintroduce the index. Cleaning that commit out of history would require a rewrite and force-push, which needs explicit authorization and was not performed.

## Round 7 — realtime auth + server-clock incoming verdict (2026-11-18)

**Symptom.** Two Staging devices could not complete a call: the callee answered, but the caller stayed in "ringing" and hung up while the callee's call stayed open until the stale-call timeout. An earlier call never rang at all.

**Diagnosis (evidence-backed; no code changed during diagnosis).**

1. *The answer never reached the caller.* `realtime.subscription` showed both `calls` INSERT channels authenticated, but every per-call `UPDATE ... filter id=eq.<call>` join failed with `invalid column for filter id` at the exact second of each call (17:25:03, 17:26:27, 17:27:13 UTC). A Node probe against Staging reproduced it: after the first channel subscribes, `socket.setAuth()` (no argument) re-reads supabase-js's default `accessToken` callback, which falls back to the anon key because the app never uses GoTrue sessions. Every channel created after the first successful join therefore joined as `anon`, and Realtime rejects a filtered join when the role lacks column SELECT. Fix: `src/lib/supabase.ts` assigns `supabase.realtime.accessToken = async () => getAccessToken()`, so every join, post-subscribe refresh and heartbeat uses the app token. (The client-level `accessToken` option was tried first and rejected: supabase-js replaces `supabase.auth` with a throwing proxy, and `auth-provider` still calls `supabase.auth.getUser`.) Probe after the fix: the filtered join is `authenticated` and reaches `SUBSCRIBED`; `supabase.auth` remains usable.
2. *The ring decision depended on the PC clock.* `decideIncomingCall` compared `started_at` with `Date.now()`; the PC was 21.7 s ahead of the server, so live calls were dropped as "stale". Even with the clock synced, the rule was unsafe in both directions. Fix: the verdict now comes from `public.answerable_incoming_calls(p_call_id)` (new migration `20261118130000_calls_answerable_incoming.sql`), computed from the row status and the server's `now()`. The realtime INSERT is only a hint and the reconnect catch-up uses the same function. The ring deadline and the modal countdown run on `performance.now()`, so wall-clock changes cannot shorten or extend them. Self/stale/status filtering moved into the RPC; `SECURITY INVOKER` keeps the calls RLS in force.

**Tests.** Unit (`tests/calls-state.test.ts`, 21/21): server verdict → ring/ignore/busy, plus explicit assertions that shifting `Date.now` by ±1 h changes nothing and that the countdown reads the monotonic clock. SQL (`supabase/tests/calls.sql`): fresh ringing → 1 row with `expires_in_ms` in 14000..15000; expired (>15 s), canceled, answered, own and non-member rows → 0 rows; the no-argument catch-up variant returns the live call; execute granted to `authenticated` and not to `anon`. Local: `pnpm test` 119/119, `pnpm typecheck` exit 0, `pnpm build` exit 0, biome clean on the touched files (LF copies).

**CI runs:** https://github.com/jordidevmx/silverchat-2/actions/runs/44435251264 (`ad62c03`) and https://github.com/jordidevmx/silverchat-2/actions/runs/44437354022 (`07f5637`) → **success** on every step, including `supabase start` with the new migration, `supabase/tests/calls.sql` and the generated-types equality check (the committed `database.ts` matches the generator output).

**Commits:** `ad62c03` (both fixes) and `07f5637` (realtime callback placement) on `feature/calls`.

**Staging migration (owner-approved).** `20261118130000_calls_answerable_incoming` was applied to `gffdrrtatxdiucigtwdn` after `db-guard: OK`, and recorded in `supabase_migrations`. Verified afterwards: the function is `SECURITY INVOKER`, `authenticated` has EXECUTE, `anon` does not, and `POST /rest/v1/rpc/answerable_incoming_calls` answers 200 with `[]` for a real account. No data was touched.

**Regression caught during acceptance.** The first version used the client-level `accessToken` option, which makes supabase-js replace `supabase.auth` with a proxy that throws on any access (`index.mjs:666-670`). Login then failed with "We couldn't load your account" because `auth-provider` calls `supabase.auth.getUser`. `07f5637` assigns the callback on `supabase.realtime` instead — same field, `supabase.auth` intact. Probe against Staging: the filtered join is `authenticated` and reaches `SUBSCRIBED`, and `supabase.auth.getUser` remains usable.

**Manual acceptance (two devices against Staging, 2026-11-18).** Both cases passed on `07f5637` served by `netlify dev` on `http://localhost:8891`: (1) with the PC clock deliberately +2 min, A called B, B rang, answered, and A left the ringing state; (2) with B offline for >20 s the late hint did not ring, and the immediate-cancel variant did not ring either. No `invalid column for filter id` appeared in the per-call channel.
