# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Submission:** Round-2 corrected delivery addressing all 5 verified audit findings and evidence requirements in `.pif/handoffs/shared-roles-permissions-delivery-audit.md` (prior commit: `84ac182256d6f3bf8b8c52202622bc5f3db5368c`, base `main` @ `7a54131`).  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** Round-1 commit `84ac182` + Round-2 correction commit on `shared-roles-permissions` (commit SHA reported to the Product Owner separately after commit)  
**Claim status:** `REPORTED` (until independently audited by PIF Guardian)

---

## Round-2 corrections per Guardian audit (`shared-roles-permissions-delivery-audit.md`)

1. **Finding 1 — Channel & role identity privacy (`supabase/migrations/20261120210000_shared_roles_permissions_audit_fixes.sql`, `20261120210500_fix_channel_followers_delete_policy.sql`):**
   - Created non-exposed schema `private` (`REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;`) holding internal 2-arg helpers (`private.is_channel_staff`, `private.is_channel_owner`, `private.is_channel_follower`, `private.is_group_owner`, `private.is_group_owner_or_admin`, `private.community_role_rank`).
   - Hardened the externally callable `public.*` predicates (`is_channel_staff`, `is_channel_owner`, `is_channel_follower`, `is_group_owner`, `is_group_owner_or_admin`, `can_share_group_invite`, `can_edit_group_info`, `can_add_group_members`, `community_role_rank`, `is_community_staff`, `is_community_admin_or_owner`, `can_write_community_chat`) so callers passing `p_user_id IS DISTINCT FROM (SELECT auth.uid())` unconditionally receive `false` / `0` without querying other identities' state.
   - Updated internal cross-user `SECURITY DEFINER` triggers/RPCs (`serialize_chat_message_write`, `appoint_community_moderator`, `silence_community_member`, `unsilence_community_member`, `expel_community_member`, `moderate_delete_community_message`) to call `private.*` helpers.
   - Verified in `supabase/tests/shared_roles_permissions.sql` with distinct callers (`u_outsider`, `u_admin`, `u_owner`) proving `false`/`0` on other subjects and `42501` denial on direct `private.*` invocation.

2. **Finding 2 — `channel_followers` direct DELETE invariant (`20261120210000`, `20261120210500`):**
   - Replaced `channel_followers_delete_own` RLS policy (`AND NOT public.is_channel_staff(channel_id, (SELECT auth.uid()))`) AND added `BEFORE DELETE` trigger `prevent_channel_staff_follower_delete` on `public.channel_followers` (with `mark_deleting_channel` on `public.channels` for cascade deletions).
   - Verified in `supabase/tests/shared_roles_permissions.sql` that direct `DELETE FROM public.channel_followers` by channel `admin` or `owner` deletes `0` rows via RLS, raises `42501` at trigger level even when bypassing RLS, and keeps `follower_count` exact.

3. **Finding 3 — Channel growth card invitation flow (`src/features/chat-growth/components/{ChannelInviteAdminModal,ChatGrowthHost}.tsx`, `src/features/chat-growth/lib/growthConfig.ts`):**
   - Removed global user search (`useUserSearch`) and personal DM inserts (`messages.insert` / `create_direct_chat_request`) from `ChannelInviteAdminModal.tsx`.
   - Routed `ChannelView` → `ChatGrowthHost` → `ChannelInviteAdminModal` strictly through `useDirectContacts()`, `channel_invitations_sent`, and `supabase.rpc("send_channel_invitations", ...)` with `parseChannelInvitationResults(...)`, retaining generic `/channels/<id>` copy-link without sender identity.

4. **Finding 4 — Partial invitation delivery handling (`src/features/novedades/lib/channelInvitations.ts`, `useCreateChannelDialog.ts`, `ChannelInvitationsSection.tsx`, `ChannelInviteAdminModal.tsx`):**
   - Parsed the actual `send_channel_invitations` JSONB array (`[{ recipient_id, id?, ok, reason? }]`) across all three invitation entry points via `parseChannelInvitationResults`.
   - When `send_channel_invitations` returns mixed successes and failures, succeeded recipients immediately mark as `Sent`, failed recipients mark as `Retry needed`, the wizard stays open on Step 3, and retrying sends only remaining unsent contacts.
   - Verified with unit tests (`tests/roles-permissions.test.ts`) and browser E2E (`tests/shared-roles-permissions-browser.mjs`).

5. **Finding 5 — Group invite QR, custom community silence duration, and owner-only `Promote admin`:**
   - Added zero-dependency ISO/IEC 18004 QR generator (`src/features/roles/lib/qr.ts`) and rendered `<svg role="img" aria-label="Group invite QR code">` in `GroupInviteSection.tsx`, verified in `tests/roles-permissions.test.ts` and `tests/shared-roles-permissions-browser.mjs`.
   - Updated `SILENCE_PRESETS` in `CommunityModerationModals.tsx` to start with `10 minutes`, `1 hour`, `24 hours`, `7 days`, and `Custom duration` (`parseCustomSilenceMinutes` bounded `1`–`43200` minutes).
   - Restricted `canManageCommunityAdmins(role)` in `src/features/roles/lib/permissions.ts` to `role === "owner"` (`owner`-only), matching server RPCs (`promote_community_admin`, `demote_community_admin`), hiding `Promote admin` from non-owner community admins in `CommunityModerationModals.tsx`.

