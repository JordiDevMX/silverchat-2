# Shared Roles, Permissions & Configurable Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one unified roles/capabilities model with strict PostgreSQL/Edge enforcement across Groups, Channels, and Communities, enable Communities navigation and deep-link routes (`OC-08`), and deliver one accessible, responsive multi-step creation dialog (`MultiStepDialog`) with inline photo cropping applied to Channel creation.

**Architecture:** A shared pure capability engine (`src/features/roles/`) mirrors PostgreSQL `SECURITY DEFINER` helpers, RLS policies, `security_barrier` views, column grants, and lock-ordered RPCs (`communities -> chats -> community_members -> chat_members / community_announcement_writers`). Channel staff/follower privacy is enforced across projections (`channels_public`, `channel_invitations_sent`, `channel_invitations_received`, `message_media_public`, `get_channel_messages`), `channel_feed_events` Realtime, and end-user-authorized `sign-channel-media` Edge Function signing. One `MultiStepDialog` + inline `PhotoEditorPanel` handles multi-step creation without nested `<dialog>` elements.

**Tech Stack:** PostgreSQL 15+ / Supabase (RLS, `SECURITY DEFINER` RPCs, Edge Functions Deno), React 19, TypeScript strict, TanStack Router & Query, Zustand, Lucide React, `react-easy-crop`, Tailwind CSS v4, Node test runner, `psql` SQL suites (`pnpm test:db`), Playwright Chromium browser suites (`tests/*-browser.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md` (Revision 4)

## Pending PO Confirmation Included in This Plan
- **`OC-09` (Existing Group Backfill):** This plan implements Guardian's recommended historical backfill for pre-existing groups (`only_admins_can_add_members = true`, `only_admins_can_share_link = true`, `only_admins_can_edit_info = true`, preserving stored `only_admins_can_send`, `require_admin_approval = false`) while defaulting newly created groups to open (`false`). Product Owner approval of this plan explicitly confirms `OC-09` (or directs an override to `false` before Task 1 runs).

## Global Constraints
- Work strictly inside `.worktrees/shared-roles-permissions` on branch `shared-roles-permissions`. Do not modify `main` or `graphify-out/`.
- English for all repository artifacts (SQL, TypeScript, comments, tests, commit messages); bilingual `en`/`es` UI strings via `useMessageText()` / `useChatText()`.
- All new SQL migrations must use LF line endings and pass `node scripts/db-guard.mjs` checks; never push to or mutate remote Staging/Production databases without separate explicit authorization.
- Follow TDD: write failing SQL / unit / browser tests first, confirm failure, implement the minimal coherent solution, and verify pass.
- No application implementation starts until Guardian G1 sign-off and Product Owner plan approval are recorded.

## Review Focus
- **Group active membership & invite separation:** Outsiders and former members must fail every member-configurable action (including avatar uploads) even when all group permissions are open; `get_group_invite` respects `only_admins_can_share_link` while `rotate_group_invite`/`revoke_group_invite` and `demote_chat_admin`/`remove_chat_member` on admins (`OC-01`) remain owner/admin or owner-only.
- **Channel privacy across raw reads, Realtime, Storage & invitations:** Non-staff cannot read `owner_id`, `sender_id`, `uploader_id`, `channel_staff`, or `storage.objects.owner`; staff cannot read `channel_followers` of other users; channel-attributed invitations never leak `sender_id` or `sender_role` or existing follower/staff status or private dismissal; `sign-channel-media` authorizes via end-user JWT (`userClient`) before `service_role` signs current channel avatars, public channel posts, or accessible forwarded attachments.
- **Communities completeness & lock order:** `General` + official announcements (`OC-10` cardinality check), `moderator` description edits on community & child chats, `write_policy` + per-moderator announcement grants (auto-cleared on demotion), timed silence + authorized-lift check, expulsion + `community_bans` + unchecked bulk delete + read-only moderator blocked list (`OC-06`), departed-author message deletion, `community_audit_logs` (`OC-07`), and deadlock-free `FOR SHARE`/`FOR UPDATE` lock order leaving `direct`/`self` lock-free.

---

### Task 1: Database Schema, Privacy Views, Backfill & Serialized RPCs (TDD SQL First)

**Files:**
- Create: `supabase/tests/shared_roles_permissions.sql`
- Create: `supabase/migrations/<timestamp>_shared_roles_permissions.sql` (LF-normalized)
- Modify: `supabase/tests/chat_settings.sql`, `supabase/tests/novedades.sql`, `supabase/tests/novedades_storage.sql`, `supabase/tests/messages.sql`, `supabase/tests/message_actions.sql` (align any assertions affected by `OC-01`, `OC-02`, `OC-10`, channel reaction removal, or `channels_public` / `get_channel_messages`)
- Modify: `src/types/database.ts`

**Scope:**
1. **Groups:**
   - Add `owner_id`, `only_admins_can_add_members`, `only_admins_can_share_link`, `only_admins_can_edit_info`, `require_admin_approval` on `public.chats` (backfill `owner_id` from active `created_by` else oldest `admin`/`member`; apply `OC-09` backfill; set open defaults for new rows).
   - Revoke direct `UPDATE(name, description, avatar_url) ON public.chats FROM authenticated` and drop `chats_update_admin_or_creator`.
   - Create `public.chat_invite_links` and `public.group_join_requests` with RLS and RPCs (`create_group_chat` extended with optional permission params, `update_group_info` with member-configurable edit check + permission toggles, `get_group_invite`, `rotate_group_invite`, `revoke_group_invite`, `join_group_via_invite`, `request_group_member_add`, `review_group_join_request`).
   - Enforce `OC-01` (`only owner can demote or remove an admin`) in `demote_chat_admin` & `remove_chat_member`; add `transfer_group_ownership`; update `handle_chat_member_delete` to maintain `chats.owner_id`; update `storage.objects` (`avatars` `chat-<id>/group-*`) to require `is_chat_member` AND (`is_group_owner_or_admin` OR `NOT only_admins_can_edit_info`).
2. **Channels:**
   - Create `public.channel_staff`, `public.channel_invitations` (direct privileges revoked from `authenticated`), `public.channel_feed_events` (published to `supabase_realtime`).
   - Backfill `channel_staff` (`'owner'`) and ensure `channel_followers` invariant (`OC-02`) across `create_channel(..., p_channel_id DEFAULT NULL)`, `appoint_channel_admin`, `remove_channel_admin`, `transfer_channel_ownership`, and `unfollow_channel` (rejecting while staff).
   - Enforce `OC-03` (`admin` edits/deletes own posts only; channel info/avatar/other posts/delete channel are `owner`-only). Remove follower/channel reaction writes from `set_message_reaction` and `reactions_insert_accessible_message`.
   - Update `reports_insert_own` (`OC-04`) to permit channel `admin` reporting while blocking `owner`.
   - Lock down `public.channels`, `public.messages` (`channel_id IS NOT NULL`), `public.file_uploads`, `public.channel_followers`, and `storage.objects` (`channel-media` & `avatars/chat-<channel_id>/channel-%`) to staff/own-row only; create `security_barrier` views (`channels_public`, `channel_invitations_sent`, `channel_invitations_received`, `message_media_public`) and RPCs (`get_channel_messages`, `get_channel_staff`, `send_channel_invitations`, `dismiss_channel_invitation`, `follow_channel(uuid, uuid)`, `authorize_channel_post_media_read`, `authorize_forwarded_channel_media_read`, `authorize_channel_avatar_read`).
3. **Communities:**
   - Extend `chat_member_role` (or community role model) with `'moderator'`; add `silenced_until`, `silenced_by`, `silence_reason` on `community_members`; add `write_policy` and `system_role` (`UNIQUE (community_id) WHERE system_role = 'announcements'`) on `public.chats`; create `community_announcement_writers`, `community_bans`, `community_audit_logs`.
   - Run `OC-10` pre-flight cardinality check on `'Avisos'` (`>1` aborts; `1` preserves chat/messages/memberships; `0` creates official announcements chat); update `create_community` to create `General` (`all`) + official announcements (`system_role = 'announcements'`, `admins`).
   - Implement `update_community_info` & `update_community_chat_info` (supporting `moderator` description edits only), `update_community_chat_write_policy`, `delete_community_chat`, `set_announcement_writer`, `appoint_community_moderator`, `remove_community_moderator` (clearing announcement grant), `transfer_community_ownership` (`OC-05`), `silence_community_member`, `unsilence_community_member`, `expel_community_member` (optional reason + optional bulk soft-delete + `community_bans`), `unban_community_member`, `moderate_delete_community_message` (`OC-06`, including departed-author check), audit logging (`OC-07`), and succession (`admin -> moderator -> member`).
   - Implement `serialize_chat_message_write()` `BEFORE INSERT` trigger and lock-ordered `forward_chat_message` (`communities -> chats -> community_members -> community_announcement_writers`, leaving `direct`/`self` lock-free).

- [ ] **Step 1:** Write failing comprehensive SQL suite `supabase/tests/shared_roles_permissions.sql` covering all allowed/denied cases, raw-read isolation, `OC-01`–`OC-10`, idempotent retries, and two-session lock ordering.
- [ ] **Step 2:** Run `pnpm test:db supabase/tests/shared_roles_permissions.sql` against the designated local test database and confirm expected failure before migration exists.
- [ ] **Step 3:** Author LF-normalized SQL migration(s) under `supabase/migrations/`, verify `node scripts/db-guard.mjs` CRLF/lint rules, and update `src/types/database.ts`.
- [ ] **Step 4:** Apply migration(s) to local test DB (`supabase db reset` / local apply) and run `pnpm test:db supabase/tests/shared_roles_permissions.sql` plus `supabase/tests/chat_settings.sql supabase/tests/novedades.sql supabase/tests/novedades_storage.sql supabase/tests/messages.sql supabase/tests/message_actions.sql` until all PASS.

---

### Task 2: `sign-channel-media` Edge Function & Client Media/Avatar Routing (TDD)

**Files:**
- Create: `supabase/functions/sign-channel-media/index.ts`
- Modify: `src/features/messages/lib/media.ts`
- Modify: `src/features/settings/hooks/useAvatar.ts`
- Test: `tests/channel-media-signing.test.ts` (unit + local Edge Function contract test against distinct local JWTs)

- [ ] **Step 1:** Write failing tests in `tests/channel-media-signing.test.ts` covering: (a) `userClient` JWT + `auth_mfa_satisfied` check before calling `authorize_*` RPCs, (b) `channel_avatar` bound to current `channels.avatar_url` (rejecting replaced/old paths and mismatched `channelId`), (c) `channel_post` vs `forwarded_chat` vs unrelated viewer (still-public original vs destination-only attachment), and (d) client routing in `media.ts` and `useAvatar.ts`.
- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/channel-media-signing.test.ts` and confirm failure.
- [ ] **Step 3:** Implement `supabase/functions/sign-channel-media/index.ts` (following `livekit-token/index.ts` two-client pattern) and update `media.ts` + `useAvatar.ts`.
- [ ] **Step 4:** Run unit tests and test the Edge Function locally against the designated local Supabase instance with distinct user JWTs (`staff`, `destination_member`, `unrelated_user`, `aal1_mfa_pending`), verifying PASS.

---

### Task 3: Shared Capabilities Engine, `MultiStepDialog` & Inline `PhotoEditorPanel` (TDD)

**Files:**
- Create: `src/features/roles/types.ts`
- Create: `src/features/roles/lib/permissions.ts`
- Create: `src/features/roles/components/MultiStepDialog.tsx`
- Create: `src/features/roles/components/PhotoEditorPanel.tsx`
- Create: `src/features/roles/components/GroupPermissionsControl.tsx`
- Modify: `src/features/settings/components/AvatarPickerModal.tsx` (reuse `PhotoEditorPanel` to avoid duplication)
- Modify: `src/styles/globals.css` (and/or dedicated `src/styles/roles-dialog.css` imported cleanly)
- Test: `tests/roles-permissions.test.ts`

- [ ] **Step 1:** Write failing unit tests in `tests/roles-permissions.test.ts` covering all pure capability evaluators for `group`, `channel`, `community`, and `community_chat` (including `OC-01`–`OC-07`, silenced users, departed authors, and invite share vs. rotate/revoke).
- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/roles-permissions.test.ts` and confirm failure.
- [ ] **Step 3:** Implement `src/features/roles/types.ts`, `permissions.ts`, `MultiStepDialog.tsx` (single native `<dialog>`, responsive `100dvh`, `aria-current="step"`, focus management, busy/Escape guard), `PhotoEditorPanel.tsx` (extracted from `AvatarPickerModal.tsx` + `useAvatarPicker.ts` for inline cropping without nested modals), and `GroupPermissionsControl.tsx`.
- [ ] **Step 4:** Run `node --experimental-strip-types --test tests/roles-permissions.test.ts` and verify PASS.

---

### Task 4: Groups — Permissions Control, Invite Link/QR, Admin Approval & Owner Protection

**Files:**
- Modify: `src/routes/_authenticated.chats.new-group.tsx`, `src/features/chats/hooks/useNewGroupPage.ts`, `useCreateGroupChat.ts`
- Modify: `src/features/chat-settings/components/GroupSettingsScreen.tsx`, `GroupMembersList.tsx`, `AddMembersModal.tsx`, `ChatOptionsMenu.tsx`, `ChatSettingsLayer.tsx`
- Create: `src/features/chat-settings/components/GroupInviteModal.tsx`, `GroupJoinRequestsSection.tsx`
- Modify: `src/features/chat-settings/hooks/useGroupSettings.ts`, `useGroupMembers.ts`, `useAddMembers.ts`, `useChatSettingsLayer.ts`, `src/features/chat-settings/lib/chatActions.ts`
- Modify: `src/features/messages/hooks/useChat.ts`, `useRealtimeMessages.ts`, `src/features/messages/lib/writePermissions.ts`, `src/features/chats/hooks/useChats.ts`, `src/features/chats/types.ts`
- Modify: `tests/chats.test.ts`, `tests/chat-settings.test.ts`

- [ ] **Step 1:** Update `tests/chats.test.ts` and `tests/chat-settings.test.ts` with failing tests for 5-permission group creation/editing, `OC-01` owner-only admin demote/remove, member-configurable edit/add/share rules, and `join_group_via_invite` vs `group_join_requests`.
- [ ] **Step 2:** Run `pnpm test:chats` and `pnpm test:chat-settings` and confirm expected failure.
- [ ] **Step 3:** Wire `GroupPermissionsControl` in `NewGroupPage` and `GroupSettingsScreen`, enforce `OC-01` in `GroupMembersList`, add `GroupInviteModal` (QR + copy + owner/admin-only rotate/revoke) and `GroupJoinRequestsSection` (approve/reject), and update `useChat`/`useChats`/`useRealtimeMessages` for `ownerId` and the 5 permission flags.
- [ ] **Step 4:** Re-run `pnpm test:chats` and `pnpm test:chat-settings` and verify PASS.

---

### Task 5: Channels — 3-Step Creation Dialog, Privacy Views, Invitations & Admin Reporting

**Files:**
- Modify: `src/features/novedades/components/channels/CreateChannelModal.tsx`, `src/features/novedades/hooks/channels/useCreateChannelDialog.ts`, `useCreateChannel.ts`
- Modify: `src/features/novedades/components/channels/ChannelInfoScreen.tsx`, `ChannelHeader.tsx`, `ChannelView.tsx`, `DiscoverChannelsSection.tsx`, `ChannelsSection.tsx`
- Modify: `src/features/novedades/hooks/channels/useChannelInfo.ts`, `useChannels.ts`, `useDiscoverChannels.ts`, `useChannelMessages.ts`, `useFollowChannel.ts`, `useChannelHeaderActions.ts`, `useChannelDeletion.ts`, `src/features/novedades/lib/channelChat.ts`, `src/features/novedades/types.ts`
- Create: `src/features/novedades/components/channels/ChannelStaffModal.tsx`, `ChannelInvitationsBanner.tsx`
- Modify: `src/features/chat-growth/components/ChannelInviteAdminModal.tsx`, `ChatGrowthHost.tsx`, `src/features/chat-growth/lib/growthConfig.ts`
- Modify: `src/features/chat-settings/components/ReportModal.tsx`, `src/features/messages/lib/actionMatrix.ts`
- Modify: `tests/novedades.test.ts`, `tests/chat-growth.test.ts`, `tests/public-reports` unit tests

- [ ] **Step 1:** Update `tests/novedades.test.ts` and `tests/chat-growth.test.ts` with failing tests for 3-step channel creation (deferred create, `p_channel_id` idempotency, selective invite retry, eligible-contacts-only filtering), removal of follower reactions, channel `admin` reporting without `blockUserId`, and sender/recipient invitation projections.
- [ ] **Step 2:** Run `pnpm test:novedades` and `node --experimental-strip-types --test tests/chat-growth.test.ts` and confirm failure.
- [ ] **Step 3:** Rebuild `CreateChannelModal` on `MultiStepDialog` + inline `PhotoEditorPanel`, migrate channel hooks/queries to `channels_public`, `get_channel_messages`, `channel_feed_events`, `channel_invitations_sent`, and `channel_invitations_received`, add staff management UI (`ChannelStaffModal` for `owner`), remove `blockUserId` from channel `ReportModal`, and enable `Report channel` for channel `admin`s.
- [ ] **Step 4:** Re-run `pnpm test:novedades` and `tests/chat-growth.test.ts` and verify PASS.

---

### Task 6: Communities — Enable Routes (`OC-08`), Roles, Moderation, Announcements & Audit Log

**Files:**
- Modify: `src/routes/_authenticated.tsx` (remove `"Coming soon"` gate on `/communities/*`)
- Modify: `src/features/communities/components/CommunityChatSidebar.tsx` (mount `CreateCommunityChatModal`), `CommunityInfoScreen.tsx`, `CommunitySettingsActions.tsx`, `CreateCommunityChatModal.tsx`, `CreateCommunityModal.tsx`, `CommunityChatView.tsx`
- Create: `src/features/communities/components/CommunityModerationModals.tsx` (Silence with `10m`/`1h`/`1d`/`1w`/custom, Expel with confirmation + optional reason + unchecked bulk delete, Blocked List, Audit Log, Ownership Transfer confirmation)
- Modify: `src/features/communities/hooks/*`, `src/features/communities/lib/communityApi.ts`, `communityActions.ts`, `communityDetails.ts`, `src/features/communities/types.ts`
- Modify: `src/features/chat-settings/components/GroupSettingsScreen.tsx`, `GroupMembersList.tsx` (community `moderator` description edits, role actions, staff-delete-message action)
- Modify: `src/features/messages/components/RestrictedComposerNotice.tsx`, `src/features/messages/lib/writePermissions.ts`, `src/features/messages/lib/outboxSync.ts`, `src/features/messages/lib/forwardTargets.ts`, `src/routes/_authenticated.chats.$chatId.tsx`
- Modify: `tests/communities.test.ts`, `tests/messages.test.ts`

- [ ] **Step 1:** Update `tests/communities.test.ts` and `tests/messages.test.ts` with failing tests for `moderator` role actions (description edits, departed-author deletion, read-only blocked list), `write_policy` 4 levels + official announcements exceptions, timed silence + `outboxSync` `42501` terminal handling, and ownership transfer to any member (`OC-05`).
- [ ] **Step 2:** Run `node --experimental-strip-types --test tests/communities.test.ts tests/messages.test.ts` and confirm failure.
- [ ] **Step 3:** Enable `/communities/*` in `_authenticated.tsx`, wire `CreateCommunityChatModal` in `CommunityChatSidebar.tsx`, implement community write-policy & announcement-writer controls, moderation modals, blocked list, staff-only audit log view, `RestrictedComposerNotice` silence state, and `moderator` description editing across community and child chats.
- [ ] **Step 4:** Re-run `tests/communities.test.ts` and `tests/messages.test.ts` and verify PASS.

---

### Task 7: Browser E2E Suites, Two-Session Concurrency & Full Verification

**Files:**
- Modify / Create: `tests/chat-settings-browser.mjs`, `tests/novedades-browser.mjs`, `tests/communities-browser.mjs`, `tests/chat-growth-browser.mjs`, `tests/public-reports-browser.mjs`, `tests/shared-roles-permissions-browser.mjs`
- Create: `tests/shared-roles-concurrency.mjs` (two-session Postgres concurrency checks for announcement-grant revocation, timed silence racing sends, and non-blocking `direct`/`group` sends)

- [ ] **Step 1:** Write and run `tests/shared-roles-permissions-browser.mjs` (desktop `1280x820` and mobile `390x844` on isolated Vite server) and update existing browser suites for new behaviors (`General` + `Avisos`, channel 3-step creation, inline photo editor, lost create / partial invite retry, follower-to-staff privacy, `OC-08` navigation + deep links).
- [ ] **Step 2:** Run all unit tests (`pnpm test`), typecheck (`pnpm typecheck`), production build (`pnpm build`), and `npx biome check` on all touched files.
- [ ] **Step 3:** Run real database SQL suites (`pnpm test:db supabase/tests/shared_roles_permissions.sql` and regression suites) and two-session concurrency checks (`tests/shared-roles-concurrency.mjs`) + local `sign-channel-media` Edge Function checks against distinct user JWTs.
- [ ] **Step 4:** Run `node scripts/db-guard.mjs` checks on new migrations, inspect `git log --oneline main..HEAD` and `git diff --stat main..HEAD`, and prepare the PIF Delivery Report (`.pif/inbox/shared-roles-permissions-delivery.md`) for Guardian audit without pushing or modifying remote environments.
