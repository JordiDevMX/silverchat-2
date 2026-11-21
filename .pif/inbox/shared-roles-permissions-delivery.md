# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Submission:** Round-3 corrected delivery addressing all 4 Round-2 audit findings in `.pif/handoffs/shared-roles-permissions-delivery-audit.md` (prior commits: `84ac182256d6f3bf8b8c52202622bc5f3db5368c`, `1dbaba5b8537a2c8f2a739b4465a8c56e1534864`, base `main` @ `7a54131`).  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** `84ac182` (Round 1) + `1dbaba5` (Round 2) + Round-3 correction commit on `shared-roles-permissions`  
**Claim status:** `REPORTED` (until independently audited by PIF Guardian)

---

## Round-3 corrections per Guardian Round-2 audit (`shared-roles-permissions-delivery-audit.md`)

1. **Finding 1 — QR integrity & independent round-trip decoding (`src/features/roles/lib/qr.ts`, `src/features/chat-settings/components/GroupInviteSection.tsx`, `package.json` + `pnpm-lock.yaml`):**
   - Fixed `buildFunctionGrid` so the format-reservation loop skips `i === 6` (preserving alternating timing modules at `(8, 6)` and `(6, 8)` instead of clearing them).
   - Fixed `writeFormat` row/column coordinates across both redundant 15-bit format copies to match ISO/IEC 18004 Figure 25 (`modules[row * n + col]`).
   - Increased default QR margin from `2` to ISO/IEC 18004 standard `4` modules (`qrToSvgPath(qr, 4)`, SVG `viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"` with white background rect).
   - Obtained explicit Product Owner authorization and added exact-pinned `jsqr@1.4.0` (`devDependencies`, Apache-2.0, zero runtime deps, zero install scripts). Verified both matrix rasterization (Versions 1, 4, 5, 7+ including the 67-byte and 83-byte audit fixtures) in `tests/roles-permissions.test.ts` AND actual Chromium-rendered `<svg>` → `<canvas>` pixel extraction in `tests/shared-roles-permissions-browser.mjs` round-trip decoding to the exact invite URL via `jsQR`.

2. **Finding 2 — >50 channel invitees batching (`src/features/novedades/lib/channelInvitations.ts`, `src/features/novedades/hooks/channels/useCreateChannelDialog.ts`):**
   - Added `MAX_CHANNEL_INVITATIONS_PER_BATCH = 50` and `sendChannelInvitationsInBatches(...)` to split selected contacts cleanly into `<= 50`-item chunks matching `send_channel_invitations` server limits.
   - Wired `useCreateChannelDialog.ts` to update `sentInviteContacts` incrementally after each completed batch and isolate failures to unsent/remaining contacts (whether caused by mixed `ok: false` entries or a cross-batch RPC error), so retrying only re-sends remaining contacts across batches.
   - Added unit coverage (`51` recipients, mixed failure in batch 1 + error on batch 2 → `[2]` retry) in `tests/roles-permissions.test.ts` and browser E2E coverage (`51` contacts `[50, 1]` + cross-batch retry) in `tests/shared-roles-permissions-browser.mjs`.

3. **Finding 3 — Live Staging verification script origin binding & verified cleanup (`tests/lib/staging-live.mjs`, `tests/lib/staging-live.d.mts`, `tests/sign-channel-media-live.mjs`, `tests/shared-roles-concurrency.mjs`):**
   - Created `resolveAuthorizedStagingConfig` / `parseAuthorizedStagingOrigin` to reject mismatched `SUPABASE_PROJECT_REF`, non-HTTPS schemes, non-Staging origins, or non-root paths/queries **before** `db-guard.mjs` and API-key retrieval.
   - Eliminated `shell: true` and configurable reference shell interpolation by invoking Node directly against `node_modules/supabase/dist/supabase.js` with constant `AUTHORIZED_STAGING_REF = "gffdrrtatxdiucigtwdn"`.
   - Replaced swallowed cleanup with `StagingCleanupVerifier`, checking resolved `{ error }` responses on every deletion, verifying absence by fixture ID (`channels`, `communities`, `chats`, `file_uploads`, storage objects/buckets, `auth.admin.getUserById`), emitting a sanitized JSON summary after cleanup, and failing on any cleanup error or leftover.

4. **Finding 4 — Live race setup assertions, pre-revocation baselines, and strict `42501` post-barriers (`tests/shared-roles-concurrency.mjs`):**
   - Asserted `.error` on every setup step (`join_community`, `promote_community_admin`, `appoint_community_moderator`, `set_announcement_writer`, `promote_chat_admin`, `follow_channel`, `appoint_channel_admin`).
   - Added permitted baseline `send` + `forward_chat_message` assertions **before** both announcement-grant withdrawal and community silence to prove the moderator/member could act beforehand.
   - Distinguished client request concurrency (`Promise.all` overlapping requests with timing + per-request outcomes) from server-side `serialize_chat_message_write` serialization, requiring exact Postgres `42501` error codes on post-withdrawal and post-silence send/forward checks (plus `42501` in `OC-01` concurrent group admin demote).

