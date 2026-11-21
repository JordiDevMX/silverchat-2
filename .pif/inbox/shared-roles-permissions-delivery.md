# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Submission:** Round-5 corrected delivery addressing all 3 Round-4 audit findings in `.pif/handoffs/shared-roles-permissions-round-4-audit.md` (prior commits: `84ac182`, `1dbaba5`, `65efebd`, `2174130`, base `main` @ `7a54131`).  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** `84ac182` (Round 1) + `1dbaba5` (Round 2) + `65efebd` (Round 3) + `2174130` (Round 4) + Round-5 correction commit on `shared-roles-permissions`  
**Claim status:** `REPORTED` (until independently audited by PIF Guardian)

---

## Round-5 corrections per Guardian Round-4 audit (`shared-roles-permissions-round-4-audit.md`)

1. **Finding 1 — Immediate lock-holder child observation & guaranteed outer cleanup (`tests/lib/staging-live.mjs`, `tests/shared-roles-concurrency.mjs`, `tests/roles-permissions.test.ts`):**
   - Extracted `runCommunityLockIsolationScenario` into `tests/lib/staging-live.mjs`.
   - Attached `error` and `exit` listeners immediately upon spawning `lockProc`, resolving a non-throwing `lockSettledPromise` while racing probe sleeps and unrelated sends against an immediately observed (`earlyExitPromise.catch(() => {})`) early-failure promise.
   - In `finally`, terminated any still-running child and awaited `lockSettledPromise` with a bounded settle timeout before returning, ensuring early child failure (such as exit code `23` during the first control probe) never triggers an `UnhandledPromiseRejection`, always reaches the outer `StagingCleanupVerifier`, and reports `passed: false`.
   - Verified offline in `tests/roles-permissions.test.ts` (`process.on("unhandledRejection")` count `0`, `/Lock holder exited 23/` propagated, outer summary `passed: false`).

2. **Finding 2 — Database-observed lock binding (`pg_locks` / `pg_blocking_pids`) & negative control (`tests/lib/staging-live.mjs`, `tests/shared-roles-concurrency.mjs`, `tests/roles-permissions.test.ts`):**
   - Bound Scenario 6 to PostgreSQL's lock manager inside the lock-holder transaction (`CREATE TEMP TABLE _lock_obs` + `DO $$ ... $$` + `SELECT * FROM _lock_obs`):
     - Acquires `FOR UPDATE` on `public.communities WHERE id = '<commId>'`.
     - Polls `pg_locks` + `pg_blocking_pids(l.pid)` until a control session (`v_blocked_pid`) holding a granted lock on `'public.communities'::regclass` is observed with `NOT l.granted` and `pg_backend_pid() = ANY(pg_blocking_pids(l.pid))` (`blocked_at_start = true`).
     - Holds the lock across a `2.5s` window while the independent session completes both unrelated `direct` and `group` message inserts, then re-queries `pg_locks` + `pg_blocking_pids(v_blocked_pid)` before committing to verify the **same** `v_blocked_pid` is still blocked by `holder_pid` (`blocked_at_end = true`).
   - Added an offline **negative control** in `tests/roles-permissions.test.ts` where the child only sleeps without holding a DB lock (`blocked_pid: null`, `blocked_at_start: false`, `blocked_at_end: false`), the control insert resolves slowly after the probe threshold, and both unrelated sends return immediately — proving `runCommunityLockIsolationScenario` rejects with `/Database lock observation must confirm holder_pid blocked control session/`.

3. **Finding 3 — Resource-specific absence checks (`503` precedence) & pre-dispatch `chDraftId` cleanup tracking (`tests/lib/staging-live.mjs`, `tests/sign-channel-media-live.mjs`, `tests/shared-roles-concurrency.mjs`, `tests/roles-permissions.test.ts`):**
   - Updated `isMissingResourceError(error, kind)` to give precedence to explicit non-404 HTTP/service failure statuses (`503`, `500`, `401`, `403`, `408`, `429`), reject any message referencing `upstream`/`service`/`gateway`/`route`/`endpoint`/`proxy`/`server`, and require resource-specific `"bucket"` (`Bucket not found` / `NoSuchBucket`) vs `"user"` (`user_not_found` / `User not found`) absence indicators. Verified offline that `{ status: 503, message: "Upstream service not found" }` fails both bucket and user checks (`cleanupErrors.length === 2`, `passed: false`).
   - Extracted `runConcurrentChannelCreation` and `cleanupAndVerifyChannel`: registers `chId = chDraftId` via `onTrackChannelId(draftId)` **before** dispatching `Promise.all([create_channel, create_channel])`, deletes the channel row if created (or skips deletion cleanly if absent), and verifies absence in `public.channels` on either outcome. Verified both partial-create and absent-fixture paths offline in `tests/roles-permissions.test.ts`.