6. **Reproducible DB, Edge & Concurrency evidence committed in repo:**
   - Committed opt-in Staging verification scripts `tests/sign-channel-media-live.mjs` and `tests/shared-roles-concurrency.mjs` (enforcing `scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` and cleaning up all ephemeral users/buckets in `finally`), expanding concurrency coverage to 5 independent-session races including **announcement grant withdrawal vs moderator send/forward** and **community silence vs member send/forward**.
   - Updated `supabase/tests/backend_foundation.sql:30` table count baseline from `22` to `30` to reflect post-migration `public` tables cleanly.

---

## Checks and evidence (all run against revised Round-2 code)

| Check | Command / Target | Result | Classification / Notes |
|---|---|---|---|
| Staging migration ledger & guard | `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` + `npx supabase db push --linked --yes` + `npx supabase migration list --linked` | **PASS** | All 29 migrations (`0001`..`20261120210500`) aligned local === remote on Staging `gffdrrtatxdiucigtwdn`; 0 CR bytes across `supabase/migrations/*.sql`. Production (`lmzbaxlojgsdwgcxkmzx`) untouched. |
| Primary SQL suite on Staging | `npx supabase db query --linked -f supabase/tests/shared_roles_permissions.sql` | **PASS** | Transaction `BEGIN ... ROLLBACK` with Finding 1 & Finding 2 tests; `rows: []` (0 failures). |
| Additional SQL compatibility suites on Staging | `run_psql_compat.mjs` on `chat_settings.sql`, `novedades.sql`, `novedades_storage.sql`, `messages.sql`, `message_actions.sql` (`BEGIN ... ROLLBACK`) | **PASS (5/5)** | All 5 suites passed cleanly against live Staging schema after Round-2 migrations. |
| Baseline `backend_foundation.sql` on Staging | `run_psql_compat.mjs backend_foundation.sql` (`BEGIN ... ROLLBACK`) | **FAIL (Pre-existing `calls` policy drift on `main`)** | Updated `30 application tables` check passes; fails at line 61 (`cannot call in pending chat`: `[42501] permission denied for table calls`) because pre-existing `20261116120000_calls_enhancements.sql:91` revoked direct client `INSERT` on `public.calls`. Left untouched per scope boundary. |
| Live Staging Edge Function contract | `node tests/sign-channel-media-live.mjs` (`gffdrrtatxdiucigtwdn`) | **PASS** | Exercises 401 unauth, valid avatar/post/forwarded signing + fetch 200, stale avatar 403, outsider 403, deleted post 403 while forwarded copy stays 200. Post-run Staging check: `0` test users, `[]` storage buckets. |
| Live Staging 2-session concurrency | `node tests/shared-roles-concurrency.mjs` (`gffdrrtatxdiucigtwdn`) | **PASS** | Exercises idempotent `create_channel`, concurrent follow+admin `follower_count=3`, **announcement writer revocation vs moderator send/forward**, **community silence vs member send/forward**, and `OC-01` concurrent group admin demote. |
| Biome check (all PR-changed JS/TS/MJS) | `pnpm exec biome check <changed files excluding database.ts>` | **PASS** | 92 changed/untracked files checked; 0 errors, 0 warnings. |
| TypeScript & production build | `pnpm typecheck` (`tsc -b`) + `pnpm build` (`vite build`) | **PASS** | Exit 0 (`built in 786ms`). |
| Node unit suite | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** | **200/200** pass, 0 fail, 0 skipped. |
| Browser E2E (isolated Vite `:5181`, mocked `https://supabase.test`) | `shared-roles-permissions-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `chat-growth-browser.mjs`, `public-reports-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS (7/7)** | `shared-roles-permissions-browser.mjs` verifies QR rendering, community admin hiding `Promote admin`, `10m`/`custom` silence duration, and mixed-result partial `send_channel_invitations` retry. `chat-growth-browser.mjs` verifies contact-only `send_channel_invitations` (0 DM inserts). |
| Inherited failing browser suites (compared against branch diff) | `tests/novedades-browser.mjs` (modified mocks only), `tests/chats-browser.mjs` (unmodified) | **FAIL (Untouched UI components/CSS)** | Same-environment run on clean `main` (`:5182`) could not render because primary checkout uses a different untracked `.env`. On this branch, `git diff main..HEAD -- src/styles src/components src/features/novedades/components/stories src/features/chats/components` is empty: `novedades-browser.mjs:565` fails on untouched `StoryReplySurface` send button (`48x36` vs `>=44px` circle) before reaching its channel block; `chats-browser.mjs:494` passes shell checks and fails on untouched chat row style (`rgb(255, 255, 255)` vs `rgb(0, 0, 0)`). |

---

## Human verification needed

1. Live two-browser manual UI pass against Staging with real email + AAL2 MFA sessions (group QR scan & `/chats/join/$token` approval flow, channel 3-step creation & partial-retry display, community moderation including `10m`/custom silence & `'Avisos'` writer grant/withdrawal).
2. Light/dark/mobile (`375px`/`390px`) visual sign-off on Group QR box and Custom silence duration inputs.
3. Explicit separate Product Owner approvals before `git push`, PR creation, and Production (`lmzbaxlojgsdwgcxkmzx`) migration (`20261120194000`, `20261120194500`, `20261120210000`, `20261120210500`) + `sign-channel-media` Edge Function deploy.

## Requested Guardian action

Re-audit branch `shared-roles-permissions` against `.pif/handoffs/shared-roles-permissions-delivery-audit.md` and this updated submission, and record updated gate verdicts (`G2`–`G3`).