---

## Checks and evidence

### Live Staging runs (`gffdrrtatxdiucigtwdn`)
*(Staging DB migrations `20261120194000`–`20261120210500` and Edge Function `sign-channel-media` unchanged since Round 2; both live scripts re-executed after Round-3 edits)*

| Check | Command | Result | Sanitized Output Summary |
|---|---|---|---|
| Staging Edge signing contract | `node tests/sign-channel-media-live.mjs` | **PASS** | `{"suite":"sign-channel-media-live","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"checksVerified":8},"cleanup":{"checkedCounts":{"channels":1,"communities":0,"chats":1,"uploads":1,"objects":2,"buckets":2,"users":3},"cleanupErrors":[],"leftovers":[]}}` |
| Staging 2-session concurrency | `node tests/shared-roles-concurrency.mjs` | **PASS** | `{"suite":"shared-roles-concurrency","targetRef":"gffdrrtatxdiucigtwdn","origin":"https://gffdrrtatxdiucigtwdn.supabase.co","passed":true,"metrics":{"createChannel":["ok","ok"],"announcementWithdrawal":{"concurrentDispatchMs":407,"revoke":"ok","concurrentSend":"err:42501","concurrentForward":"err:42501"},"communitySilence":{"concurrentDispatchMs":412,"silence":"ok","concurrentSend":"err:42501","concurrentForward":"err:42501"}},"cleanup":{"checkedCounts":{"channels":1,"communities":1,"chats":2,"uploads":0,"objects":0,"buckets":0,"users":4},"cleanupErrors":[],"leftovers":[]}}` |
| SQL suites on Staging (`Round 2`, unchanged schema since `1dbaba5`) | `npx supabase migration list --linked`, `shared_roles_permissions.sql`, `chat_settings.sql`, `novedades.sql`, `novedades_storage.sql`, `messages.sql`, `message_actions.sql` | **PASS** | `29/29` migrations aligned; `shared_roles_permissions.sql` + 5 compatibility suites passed in `BEGIN ... ROLLBACK` transactions. (`backend_foundation.sql:30` table check `30` passes; line 61 pre-existing `calls` policy fails as in `main`). |

### Local checks (all run after final Round-3 code & test edits)

| Check | Command | Result | Scope & Details |
|---|---|---|---|
| Biome check (all PR-changed JS/TS/MJS/JSON) | `pnpm exec biome check <94 changed/untracked files excl. database.ts>` | **PASS** | **94 files checked, 0 errors, 0 warnings.** |
| TypeScript check & production build | `pnpm typecheck && pnpm build` | **PASS** | `tsc -b` exit 0; `vite build` exit 0 (`built in 745ms`). |
| Node unit suite | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** | **202/202** pass, 0 fail, 0 skipped (includes QR BCH/timing + `jsQR` decode across Versions 1/4/5/7+, 51-contact batching + cross-batch retry, Staging origin-binding negative tests). |
| Browser E2E (isolated Vite `:5181`, mocked `https://supabase.test`, `VITE_SUPABASE_ANON_KEY=test-anon`) | `shared-roles-permissions-browser.mjs`, `chat-growth-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `public-reports-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS (7/7)** | `shared-roles-permissions-browser.mjs` verifies rendered `<svg>` QR quiet zone + `jsQR` pixel decode to exact invite URL and `51`-contact `[50, 1]` cross-batch creation + retry; stabilized async wait in `communities-browser.mjs:454`. |
| Unresolved inherited browser suites (status & comparison note) | `novedades-browser.mjs` (mocks updated), `chats-browser.mjs` (unmodified) | **FAIL (Non-blocking / Out-of-scope)** | Fail on untouched `StoryReplySurface` / chat row styling. Direct same-harness execution in the clean `main` primary checkout (`:5182`) could not load mocked pages cleanly because of untracked local `.env*` overrides in the primary checkout (`chats-browser.mjs:352`, `novedades-browser.mjs:542` timed out on empty shell), so a clean same-env `main` baseline remains unestablished without modifying untracked primary checkout files. |

---

## Human verification needed (`G4`)

1. Live two-browser manual UI pass against Staging with real email + AAL2 MFA sessions (scanning the Group QR with a real mobile camera / `/chats/join/$token` approval flow, 3-step channel creation & partial-retry display, community moderation including `10m`/custom silence & `'Avisos'` writer grant/withdrawal).
2. Light/dark/mobile (`375px`/`390px`) visual sign-off on Group QR box and Custom silence duration inputs.
3. Explicit separate Product Owner approvals before `git push`, PR creation, and Production (`lmzbaxlojgsdwgcxkmzx`) migration + `sign-channel-media` Edge Function deploy.

## Requested Guardian action

Re-audit branch `shared-roles-permissions` against Round-2 `.pif/handoffs/shared-roles-permissions-delivery-audit.md` and this Round-3 submission (`G2`–`G3`).
