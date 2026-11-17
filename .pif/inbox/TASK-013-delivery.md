# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-013` (Prompt 12: Voice & Video Calls — LiveKit Edge Function & Call UI, `FR-012`)
**Approved plan reference:** `.roadmap/12-calls.md` + Product Owner authorization of 2026-11-16 with three plan adjustments: (a) migration renamed to a timestamp dated after `20261114000000` because the roadmap-locked number `0013` was already taken by an out-of-sequence migration; (b) ring audio stops at 15s (frontend) with DB cleanup of abandoned calls at 20s (cron); (c) Guardian's requested test scenarios (permissions, notification, simultaneous cancel) included; unrunnable checks left pending and reported.
**Branch:** `feature/calls` (from `main` @ `7434e743d6cfba6c30eff8bc46a406e5534d0f35`)
**Commit SHA(s):**
- `29d7146eaefea838036e94058a894a0881a6156a` — `feat(calls): voice & video calls via LiveKit (Prompt #12)` (the whole implementation, 38 files)
- After that commit, the branch also carries `3272a27` `chore: updated pif instructions so agents take a look at "pif-instructions.md" instead of "AGENTS.md"` (2 workflow files). This commit is **outside TASK-013's implementation scope** and is only noted here for baseline transparency; it was not authored by this delivery turn.
- `docs(pif): submit TASK-013 call-feature delivery for Guardian audit` — the commit that contains this file (its SHA is reported to the Product Owner separately; it cannot be self-referenced).

**Claim status:** `REPORTED` (Engineer claims below are individually classified `REPORTED` vs `VERIFIED`; Guardian to re-check).
**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Requested behavior and scope

Prompt 12 (`.roadmap/12-calls.md`, `FR-012`): voice & video one-to-one calls over LiveKit.

In scope, as authorized by the Product Owner on 2026-11-16:

1. Migration (timestamp dated after `20261114000000`): `call_status` gains `'ended'`; `decline_reason` / `ended_reason` columns; two indexes; `start_call` RPC; `calls` added to the `supabase_realtime` publication; column-level `GRANT UPDATE` extension; `cleanup_stale_calls` cron re-scheduled to 20s.
2. LiveKit token Edge Function (Deno).
3. Frontend feature module: pure call-state machine, actions, store, realtime incoming pipeline, LiveKit room lifecycle, calls-log page, incoming/outgoing/active (voice & video) modals, i18n (en/es), styles, `/calls` route + global provider in the authenticated layout.
4. Ring window per locked decisions: audio/UI gives up at 15s (`RING_TIMEOUT_MS`); the cron sweeps abandoned `ringing` rows after 20s (`missed`).
5. Tests covering Guardian's flagged scenarios: permissions, notification, simultaneous cancel (unit); RLS/publication/cancel-race (pgTAP-style integration).
6. App-scope status `AI VERIFIED` — **not** `ACCEPTED`.

Explicitly out of scope this turn (each requires separate Product Owner authorization, per `RISK-006` and the standing operating rules): Staging migration push, remote secrets, `functions deploy`, branch push, pull request, merge, deployment. Nothing was done against any remote environment; only read-only local checks ran.

## Changes made

All under commit `29d7146eaefea838036e94058a894a0881a6156a` (`REPORTED`, in one commit):

