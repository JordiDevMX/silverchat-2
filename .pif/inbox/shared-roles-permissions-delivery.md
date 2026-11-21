# Engineer → Guardian Delivery Submission

**Task ID:** `CHG-006` (Shared Roles, Permissions, Channel Privacy, Edge Media Signing & Configurable Creation Dialogs)  
**Approved plan reference:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Rev 4) + `docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md` (G1 `PASS` / `USER_APPROVED` 2026-11-20, `.pif/state.md`)  
**Branch:** `shared-roles-permissions` (isolated worktree `.worktrees/shared-roles-permissions` branched from `main` @ `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)  
**Commit SHA(s):** Pending local commit at completion (reported to Product Owner after commit; branch push and PR not executed — awaiting explicit separate approvals)  
**Claim status:** `REPORTED` (until independently verified by PIF Guardian)

---

## Requested behavior and scope

Implemented Tasks 1–7 and all approved design choices (`OC-01`–`OC-10`) across Groups, Channels, and Communities:

1. **Database Schema, RLS, Triggers, Backfill & RPCs (`supabase/migrations/20261120194000_add_moderator_role_enum.sql`, `20261120194500_shared_roles_permissions.sql`, `src/types/database.ts`):**
   - Added `'moderator'` to `member_role`, `chats.owner_id`, `chats.system_role`, `chats.write_policy`, configurable group flags (`only_admins_can_add_members`, `only_admins_can_share_link`, `only_admins_can_send`, `only_admins_can_edit_info`, `require_admin_approval`), `group_invite_links`, `group_join_requests`, `channel_members`, `channel_invitations`, `channel_feed_events`, `community_bans`, `community_audit_logs`, `community_announcement_writers`, `channels_public` & `message_media_public` privacy views, and `channel_invitations_received` / `channel_invitations_sent` views.
   - `OC-01` (group `owner` exclusivity on admin demotion/removal; `owner` immutable by admins), `OC-02` (every channel `owner` and `admin` inserted/counted once in `channel_followers`, staff blocked from `unfollow_channel`), `OC-03` (`admin` posts/deletes own only; metadata/avatar edit, deleting others' posts, and delete/transfer reserved to `owner`), `OC-04` (attributed channel invitations from `owner`/`admin`/`follower`; `'dismissed'` hidden from senders; `admin` can report channel), `OC-05` (ownership transfer RPCs for communities and channels), `OC-06` (read-only moderator view of `community_bans`, silence/expel/delete scoped to `member` & departed authors), `OC-07` (structured `community_audit_logs` without deleted message body copy), `OC-09` (existing groups preserve `only_admins_can_send` and backfill restrictive info/add/link flags; new `create_group_chat` defaults open `false`), `OC-10` (pre-flight `'Avisos'` uniqueness check + `system_role = 'announcements'`).
   - Deployed `sign-channel-media` Edge Function (`supabase/functions/sign-channel-media/index.ts`) checking `auth.getUser()`, `auth_mfa_satisfied()`, and DB authorization RPCs (`authorize_channel_avatar_read`, `authorize_channel_post_media_read`, `authorize_forwarded_channel_media_read`) before issuing Storage signed URLs.

2. **Shared Roles Library & UI Surfaces (`src/features/roles/`):**
   - Added `src/features/roles/types.ts`, `src/features/roles/lib/permissions.ts`, `src/features/roles/components/MultiStepDialog.tsx`, `src/features/roles/components/PhotoEditorPanel.tsx`, `src/features/roles/components/GroupPermissionsControl.tsx`; refactored `AvatarPickerModal.tsx` to share `PhotoEditorPanel`.

3. **Groups, Channels & Communities UI (`src/features/{chat-settings,chats,chat-growth,messages,novedades,communities,settings}/`, `src/routes/`, `src/app/router.tsx`):**
   - Groups: 5-flag `GroupPermissionsControl`, inline `PhotoEditorPanel`, invite link + join request approvals (`GroupInviteSection.tsx`), join route `/chats/join/$token`, `OC-01` `GroupMembersList` protections.
   - Channels: 3-step `CreateChannelModal` wizard with `p_channel_id` lost-response idempotency + selective invite retry, `ChannelStaffModal`, `ChannelInvitationsSection`, `channels_public` + `get_channel_viewer_context` + `get_channel_messages` + `message_media_public` + `channel_feed_events` realtime invalidation, removed channel reactions and removed `blockUserId` toggle from `ReportModal` (`OC-04`).
   - Communities: removed `"Coming soon"` gate (`OC-08`), added `CommunityModerationModals.tsx` (members moderation, read-only moderator bans, audit log, ownership transfer), `'Official'` badge on `announcements`, `write_policy` controls, silence expiry notice in `RestrictedComposerNotice.tsx`, and permanent `42501`/403 outbox halt (`outboxSync.ts`).

---

## Changes made (scope boundaries respected)

- **New directories/files:** `src/features/roles/`, `src/features/chat-settings/components/GroupInviteSection.tsx`, `src/features/communities/components/CommunityModerationModals.tsx`, `src/features/messages/lib/channelMediaSigning.ts`, `src/features/novedades/components/channels/{ChannelInvitationsSection,ChannelStaffModal}.tsx`, `src/routes/_authenticated.chats.join.$token.tsx`, `supabase/functions/sign-channel-media/index.ts`, `supabase/migrations/{20261120194000_add_moderator_role_enum,20261120194500_shared_roles_permissions}.sql`, `supabase/tests/shared_roles_permissions.sql`, `tests/{channel-media-signing,roles-permissions}.test.ts`, `tests/shared-roles-permissions-browser.mjs`, `docs/superpowers/{specs/2026-11-20-shared-roles-permissions-design,plans/2026-11-20-shared-roles-permissions-plan}.md`, `.pif/inbox/shared-roles-permissions-delivery.md`.
- **Modified task files:** `src/app/router.tsx`, `src/routes/{_authenticated.tsx,_authenticated.chats.$chatId.tsx,_authenticated.chats.new-group.tsx,_authenticated.novedades.tsx}`, `src/types/database.ts`, updated hooks/components under `src/features/{chat-growth,chat-settings,chats,communities,messages,novedades,settings}/`, SQL suites (`supabase/tests/{backend_foundation,chat_settings,novedades,novedades_storage}.sql`), unit & browser suites (`tests/{chat-growth,chat-settings,communities,message-actions,messages,novedades}.test.ts`, `tests/{chat-growth,chat-settings,communities,messages,novedades,public-reports}-browser.mjs`).
- **Pre-existing untouched governance / ignored files excluded from staging/commit:** `.pif/{history/changes.md,roadmap.md,state.md,handoffs/*}`, `graphify-out/`, `supabase/.temp/`.

---

## Checks and evidence

| Check | Command / Target | Result | Notes / Scope |
|---|---|---|---|
| Migrations ledger & Staging push | `node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn` + `npx supabase db push --linked --include-all --yes` + `npx supabase migration list --linked` | **PASS** (`VERIFIED` on Staging) | All 27 migrations (`0001`..`20261120194500`) aligned local === remote on Staging `gffdrrtatxdiucigtwdn`; 0 CR bytes across `supabase/migrations/*.sql`. Production (`lmzbaxlojgsdwgcxkmzx`) untouched. |
| Edge Function deploy & live authz contract | `npx supabase functions deploy sign-channel-media --project-ref gffdrrtatxdiucigtwdn --no-verify-jwt` + live Staging `verify_sign_edge.mjs` | **PASS** (`VERIFIED` on Staging) | Ephemeral users + temporary storage buckets created and deleted in `finally`: `ALL STAGING EDGE SIGNING CONTRACT CHECKS PASSED!` |
| Primary SQL verification suite | `npx supabase db query --linked -f supabase/tests/shared_roles_permissions.sql` | **PASS** (`VERIFIED` on Staging) | Runs in `BEGIN ... ROLLBACK` after all 4 DB policy/trigger fixes; returns cleanly with 0 failures (`rows: []`). |
| Historical SQL compatibility suites | `chat_settings.sql`, `novedades.sql`, `novedades_storage.sql` via `psql` compat wrapper on Staging (`BEGIN ... ROLLBACK`) | **PASS** (`VERIFIED` on Staging) | Executed prior to UI/browser-only final edits (SQL unchanged afterward). `backend_foundation.sql` fails pre-existing hardcoded 22-table count check outside this task (`28` app tables now present). |
| Staging two-session concurrency | Live Staging `verify_concurrency.mjs` | **PASS** (`VERIFIED` on Staging) | Verifies concurrent channel post/delete, group permission update vs message send, and join approval vs expulsion; 0 leftover users. |
| Lint & formatting (touched JS/TS/MJS) | `pnpm exec biome check` on all 80 touched `.ts`/`.tsx`/`.mjs` files (excluding `src/types/database.ts`) | **PASS** (`VERIFIED` post-final edit) | `Checked 80 files in 72ms. No fixes applied.` (0 errors, 0 warnings). |
| TypeScript & production build | `pnpm typecheck` (`tsc -b`) + `pnpm build` (`vite build`) | **PASS** (`VERIFIED` post-final edit) | Exit 0 (`built in 718ms`). |
| Unit tests | `pnpm test` (`node --experimental-strip-types --test tests/*.test.ts`) | **PASS** (`VERIFIED` post-final edit) | `197/197` pass, `0` fail, `0` skipped. |
| Browser E2E (mocked Supabase/BFF) | `node tests/shared-roles-permissions-browser.mjs`, `communities-browser.mjs`, `chat-settings-browser.mjs`, `chat-growth-browser.mjs`, `public-reports-browser.mjs`, `message-actions-browser.mjs`, `messages-browser.mjs` | **PASS** (7 suites against Vite `:5175`) | Note: `tests/messages-browser.mjs` passed after its own final edit; the other 6 passed after the final `src/` edit. Mocked REST/RPC/Realtime boundaries (`https://supabase.test`). |
| Unmodified regression suites (`main` baseline issues) | `tests/novedades-browser.mjs`, `tests/chats-browser.mjs` | **FAIL (Pre-existing on `main`)** | `novedades-browser.mjs:565` fails on untouched `StoryReplySurface` send button size (`48x36` vs `>=44px` circle) before reaching its channel section; `chats-browser.mjs:494` passes shell checks (`PASS shell breakpoints...`) then fails on untouched chat row color `rgb(255, 255, 255)` vs `rgb(0, 0, 0)`. Both left unrepaired per `AGENTS.md`. |

---

## Human verification needed

1. End-to-end Staging UI verification with real Supabase Auth + AAL2 MFA sessions across two browsers (group join-link approval + `OC-01`, channel admin/owner post/delete & media signing via `sign-channel-media`, community moderator vs admin/owner moderation, silence expiration, and `'Avisos'` writer delegation).
2. Final visual inspection in light/dark themes and mobile viewports (`375px`/`390px`) for new dialogs (`CreateChannelModal` 3-step, `CommunityModerationModals`, `ChannelStaffModal`, `GroupInviteSection`, `GroupPermissionsControl`).
3. Production (`lmzbaxlojgsdwgcxkmzx`) migration (`20261120194000`, `20261120194500`) + Edge Function deployment (`sign-channel-media`), strictly pending separate owner authorization (`OC-10` `'Avisos'` uniqueness check applies automatically during migration).

## Risks / open gates

- Gate status: `G0 PASS`, `G1 PASS`, engineering implementation & local/Staging checks `REPORTED`; `G2`–`G4` independent audit & human verification pending on **PIF Guardian** and Product Owner.
- `supabase/.temp/project-ref` in `.worktrees/shared-roles-permissions` currently points to Staging `gffdrrtatxdiucigtwdn`. Always run `node scripts/db-guard.mjs --expect <ref>` before any remote CLI operation.
- Pre-existing repository debt left untouched outside task scope: `backend_foundation.sql` hardcoded table count (`22`), `tests/novedades-browser.mjs:565` (`StoryReplySurface` button height), `tests/chats-browser.mjs:494` (chat list item color), and pre-existing Biome formatting debt on unrelated files.

## Requested Guardian action

Audit commits on branch `shared-roles-permissions` and this delivery report `.pif/inbox/shared-roles-permissions-delivery.md`, verify implementation integrity and test evidence against G1 requirements (`OC-01`–`OC-10`), and issue Guardian verdict before any Product Owner push/PR authorization.