---

## Checks and evidence

### Live Staging runs (`gffdrrtatxdiucigtwdn`)
*(Executed after all Round-5 offline unit tests passed)*

| Check | Command | Result | Sanitized Output Summary |
|---|---|---|---|
| Staging Edge signing contract | `node tests/sign-channel-media-live.mjs` | **PASS** | `{"suite":"sign-channel-media-live","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"checksVerified":8},"cleanup":{"checkedCounts":{"channels":1,"communities":0,"chats":1,"uploads":1,"objects":2,"buckets":2,"users":3},"cleanupErrors":[],"leftovers":[]}}` |
| Staging 2-session concurrency | `node tests/shared-roles-concurrency.mjs` | **PASS** | `{"suite":"shared-roles-concurrency","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"createChannel":["ok","ok"],"announcementWithdrawal":{"concurrentDispatchMs":169,"revoke":"ok","concurrentSend":"ok","concurrentForward":"err:42501"},"communitySilence":{"concurrentDispatchMs":144,"silence":"ok","concurrentSend":"ok","concurrentForward":"err:42501"},"unrelatedSendsUnderCommunityLock":{"probesAttempted":4,"holderPid":3311555,"blockedControlPid":3311548,"dbLockVerifiedAtStart":true,"dbLockVerifiedAfterUnrelatedWindow":true,"unrelatedElapsedMs":188,"controlElapsedMs":2873,"directSend":"ok","groupSend":"ok","controlSend":"ok"}},"cleanup":{"checkedCounts":{"channels":1,"communities":1,"chats":3,"uploads":0,"objects":0,"buckets":0,"users":4},"cleanupErrors":[],"leftovers":[]}}` |

### Local checks (executed on Round-5 revision)

| Check | Command | Result | Scope & Details |
|---|---|---|---|
| Biome check (all PR-changed JS/TS/MJS/JSON/d.mts) | `pnpm exec biome check <95 changed/untracked files excl. database.ts>` | **PASS** | **95 files checked, 0 errors, 0 warnings.** |
| TypeScript check & production build | `pnpm typecheck && pnpm build` | **PASS** | `tsc -b` exit 0; `vite build` exit 0 (`built in 724ms`). |
| Node unit suite | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** | **207/207** pass, 0 fail, 0 skipped (adds 3 new offline suites covering `503 Upstream service not found`, pre-dispatch `chDraftId` partial/absent cleanup, early child exit `23`, and no-DB-lock negative control). |
| Browser E2E suites (`:5181`, unchanged since `65efebd` / `2174130`) | `shared-roles-permissions-browser.mjs`, `public-reports-browser.mjs`, `chat-growth-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS (7/7)** | Verified in Round 3/4 (`2174130`); no `src/` or browser test files changed in Round 5. |

---

## Human verification needed (`G4`)

1. Live two-browser manual UI pass against Staging with real email + AAL2 MFA sessions (scanning the Group QR with a real phone camera / `/chats/join/$token` approval flow, 3-step channel creation & partial-retry display, community moderation including `10m`/custom silence & `'Avisos'` writer grant/withdrawal).
2. Light/dark/mobile (`375px`/`390px`) visual sign-off on Group QR box and Custom silence duration inputs.
3. Explicit separate Product Owner approvals before `git push`, PR creation, and Production (`lmzbaxlojgsdwgcxkmzx`) migration + `sign-channel-media` Edge Function deploy.

## Requested Guardian action

Re-audit branch `shared-roles-permissions` against Round-4 `.pif/handoffs/shared-roles-permissions-round-4-audit.md` and this Round-5 submission (`G2`–`G3`).