| Path | Change |
|---|---|
| `supabase/migrations/20261116120000_calls_enhancements.sql` | **New.** Enum value, reason columns, indexes, `start_call` RPC (`SECURITY DEFINER`; re-checks membership, chat activity, direct/self-only, one active call per chat, caller-busy), realtime publication membership, column grants, cron re-schedule. LF-only file (verified). |
| `supabase/functions/livekit-token/index.ts` | **New.** Edge Function: auth via bearer JWT, service-role call validation (status ∈ {ringing, answered}, ≤5min age), chat-membership check, 15-minute LiveKit JWT. Secrets expected: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (**not set anywhere yet**). |
| `src/features/calls/**` | **New feature module** (21 files): `types.ts`, `lib/callState.ts` (pure state machine + `noteText` + `CallLogEntry`), `lib/callFormatter.ts`, `lib/callActions.ts` (single cast site for the stale generated DB types), `lib/livekit.ts`, `stores/callStore.ts`, hooks (`useCalls`, `useStartCall`, `useIncomingCall`, `useActiveCall`, `useLiveKitRoom`, `useCallSounds`), components (provider, modals ×4, avatar, controls, log item, new-call modal, page), `i18n.ts` (`useCallText`, mirror of `useChatText`). |
| `src/styles/calls.css` | **New.** Call overlay styles (pulse ring, waveform, countdown, PiP, glass info). |
| `src/routes/_authenticated.calls.tsx` | **New.** Lazy `CallsPage` route file. |
| `src/app/router.tsx` | `/calls` removed from the placeholder map; real lazy route registered. |
| `src/routes/_authenticated.tsx` | `CallProvider` mounted in `AuthenticatedLayout` so incoming-call realtime stays live in every authenticated section. |
| `tests/calls-state.test.ts` | **New.** 17 unit tests over the pure modules (no Supabase, no `@/` alias — required by `tsconfig.functions.json`). |
| `supabase/tests/calls.sql` | **New.** Integration test: publication membership, `start_call` happy/busy/group/non-member paths, callee read/accept/hangup/busy writes (RLS + column grants), simultaneous cancel/decline race convergence, outsider denial, forged direct INSERT rejection. |
| `public/sounds/ringtone.mp3`, `public/sounds/calling.mp3` | **New.** Generated with ffmpeg (16.4 KB / 12.3 KB). |
| `.env.example` | Adds `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` **placeholder** entries only (no real values). |
| `package.json`, `pnpm-lock.yaml` | `livekit-client 2.24.1`, `@livekit/components-react 2.9.25` (dependencies approved by the Product Owner). |
| `src/features/communities/components/CommunityChatSidebar.tsx` | **Out-of-scope fix, explicitly approved by the Product Owner this turn:** 4 pre-existing unused-import/variable errors on `main` (present at `7434e743`) that broke `pnpm build` repo-wide. Minimal fix: removed unused `Info`/`NavLink`/`CreateCommunityChatModal` imports, `create` → `[, setCreate]`. No behavior change intended. |

Not touched (protected, per protocol): canonical `.pif/` records other than this inbox file; nothing pushed, merged or deployed; `graphify-out/` working-tree changes left uncommitted (user-owned).

## Checks and evidence

| Check | Command / procedure | Result | Classification |
|---|---|---|---|
| Type check | `pnpm typecheck` | **PASS** — exit 0 | `VERIFIED` this session, before and after the final Biome auto-fix |
| Unit tests (full suite) | `pnpm test` | **PASS** — 108/108 (72+ pre-existing + 17 new call-state) | `VERIFIED` |
| Call-state tests alone | `npx tsx --test tests/calls-state.test.ts` | **PASS** — 17/17, covering Guardian's three scenarios: permission gating (`CallStartError` kinds, `ringTimeoutOutcome`), notification (`decideIncomingCall` self/stale/status/busy-reject/ring matrix; `noteText` for every end note), simultaneous cancel (second writer no-op: `hangupPatch("ending"|"idle") → null`, `canFinishLocally` gating) | `VERIFIED` |
| Lint (touched files) | `npx biome check` on `src/features/calls`, `src/routes/_authenticated.calls.tsx`, `_authenticated.tsx`, `router.tsx`, `CommunityChatSidebar.tsx`, `tests/calls-state.test.ts` | **PASS** — exit 0 (after formatter apply-all) | `VERIFIED` |
| Production build | `pnpm build` | **PASS** — exit 0 (pre-existing chunk-size warning only) | `VERIFIED` |
| Edge Function type check | `deno check supabase/functions/livekit-token/index.ts` | **PASS** — exit 0 (deno 2.9.8) | `VERIFIED` |
| Migration line endings | Byte scan of `20261116120000_calls_enhancements.sql` | **PASS** — 0 CR bytes (LF-only; required by `scripts/db-guard.mjs`) | `VERIFIED` |
| Repo-wide lint | `pnpm lint` | Not re-run this turn; `RISK-004` full-repo Biome drift is pre-existing and untouched. Touched files are clean (row above). | `N/A` (pre-existing) |
| RLS integration test | Run `supabase/tests/calls.sql` against a migrated instance | **NOT RUN** — requires a migrated Supabase instance; Docker unavailable locally (`RISK-003`). The SQL is written and staged for when an environment exists. | `NOT_RUN` |
| Live two-browser call flow | Ring → accept → media → hangup, cancel race, busy, permission denial on real devices | **NOT RUN** — Gate 4 human verification (see checklist below) | `NOT_RUN` |
| `start_call` / realtime / cron on a live DB | Any execution | **NOT RUN** — the migration has not been applied to any environment yet (no remote authorization) | `NOT_RUN` |

### Known type-lag (documented, intentional)

`src/types/database.ts` does not yet know `'ended'`, `decline_reason`, `ended_reason` or the `start_call` RPC; regeneration requires `pnpm db:types` against a migrated environment (blocked by the missing remote authorization). All casts are concentrated in two named sites (`callActions.updateCall`, the `rpc` wrapper in `useStartCall.ts`) so the post-migration regeneration is mechanical.

## Independent review

Not performed this turn (no separate reviewer subagent dispatched for the code diff). Guardian audit is the requested independent review; the unit tests were authored to map one-to-one onto Guardian's previously flagged scenarios.

