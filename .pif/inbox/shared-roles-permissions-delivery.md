# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Submission:** Round-4 corrected delivery addressing all 3 remaining Round-3 audit findings in `.pif/handoffs/shared-roles-permissions-round-3-audit.md` (prior commits: `84ac182`, `1dbaba5`, `65efebd`, base `main` @ `7a54131`).  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** `84ac182` (Round 1) + `1dbaba5` (Round 2) + `65efebd` (Round 3) + Round-4 correction commit on `shared-roles-permissions`  
**Claim status:** `REPORTED` (until independently audited by PIF Guardian)

---

## Round-4 corrections per Guardian Round-3 audit (`shared-roles-permissions-round-3-audit.md`)

1. **Finding 1 — Reliable cleanup & early user registration (`tests/lib/staging-live.mjs`, `tests/lib/staging-live.d.mts`, `tests/sign-channel-media-live.mjs`, `tests/shared-roles-concurrency.mjs`, `tests/roles-permissions.test.ts`):**
   - Updated `StagingCleanupVerifier.verifyBucketAbsent` so only documented `404` / `"not found"` Storage responses count as absent; non-404 errors (such as synthetic `503 Service Unavailable`) push into `#errors` and fail verification.
   - Derived `passed` in `StagingCleanupVerifier.emitSummary` from `primaryPassed && cleanupErrors.length === 0 && leftovers.length === 0`, emitting the `"ALL STAGING ... PASSED!"` confirmation only after cleanup verification succeeds.
   - Extracted `createStagingTestUser` into `tests/lib/staging-live.mjs` so every auth user ID is pushed into `registeredUserIds` immediately after `admin.auth.admin.createUser` succeeds and before `signInWithPassword`, ensuring partial auth failures clean up in `finally`.
   - Covered all offline failure/cleanup paths in `tests/roles-permissions.test.ts` (404 clean pass, synthetic 503 failure with `passed: false`, leftover bucket detection, and early user-ID registration on `signInWithPassword` failure) before re-running live harnesses.

2. **Finding 2 — Complete concurrency contract (`tests/shared-roles-concurrency.mjs`):**
   - Tightened idempotent `create_channel` concurrency check to require zero errors and exact `chDraftId` UUID return on both concurrent invocations (`c1.data === chDraftId && c2.data === chDraftId`).
   - Added Scenario 6 testing unrelated `direct` (`create_direct_chat_request` + `accept_chat_request`) and `group` message sends from an independent session (`uMember`) while a `FOR UPDATE` transaction lock (`8s`) is actively held on `public.communities`:
     - Verified lock acquisition empirically via `uAdmin` community-message probes until a control probe stayed blocked `> 900ms` while the lock holder remained alive.
     - Executed both `direct` and `group` sends inside a bounded `2500ms` timeout, completing in **`100ms`** while the control community insert remained blocked (finishing only after lock release at **`8010ms`**).

3. **Finding 3 — Public reporting browser wait (`tests/public-reports-browser.mjs`):**
   - Added `await contactDialog.getByRole("button", { name: "Block", exact: true }).waitFor();` at line 301 so the Contact profile modal waits for populated profile actions before asserting `Block = 1` and `Report = 0`.
   - Re-ran the unchanged-on-disk suite (`public-reports-browser.mjs`) cleanly.

---

## Checks and evidence

### Live Staging runs (`gffdrrtatxdiucigtwdn`)
*(Staging schema `29/29` migrations & `sign-channel-media` Edge Function unchanged since `1dbaba5`; both revised live scripts re-executed after Round-4 edits)*

| Check | Command | Result | Sanitized Output Summary |
|---|---|---|---|
| Staging Edge signing contract | `node tests/sign-channel-media-live.mjs` | **PASS** | `{"suite":"sign-channel-media-live","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"checksVerified":8},"cleanup":{"checkedCounts":{"channels":1,"communities":0,"chats":1,"uploads":1,"objects":2,"buckets":2,"users":3},"cleanupErrors":[],"leftovers":[]}}` |
| Staging 2-session concurrency | `node tests/shared-roles-concurrency.mjs` | **PASS** | `{"suite":"shared-roles-concurrency","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"createChannel":["ok","ok"],"announcementWithdrawal":{"concurrentDispatchMs":252,"revoke":"ok","concurrentSend":"err:42501","concurrentForward":"err:42501"},"communitySilence":{"concurrentDispatchMs":166,"silence":"ok","concurrentSend":"err:42501","concurrentForward":"err:42501"},"unrelatedSendsUnderCommunityLock":{"probesAttempted":3,"controlBlockedBeforeUnrelatedSends":true,"unrelatedElapsedMs":100,"controlElapsedMs":8010,"directSend":"ok","groupSend":"ok","controlSend":"ok"}},"cleanup":{"checkedCounts":{"channels":1,"communities":1,"chats":3,"uploads":0,"objects":0,"buckets":0,"users":4},"cleanupErrors":[],"leftovers":[]}}` |

### Local checks (executed on Round-4 revision)

| Check | Command | Result | Scope & Details |
|---|---|---|---|
| Biome check (all PR-changed JS/TS/MJS/JSON/d.mts) | `pnpm exec biome check <94 changed/untracked files excl. database.ts>` | **PASS** | **94 files checked, 0 errors, 0 warnings.** |
| TypeScript check & production build | `pnpm typecheck && pnpm build` | **PASS** | `tsc -b` exit 0 (`task-1716` + `task-1694`); `vite build` exit 0 (`built in 766ms`). |
| Node unit suite | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** | **204/204** pass, 0 fail, 0 skipped (includes offline `StagingCleanupVerifier` 503/leftover/404 and `createStagingTestUser` partial auth-failure tests). |
| Public reports browser E2E (`:5181`) | `node tests/public-reports-browser.mjs` | **PASS** | All 6 checks passed cleanly on isolated Vite `:5181` after line-301 wait fix. |
| Other 6 browser E2E suites (`:5181`, executed at `65efebd`, app code `src/` unchanged in Round 4) | `shared-roles-permissions-browser.mjs`, `chat-growth-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS (6/6 at `65efebd`)** | No `src/` files changed between `65efebd` and Round 4; only `tests/` changed in Round 4. |

---

## Human verification needed (`G4`)

1. Live two-browser manual UI pass against Staging with real email + AAL2 MFA sessions (scanning the Group QR with a real phone camera / `/chats/join/$token` approval flow, 3-step channel creation & partial-retry display, community moderation including `10m`/custom silence & `'Avisos'` writer grant/withdrawal).
2. Light/dark/mobile (`375px`/`390px`) visual sign-off on Group QR box and Custom silence duration inputs.
3. Explicit separate Product Owner approvals before `git push`, PR creation, and Production (`lmzbaxlojgsdwgcxkmzx`) migration + `sign-channel-media` Edge Function deploy.

## Requested Guardian action

Re-audit branch `shared-roles-permissions` against Round-3 `.pif/handoffs/shared-roles-permissions-round-3-audit.md` and this Round-4 submission (`G2`–`G3`).
