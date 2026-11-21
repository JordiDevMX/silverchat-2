# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Submission:** Round-6 corrected delivery addressing the remaining Round-5 audit finding in `.pif/handoffs/shared-roles-permissions-round-5-audit.md` (prior commits: `84ac182`, `1dbaba5`, `65efebd`, `2174130`, `2249fc9`, base `main` @ `7a54131`).  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** `84ac182` (Round 1) + `1dbaba5` (Round 2) + `65efebd` (Round 3) + `2174130` (Round 4) + `2249fc9` (Round 5) + Round-6 correction commit on `shared-roles-permissions`  
**Claim status:** `REPORTED` (until independently audited by PIF Guardian)

---

## Round-6 correction per Guardian Round-5 audit (`shared-roles-permissions-round-5-audit.md`)

1. **Two-barrier database lock handshake proving the community lock spans both unrelated sends (`tests/lib/staging-live.mjs`, `tests/lib/staging-live.d.mts`, `tests/shared-roles-concurrency.mjs`, `tests/roles-permissions.test.ts`):**
   - Replaced the `900ms` local timer and fixed `2.5s` `pg_sleep` window with an explicit two-barrier database handshake between the lock-holder transaction (`lockProc`) and the Node harness (`runCommunityLockIsolationScenario`):
     - **Phase-1 lock-confirmation gate (`confirmLockHeld` / `phase1_gate_pid`):** The lock holder acquires `FOR UPDATE` on `public.communities WHERE id = commId` and `public.channels WHERE id = chId` in the outer `DO $$` block, and enters an inner `BEGIN ... EXCEPTION` subtransaction holding `FOR UPDATE` on `public.chats WHERE id = srcGroupId`. While a control community insert is in flight, Node calls `confirmLockHeld` (`UPDATE public.chats WHERE id = srcGroupId`). The holder polls `pg_locks` until **both** the control session (`v_blocked_pid` on `'public.communities'::regclass`) and the Phase-1 observer (`v_phase1_pid` on `'public.chats'::regclass`) are blocked by `pg_backend_pid()`, sets `v_blocked_start := true`, holds `v_phase1_pid` for `550ms`, and rolls back only the inner subtransaction to release `srcGroupId` while keeping `commId` and `chId` locked.
     - **Gated dispatch of unrelated sends:** `runCommunityLockIsolationScenario` dispatches `runUnrelatedWrites()` (`direct` + `group` message inserts) **only after** `confirmLockHeld` returns `{ confirmed: true }` while the control insert remains pending (`lockConfirmedAtElapsedMs <= unrelatedDispatchedAtElapsedMs`).
     - **Phase-3 completion gate (`signalUnrelatedWritesCompleted` / `phase3_gate_pid`):** Only **after** both unrelated sends succeed does Node call `signalUnrelatedWritesCompleted` (`UPDATE public.channels WHERE id = chId`). Inside the outer `DO $$` block, the holder waits until `pg_locks` shows `v_phase3_pid` blocked by `pg_backend_pid()` on `'public.channels'::regclass`, immediately re-samples `pg_locks` + `pg_blocking_pids(v_blocked_pid)` to confirm the **same** control session `v_blocked_pid` is still blocked (`v_blocked_end := true`), records `(holder_pid, blocked_pid, phase1_gate_pid, phase3_gate_pid, blocked_at_start, blocked_at_end)` in `_lock_obs`, and commits to release `commId` and `chId`.
   - Added offline delayed-acquisition regression coverage in `tests/roles-permissions.test.ts`:
     - **Reverse-order rejection:** When unrelated writes run before the database's first lock observation (`first_observed_elapsed_ms: 140` vs `unrelatedDispatchedAtElapsedMs: ~50`), `runCommunityLockIsolationScenario` rejects with `/Database lock observations \[140ms, 390ms\] must bracket unrelated writes/`.
     - **Delayed acquisition gated by `confirmLockHeld`:** When lock acquisition and control arrival occur after the initial `40ms` probe threshold (`~120ms`), `confirmLockHeld` delays dispatch until lock confirmation resolves (`lockConfirmed <= unrelatedDispatch <= unrelatedDone <= secondSample`).