## Risks / open gates

1. **Gate status at submission:** `G0 PASS` (isolated branch `feature/calls`, no `main` edits except none — all protected). `G1 PASS` (PO-approved scope + adjustments, 2026-11-16). `G2 REPORTED→PASS-pending-audit`. `G3 PASS` for what ran (typecheck/tests/lint/build/deno/LF) with explicit `NOT_RUN` rows above. `G4 NOT_RUN` (needs two browsers/devices). `G5 BLOCKED` on remote operations. `G6 NOT_RUN`.
2. **`RISK-006` (operational):** local Supabase CLI is linked to Production (`lmzbaxlojgsdwgcxkmzx`). Before any write targeting Staging (`gffdrrtatxdiucigtwdn`), `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` must run first (and the link re-pointed). This delivery performed **no** remote operations.
3. **New operational risk — LiveKit secrets absent:** `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are not set as Edge Function secrets anywhere; until `supabase secrets set` runs (authorized separately), every `livekit-token` request will fail in the `Deno.env.get` path. `.env.example` documents the names only.
4. **Security-relevant design points for Guardian's attention:** `start_call` is `SECURITY DEFINER` but re-validates membership/chat-activity/call-uniqueness/busy-state inside; EXECUTE granted only to `authenticated`; the Edge Function uses the service role to validate the call (cross-user read the callee's RLS view may block) and then membership. Column grants extend `0002`'s four-column UPDATE grant with the two new reason columns (+ timestamp/duration columns) for both peers of the active call.
5. **Realtime lag:** catch-up query on subscribe covers INSERT events missed while briefly disconnected; the 15s staleness window bounds late rings. No UPDATE-only catch-up for status transitions of an *incoming* call row (the 15s timeout and cron converge the state anyway).
6. **Behavioral coverage gaps by design (Fase 2 per spec):** group/community calls rejected by `start_call`; reconnection to an answered call >5min old returns `call expired`.
7. **Pre-existing, untouched:** `RISK-002` (live runtime checklists), `RISK-003` (Docker suites), `RISK-004` (repo Biome drift), `RISK-005`. The `CommunityChatSidebar` fix removes a build blocker that affected `main`; nothing else pre-existing was modified.

## Human verification needed

Do not mark these PASS without confirmation (Gate 4 checklist, two browsers/devices + two test accounts):

1. Incoming call: fullscreen modal, ringtone, 15s countdown drains to zero and stops the ring; timer verified in a second tab.
2. Accept → both sides transition to the active modals; voice connects (two-way audio); timer runs.
3. Simultaneous cancel/decline: both peers hang up at once → exactly one terminal DB status, no zombie modal on either side.
4. Decline → the caller receives the "Call declined" status note; no-answer at 15s → "No answer" locally and the row becomes `missed` via cron within ~20s afterwards.
5. Busy: a second incoming call while in a call is never shown; row ends `missed` with `decline_reason='busy'`.
6. Permission denial (browser settings) → status note, no `calls` row created, no LiveKit join.
7. Video: remote fullscreen (tap toggles cover/contain), draggable local PiP, camera on/off, mic mute, speaker toggle; voice call shows Mic/Speaker/Hangup only (no camera upgrade button).
8. Calls log: day grouping (Today/Yesterday/date), direction arrows, missed styling, duration for connected calls, callback buttons start a new call.
9. After the Staging migration is authorized and applied: run `supabase/tests/calls.sql` and regenerate `pnpm db:types`.

## Pending operations (each requires separate Product Owner authorization)

1. Staging migration apply: re-link to `gffdrrtatxdiucigtwdn`, run `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn`, then `npx supabase db push --linked`, then optionally a live probe of `start_call`/publication/cron.
2. `supabase secrets set` for the three LiveKit variables (Staging or Production per authorized target).
3. `supabase functions deploy livekit-token`.
4. Push `feature/calls` and open a PR.
5. Decide the tracking of the untracked `deno.lock` (generated by `deno check`; repo currently has no `deno.json` policy for it) — commit it, ignore it, or delete it.

## Requested Guardian action

- Audit the evidence above; create `AUD-…` findings; compare against the gate table in `.pif/state.md` and `FR-012`/`TASK-013` in the roadmap.
- Propose (or perform, if authorized) the canonical updates: `TASK-013` → `IMPLEMENTED`/`AWAITING_VERIFICATION` as Guardian sees fit, `G3` row update distinguishing the executed AI checks from the `NOT_RUN` remote/human rows, and a follow-up entry for the LiveKit-secrets operational blocker. **Engineer has not modified any canonical record.**
- Note that the app remains `AI VERIFIED`, not `ACCEPTED`: nothing here clears `G4` or `G6`.