---

## Checks and evidence

### Live Staging runs (`gffdrrtatxdiucigtwdn`)
*(Executed on the Round-6 revision after all offline unit tests passed)*

| Check | Command | Result | Sanitized Output Summary |
|---|---|---|---|
| Staging 2-session concurrency (revised in Round 6) | `node tests/shared-roles-concurrency.mjs` | **PASS** | `{"suite":"shared-roles-concurrency","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"createChannel":["ok","ok"],"announcementWithdrawal":{"concurrentDispatchMs":170,"revoke":"ok","concurrentSend":"ok","concurrentForward":"err:42501"},"communitySilence":{"concurrentDispatchMs":146,"silence":"ok","concurrentSend":"ok","concurrentForward":"ok"},"unrelatedSendsUnderCommunityLock":{"probesAttempted":8,"holderPid":3312890,"blockedControlPid":3312580,"phase1ObserverPid":3312564,"phase3ObserverPid":3312564,"dbLockVerifiedAtStart":true,"dbLockVerifiedAfterUnrelatedWindow":true,"lockConfirmedAtElapsedMs":5839,"unrelatedDispatchedAtElapsedMs":5839,"unrelatedFinishedAtElapsedMs":5976,"releaseSignalSentAtElapsedMs":5976,"unrelatedElapsedMs":137,"controlElapsedMs":1508,"directSend":"ok","groupSend":"ok","controlSend":"ok"}},"cleanup":{"checkedCounts":{"channels":1,"communities":1,"chats":3,"uploads":0,"objects":0,"buckets":0,"users":4},"cleanupErrors":[],"leftovers":[]}}` |
| Staging Edge signing contract (unchanged since `2249fc9`) | `node tests/sign-channel-media-live.mjs` | **PASS (`2249fc9`)** | `{"suite":"sign-channel-media-live","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"checksVerified":8},"cleanup":{"checkedCounts":{"channels":1,"communities":0,"chats":1,"uploads":1,"objects":2,"buckets":2,"users":3},"cleanupErrors":[],"leftovers":[]}}` |

### Local checks (executed on Round-6 revision)

| Check | Command | Result | Scope & Details |
|---|---|---|---|
| Biome check (all PR-changed JS/TS/MJS/JSON/d.mts) | `pnpm exec biome check <95 changed/untracked files excl. database.ts>` | **PASS** | **95 files checked, 0 errors, 0 warnings.** |
| TypeScript check & production build | `pnpm typecheck && pnpm build` | **PASS** | `tsc -b` exit 0; `vite build` exit 0 (`built in 731ms`). |
| Node unit suite | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** | **207/207** pass, 0 fail, 0 skipped (includes early child exit `23`, no-DB-lock negative control, delayed-acquisition reverse-order rejection, and gated delayed-acquisition ordering). |
| Browser E2E suites (`:5181`, unchanged since `65efebd` / `2174130`) | `shared-roles-permissions-browser.mjs`, `public-reports-browser.mjs`, `chat-growth-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS (7/7)** | Verified in Round 3/4 (`2174130`); no `src/` or browser test files changed in Round 6. |

---

## Human verification needed (`G4`)

1. Live two-browser manual UI pass against Staging with real email + AAL2 MFA sessions (scanning the Group QR with a real phone camera / `/chats/join/$token` approval flow, 3-step channel creation & partial-retry display, community moderation including `10m`/custom silence & `'Avisos'` writer grant/withdrawal).
2. Light/dark/mobile (`375px`/`390px`) visual sign-off on Group QR box and Custom silence duration inputs.
3. Explicit separate Product Owner approvals before `git push`, PR creation, and Production (`lmzbaxlojgsdwgcxkmzx`) migration + `sign-channel-media` Edge Function deploy.

## Requested Guardian action

Re-audit branch `shared-roles-permissions` against Round-5 `.pif/handoffs/shared-roles-permissions-round-5-audit.md` and this Round-6 submission (`G2`–`G3`).
