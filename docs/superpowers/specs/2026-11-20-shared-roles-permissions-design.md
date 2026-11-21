# Design: Unified Roles, Permissions & Configurable Creation Dialogs (Groups, Channels, Communities)

- **Date:** 2026-11-20 (Revision 4 — incorporates Guardian Round 3 targeted corrections on top of Revision 3 / `OC-01`–`OC-10`)
- **Task / Branch:** `shared-roles-permissions` (worktree `.worktrees/shared-roles-permissions` at `7a54131690ab4923f59f5ef26b1ee17e25fd6bba`)
- **Stage:** `G1` Design & Plan Deliverable (for Guardian G1 sign-off and Product Owner plan approval; no implementation or test execution has occurred yet)
- **Related Historical Requirements:** `FR-007`, `FR-009`, `FR-010`, `FR-011`

---

## 1. Executive Summary & Architectural Approach

SilverChat currently implements role and permission checks independently per space (`group`, `channel`, `community`, `community_chat`) with binary `admin`/`member` or single-`owner_id` models, ad-hoc client guards, and active server-side privacy/write gaps.

This design establishes:
1. **One configurable roles & capabilities model** (`src/features/roles/` + mirrored PostgreSQL `SECURITY DEFINER` helpers, RLS policies, column grants, `security_barrier` views, and lock-serialized RPCs) parameterized by space (`group`, `channel`, `community`, `community_chat`) with strict server enforcement.
2. **One configurable, accessible, mobile-friendly multi-step dialog shell** (`MultiStepDialog`) built over SilverChat's native `<dialog>` + `FocusTrap` + `MotionOverlay` primitives, embedding an inline photo crop/edit surface (no nested dialog) for the 3-step Channel creation flow.
3. **Full resolution of `OC-01`–`OC-08` and `OC-10`**, while **`OC-09` remains Guardian's recommended historical group backfill pending explicit Product Owner approval at plan approval**. All Round 2 and Round 3 findings are incorporated, including current public channel avatar signing bound to `(channelId, current avatar_url)`, end-user JWT authorization inside `sign-channel-media`, channel-attributed invitation delivery across all eligible contacts without disclosing existing follower/staff/dismissal state, forwarded-media access boundaries, unified deadlock-free locking order, and planned real-database + Edge Function verification suites.

---

## 2. Current vs. Desired Behavior

### 2.1 Groups (`chats.type = 'group'`)

| Dimension | Current Behavior (Verified) | Desired Behavior |
|---|---|---|
| **Roles** | `chat_member_role` (`admin` \| `member`) + `chats.created_by` (`0001`, `0011`). No true `owner`; `created_by` cannot be removed/demoted even after leaving and rejoining, and goes stale when `created_by` departs. | Three roles: `owner` (single, tracked via `chats.owner_id`), `admin`, `member`. **Only `owner` can demote or remove an `admin`** (`OC-01`). `owner` is protected from demotion/removal by anyone. Owner departure/account deletion runs deterministic succession (`admin` -> `member` by `joined_at ASC, user_id ASC`) updating `chats.owner_id`. |
| **Configurable permissions** | Only `only_admins_can_send` (`boolean`, default `false`, `20261119160000`), editable only after creation in `GroupSettingsScreen`. | Five configurable rules: (1) add members (`all` \| `admins`, default `all`), (2) share invite link/QR (`all` \| `admins`, default `all`), (3) send messages (`all` \| `admins`, default `all`), (4) edit ordinary group info (`all` \| `admins`, default `all`), (5) admin approval for member additions (`boolean`, default `false`). Defaults for new groups are independent of group size. |
| **Creation vs. Details UI** | `NewGroupPage` (`_authenticated.chats.new-group.tsx`) only collects name + members. `GroupSettingsScreen` shows only `only_admins_can_send`. | Same reusable `GroupPermissionsControl` component available both during group creation (`NewGroupPage`) and in `GroupSettingsScreen` (editable only by `owner`/`admin`). |
| **Adding members & approval** | `add_chat_members` (`0014`) requires `is_chat_admin`; no invite link/QR token; no join-approval workflow. | When `only_admins_can_add_members = false`, **active members of that specific group** can add users. When `require_admin_approval = true`, **only** a direct addition by an ordinary `member` creates a pending request (`group_join_requests`); additions by `owner`/`admin` and joins via Link/QR admit directly. |
| **Group info edits & raw-write discrepancy** | `update_group_info` RPC requires `is_chat_admin`, **but** `0002_rls_policies.sql` leaves `GRANT UPDATE(name,description,avatar_url) ON public.chats` + `chats_update_admin_or_creator` active, letting `created_by` bypass RPC validation via raw `PATCH`. `storage.objects` (`avatars`) restricts `chat-<id>/` uploads to `is_chat_admin`. | Revoke direct `UPDATE` on `public.chats` and drop `chats_update_admin_or_creator`. Route all ordinary group info edits (`name`, `description`, `avatar_url`) through `update_group_info`, which **always** requires `public.is_chat_member(p_chat_id, auth.uid())` AND (`is_group_owner_or_admin(p_chat_id, auth.uid())` OR `NOT only_admins_can_edit_info`). Update `storage.objects` `avatars` (`chat-<id>/...`) INSERT/UPDATE/DELETE policies identically so **only active members of that specific group** permitted to edit info (never outsiders or former members) can write `chat-<id>/group-*.webp`. |
| **Invite Link / QR** | `ChatGrowthCard` shows `/chats/${id}` to admins only when `userMessageCount === 0`, with no join-by-link token or QR modal. | Server-managed `chat_invite_links` created at group creation, `join_group_via_invite(token)` RPC, and QR rendering. **Sharing** the active invite link/QR requires `is_chat_member` AND (`is_group_owner_or_admin` OR `NOT only_admins_can_share_link`), gated via `chat_invite_links` RLS + `get_group_invite`. **Rotating or revoking** the invite link (`rotate_group_invite`, `revoke_group_invite`) is strictly `owner`/`admin`-only regardless of `only_admins_can_share_link`. |

### 2.2 Channels (`channels`)

| Dimension | Current Behavior (Verified) | Desired Behavior |
|---|---|---|
| **Roles & Follower Count (`OC-02`, `OC-03`)** | Single `channels.owner_id`; no `admin` role (`0001`, `0012`). Owner auto-follows in `channel_followers`. | `owner`, `admin` (`channel_staff`), and `follower`. **Owner and every admin are counted as followers in `channel_followers` exactly once per account** (`follower_count` invariant preserved on creation, admin appointment, ownership transfer, and blocking `unfollow_channel` while holding `owner`/`admin` office). `owner` and `admin`s publish; **admins manage their own posts only** (channel metadata edits and other authors' posts remain `owner`-only; no implicit pinning). Only `owner` appoints/removes `admin`s, deletes the channel, or transfers ownership to an existing `admin` (outgoing `owner` becomes `admin`). |
| **Follower Privileges** | `0012` & `channelChat.ts` allow followers to add/update `message_reactions`. | **Follower access is viewing + explicit contact invitations only** (no reaction-writing for followers). Remove reaction-writing from `set_message_reaction`, `reactions_insert_accessible_message`, `channelChat.ts`, and `actionMatrix.ts`. |
| **Identity Privacy & Reporting (`OC-04`)** | **Active leaks:** `channels_select_authenticated` (`USING (true)`) exposes `owner_id`; `ChannelInfoScreen` & `ChannelHeader` pass `blockUserId: c.owner_id` to `ReportModal`; `channel_followers_select` exposes followers to owner; `messages.sender_id` & `file_uploads.uploader_id` (`20261118000000`) are readable on channel posts. | `follower_count` is public. Staff (`owner` + `admin`s) see each other. **Followers & visitors cannot see any staff identity** (`owner_id`, `sender_id`, `uploader_id`, `channel_staff`, `storage.objects.owner`, or `blockUserId`). **Staff cannot see follower identities** (`channel_followers` `SELECT` restricted strictly to `user_id = auth.uid()`). **Channel `admin`s may report their own channel** (`ReportModal` enabled for `admin`, blocked only for `owner`, without exposing `blockUserId` for channel reports). |
| **Channel Creation Dialog** | `CreateChannelModal` is a single-step form with a separate nested `AvatarPickerModal` and creates immediately on submit. | Single responsive `MultiStepDialog` with 3 steps: (1) Public channel introduction & prohibited-content rules (explicit sexual content, drug sales, explicit violence, illegal content); (2) Name, generated/editable slug + availability check, optional description, and **inline prominent visual photo picker/cropper** (no nested modal); (3) Search/select **eligible contacts only** or skip. Create **only** on final confirmation or skip, with idempotent `p_channel_id` recovery and selective retry of failed invitations. |
| **Channel Invitations (`OC-04`)** | `ChannelInviteAdminModal` sends a single DM with `/channels/${id}` and closes; searches global users (`useUserSearch`); uses `"Join me as an admin"` copy; no tracking. | `owner`, `admin`s, and ordinary `follower`s (excluding visitors) can invite eligible contacts via `send_channel_invitations` without disclosing existing follower/staff status via eligibility filtering or delivery errors. **Channel-attributed delivery** (no personal sender ID/name on the received invitation, notification, or DM envelope) prevents staff recipients from inferring that an ordinary follower follows the channel. Only the sender sees acceptance through **that** invitation; private dismissal by the recipient remains indistinguishable from `pending` to the sender. |

### 2.3 Communities (`communities` & `chats.type = 'community_chat'`)

| Dimension | Current Behavior (Verified) | Desired Behavior |
|---|---|---|
| **Roles & Succession (`OC-05`)** | Only `admin` \| `member` (`community_members`) + `communities.owner_id`. Succession prefers `admin` -> `member` (`0014`). | Single `owner` (`communities.owner_id`) + `admin`, `moderator`, `member`. Community-wide roles sync across existing & future chats. Only `owner` deletes community, appoints/removes `admin`s, and transfers ownership **to any current member** (outgoing `owner` becomes `admin`). `owner`/`admin` appoint/remove `moderator`s. **`moderator` can edit both community description AND child `community_chat` descriptions** (name/photo remain `owner`/`admin` only). Succession on owner departure/account deletion prefers `admin` -> `moderator` -> `member` (`joined_at ASC, user_id ASC`). |
| **Initial & Official Chats (`OC-10`)** | `create_community` creates only `'General'` (open). No `system_role` identity. | `create_community` creates both `General` (open: `all`) and official announcements (`system_role = 'announcements'`, restricted to `owner` + `admin`s + individually granted `moderator`s). Both can be deleted. Later user-created chats use ordinary rules even with the same name. Legacy migration checks `Avisos` cardinality once (`1` -> preserve & mark; `0` -> create; `>1` -> flag/abort for review). |
| **Chat Write Permissions** | Binary `only_admins_can_send` boolean (`20261119160000`). | Ordinary community chats start open (`all`) and allow `owner`/`admin` to choose `owner_only`, `admins`, `moderators`, or `all`. Official announcements chat allows `owner` + `admin`s + individually granted `moderator`s only (`community_announcement_writers`), managed by `owner`/`admin`. Removing the `moderator` role clears the grant. |
| **Moderation, Blocked List & Audit (`OC-06`, `OC-07`)** | `remove_community_member` is `admin`-only; no timed silence, no `community_bans`, no staff deletion of others' messages, no audit log. | Hierarchy: `moderator` acts on `member` (and **may delete messages of departed authors**); `admin` acts on `member` & `moderator` (plus departed); `owner` acts on `admin`, `moderator`, `member` (plus departed). Timed silence (`10m`, `1h`, `1d`, `1w`, `custom`) is community-wide; any actor **currently** authorized over target can lift it. Expulsion blocks re-entry (`community_bans`) until `owner`/`admin` unbans (rejoining grants ordinary `member`), always requires **explicit confirmation even when bulk message deletion is unchecked**, and offers optional reason + unchecked-by-default community-wide message deletion. `moderator` has **read-only** access to the blocked list. Staff-readable `community_audit_logs` records all role changes, silences/lifts, expulsions/unbans, publishing permissions, ownership transfers, and staff/bulk message deletions **without copying deleted content**. |
| **Navigation & Routes (`OC-08`)** | `src/routes/_authenticated.tsx` gates `/communities/*` behind `"Coming soon"`, and `CommunityChatSidebar.tsx` does not mount `CreateCommunityChatModal`. | Remove `"Coming soon"` gate in `src/routes/_authenticated.tsx` and wire `CreateCommunityChatModal` + moderation/audit/blocked-list surfaces across all build modes, keeping auth and membership enforcement intact. |

---

## 3. Role & Action Matrices

### 3.1 Group Matrix (`chats.type = 'group'`)

*Precondition: Every member-level action in this table requires **active membership in that specific group (`is_chat_member(chat_id, auth.uid())`)**; outsiders and former members are always denied regardless of open toggles.*  
*Legend: **Always** = permitted for active `owner`/`admin` regardless of toggles; **Configurable** = permitted for active `member` when `only_admins_can_* = false` (new-group default), denied when `true`; **Denied** = server-rejected (`42501`/`P0001`).*

| Action | `owner` | `admin` | `member` | Outsider / Former Member | Server Enforcement |
|---|---|---|---|---|---|
| Send / forward messages into group | Always | Always | Configurable (`NOT only_admins_can_send`) | Denied | `messages_insert` RLS + `serialize_chat_message_write()` + `forward_chat_message` RPC |
| Edit ordinary info (`name`, `description`, `avatar_url`) & upload group avatar | Always | Always | Configurable (`NOT only_admins_can_edit_info`) | Denied | `update_group_info` RPC + `storage.objects` (`avatars`) RLS (`is_chat_member` AND (`is_group_owner_or_admin` OR `NOT only_admins_can_edit_info`)); direct `UPDATE` on `chats` revoked |
| Read / share **existing** invite link & QR | Always | Always | Configurable (`NOT only_admins_can_share_link`) | Denied | `get_group_invite` RPC + `chat_invite_links` RLS (`is_chat_member` AND (`is_group_owner_or_admin` OR `NOT only_admins_can_share_link`)) |
| Rotate / revoke invite link | Always | Always | **Denied** | Denied | `rotate_group_invite` / `revoke_group_invite` RPCs (`is_group_owner_or_admin` only) |
| Add members directly | Always | Always | Configurable (`NOT only_admins_can_add_members`); if `require_admin_approval = true`, creates pending join request | Denied | `add_chat_members` / `request_group_member_add` RPC (`FOR UPDATE` on `chats`) |
| Join via valid Invite Link / QR | N/A | N/A | N/A | Direct admit if token valid, not blocked, and `< 256` members (even if `require_admin_approval = true`) | `join_group_via_invite(token)` RPC |
| Approve / reject pending join requests | Always | Always | Denied | Denied | `review_group_join_request` RPC |
| Change the 5 group permissions | Always | Always | Denied | Denied | `update_group_info` / `update_group_permissions` RPC |
| Promote `member` -> `admin` | Always | Always | Denied | Denied | `promote_chat_admin` RPC |
| Demote `admin` -> `member` (`OC-01`) | Always (cannot demote self without transfer/other admin) | **Denied on `admin` & `owner`** | Denied | Denied | `demote_chat_admin` RPC (enforces `is_group_owner` when target is `admin`) |
| Remove `admin` (`OC-01`) | Always | **Denied on `admin` & `owner`** | Denied | Denied | `remove_chat_member` RPC (enforces `is_group_owner` when target is `admin`) |
| Remove `member` | Always | Always | Denied | Denied | `remove_chat_member` RPC |
| Transfer group ownership to `admin` | Always | Denied | Denied | Denied | `transfer_group_ownership` RPC |
| Leave group | Always (succession `admin` -> `member` by `joined_at ASC, user_id ASC`, or deletes if last) | Always | Always | Denied | `chat_members_delete_own` + `handle_chat_member_delete` |

### 3.2 Channel Matrix (`channels`)

| Action | `owner` | `admin` | `follower` | `visitor` (non-follower) | Server Enforcement & Privacy Boundary |
|---|---|---|---|---|---|
| View channel metadata, current avatar & `follower_count` | Yes | Yes | Yes | Yes | `channels_public` view (`owner_id` omitted) + `sign-channel-media` (`authorize_channel_avatar_read` bound to `channels.avatar_url`) |
| Read posts & media | Yes | Yes | Yes | Yes | `get_channel_messages` (`sender_id` & `uploader_id` forced `NULL` for non-staff) + `sign-channel-media` |
| Follow / Mute / Mark unread | Auto-followed (`OC-02`); mute/unread allowed | Auto-followed (`OC-02`); mute/unread allowed | Yes | Follow only | `follow_channel`, `channel_followers` RLS (`user_id = auth.uid()` strictly) |
| Unfollow channel (`OC-02`) | **Denied while owner** | **Denied while admin** | Yes | N/A | `unfollow_channel` rejects if `is_channel_staff(channel_id, auth.uid())` |
| React to channel posts | **Denied** | **Denied** | **Denied** | **Denied** | `set_message_reaction` & `reactions_insert_accessible_message` reject `channel_id IS NOT NULL` |
| Publish posts & upload `channel-media` | Yes | Yes | Denied | Denied | `messages_insert` RLS + `storage.objects` (`channel-media`) RLS (`is_channel_staff`) |
| Edit (within 15m) / delete **own** posts (`OC-03`) | Yes | Yes | Denied | Denied | `guard_message_update` + `delete_channel_post` RPC |
| Delete **other author's** post (`OC-03`) | Yes | **Denied** | Denied | Denied | `delete_channel_post` RPC (`owner` or own `sender_id`) |
| Edit channel info (`name`, `slug`, `description`, `avatar_url`) (`OC-03`) | Yes | **Denied** | Denied | Denied | `update_channel_info` RPC (`is_channel_owner`) |
| View staff list (`owner` + `admin`s) | Yes | Yes | **Denied (Hidden)** | **Denied (Hidden)** | `get_channel_staff` RPC & `channel_staff` RLS (`is_channel_staff`) |
| View follower list / identities | **Denied (Hidden)** | **Denied (Hidden)** | **Denied (Hidden)** | **Denied (Hidden)** | `channel_followers` RLS (`user_id = auth.uid()` only) |
| Appoint / remove `admin`s | Yes | Denied | Denied | Denied | `appoint_channel_admin` / `remove_channel_admin` RPCs |
| Transfer ownership to an existing `admin` | Yes (outgoing becomes `admin`, both remain in `channel_followers`) | Denied | Denied | Denied | `transfer_channel_ownership` RPC (`FOR UPDATE` on `channels`) |
| Delete channel | Yes | Denied | Denied | Denied | `delete_channel` RPC (`is_channel_owner`) |
| Invite eligible contacts (`OC-04`) | Yes | Yes | Yes | **Denied** | `send_channel_invitations` RPC (requires `is_channel_staff` OR `is_channel_follower`; never leaks recipient's follower/staff status) |
| Receive channel-attributed invitation without personal sender | **Yes (eligible contact)** | **Yes (eligible contact)** | **Yes (eligible contact)** | **Yes (eligible contact)** | `channel_invitations_received` view + in-app invite notification (**omits `sender_id` & `sender_role`**; no DM row); recipient can dismiss privately without notifying sender |
| See if contact accepted **via own invitation** (`OC-04`) | **Own sent rows only (`pending` \| `accepted`)** | **Own sent rows only (`pending` \| `accepted`)** | **Own sent rows only (`pending` \| `accepted`)** | N/A | `channel_invitations_sent` (`sender_id = auth.uid()`, maps `dismissed` -> `pending`); independent `follow_channel` leaves status `pending` |
| Report channel (`OC-04`) | Denied | **Yes** | Yes | Yes | `reports_insert_own` RLS (`NOT is_channel_owner`); `ReportModal` never receives/shows `blockUserId` |

### 3.3 Community Matrix (`communities`)

| Action | `owner` | `admin` | `moderator` | `member` | Server Enforcement |
|---|---|---|---|---|---|
| Edit community `name` & `avatar_url` | Yes | Yes | Denied | Denied | `update_community_info` RPC + `storage.objects` (`avatars`) RLS |
| Edit community `description` | Yes | Yes | **Yes** | Denied | `update_community_info` RPC (`moderator` allowed only when `p_name IS NULL AND p_avatar_url IS NULL`) |
| Edit child `community_chat` `name` & `avatar_url` | Yes | Yes | Denied | Denied | `update_community_chat_info` / `update_community_chat_avatar` RPCs |
| Edit child `community_chat` `description` | Yes | Yes | **Yes** | Denied | `update_community_chat_info` RPC (`moderator` allowed only for `p_description`) |
| Create / delete community chats (incl. General & Official Announcements) | Yes | Yes | Denied | Denied | `create_community_chat`, `delete_community_chat` RPCs |
| Configure ordinary chat `write_policy` (`owner_only`, `admins`, `moderators`, `all`) | Yes | Yes | Denied | Denied | `update_community_chat_write_policy` RPC |
| Grant / revoke moderator write permission on Official Announcements | Yes | Yes | Denied | Denied | `set_announcement_writer` RPC + `community_announcement_writers` |
| Appoint / remove `admin` | Yes | Denied | Denied | Denied | `promote_community_admin` / `demote_community_admin` RPCs |
| Appoint / remove `moderator` | Yes | Yes | Denied | Denied | `appoint_community_moderator` / `remove_community_moderator` RPCs (clears announcement grant) |
| Transfer community ownership (`OC-05`) | Yes (**to any current member**; outgoing becomes `admin`) | Denied | Denied | Denied | `transfer_community_ownership` RPC |
| Delete community | Yes | Denied | Denied | Denied | `delete_community` RPC |
| Add members directly | Yes | Yes | Denied | Denied | `join_community(uuid, uuid)` RPC (rejects banned users) |
| Expel target (confirmation required; optional reason; unchecked bulk delete) | Yes -> `admin`, `moderator`, `member` | Yes -> `moderator`, `member` | Yes -> `member` only | Denied | `expel_community_member` RPC + `community_bans` |
| View blocked/expelled list (`OC-06`) | Yes | Yes | **Yes (read-only)** | Denied | `community_bans` RLS (`is_community_staff`) |
| Permit re-entry / unban (`OC-06`) | Yes | Yes | **Denied** | Denied | `unban_community_member` RPC (`is_community_admin_or_owner`) |
| Silence target community-wide (`10m`, `1h`, `1d`, `1w`, `custom`) | Yes -> `admin`, `moderator`, `member` | Yes -> `moderator`, `member` | Yes -> `member` only | Denied | `silence_community_member` RPC |
| Lift active silence | Anyone **currently** authorized over target | Anyone **currently** authorized over target | Anyone **currently** authorized over target | Denied | `unsilence_community_member` RPC (re-checks live role rank) |
| Delete someone else's message (`OC-06`) | Yes -> `admin`, `moderator`, `member`, **departed** | Yes -> `moderator`, `member`, **departed** | Yes -> `member`, **departed** (never active `admin`/`owner`) | Denied | `moderate_delete_community_message` RPC |
| View staff audit log (`OC-07`) | Yes | Yes | Yes | **Denied (Hidden)** | `community_audit_logs` RLS (`is_community_staff`) |

### 3.4 Community Chat Writing Matrix (`chats.type = 'community_chat'`)

| Chat Kind / `write_policy` | `owner` | `admin` | `moderator` | `member` | Silenced User (`silenced_until > now()`) |
|---|---|---|---|---|---|
| Ordinary (`all` — default for `General` & new chats) | Yes | Yes | Yes | Yes | **Denied** |
| Ordinary (`moderators`) | Yes | Yes | Yes | Denied | **Denied** |
| Ordinary (`admins`) | Yes | Yes | Denied | Denied | **Denied** |
| Ordinary (`owner_only`) | Yes | Denied | Denied | Denied | **Denied** |
| Official Announcements (`system_role = 'announcements'`) | Yes | Yes | **Only if in `community_announcement_writers`** | Denied | **Denied** |

---

## 4. Identity Isolation, Media/Avatar Signing Contract, Projections, Realtime & Concurrency

### 4.1 Channel Metadata, Messages & Realtime Privacy

1. **Channel Metadata (`channels` vs. `channels_public`):**
   - Replace `channels_select_authenticated` (`USING (true)`) on `public.channels` with `channels_select_staff` (`USING (public.is_channel_staff(id, auth.uid()))`). Only staff can `SELECT` `public.channels` (including `owner_id`).
   - Create `public.channels_public` (`WITH (security_invoker = false, security_barrier = true)`) exposing `(id, name, slug, description, avatar_url, is_verified, follower_count, last_message_id, last_message_at, last_message_preview, created_at, updated_at)` — **no `owner_id`**. Update `useChannels`, `useDiscoverChannels`, `useChannelInfo`, and slug checks to query `channels_public` + `get_channel_viewer_role` / `get_channel_info`.
   - `ReportModal` (`ChannelInfoScreen.tsx`, `ChannelHeader.tsx`): remove `blockUserId: c.owner_id` for channel targets so non-owners never learn or block the creator.

2. **Channel Messages & Realtime (`messages` vs. `get_channel_messages` + `channel_feed_events`):**
   - Because `public.messages` is in `supabase_realtime`, any `postgres_changes` subscriber allowed by `messages_select` receives the full row including `sender_id`.
   - Restrict `messages_select` on `public.messages` where `channel_id IS NOT NULL` strictly to `public.is_channel_staff(channel_id, auth.uid())`. Non-staff receive **zero** `public.messages` rows or Realtime events for channels.
   - Non-staff read channel posts via `get_channel_messages(p_channel_id, p_before_at, p_before_id)` (`SECURITY DEFINER`, `SET search_path = ''`), which forces `sender_id := NULL` whenever `NOT is_channel_staff(p_channel_id, auth.uid())` (and redacts deleted posts).
   - Live updates for non-staff use `public.channel_feed_events (id uuid, channel_id uuid, message_id uuid, event_type text, created_at timestamptz)` populated by trigger on `messages` (`channel_id IS NOT NULL`) with **zero user UUID columns**, published to `supabase_realtime` (`SELECT` allowed to `authenticated`), invalidating `useChannelMessages` queries.

### 4.2 Channel Avatars, Post Attachments & Forwarded Media Contract

1. **`public.file_uploads` isolation:**
   - Remove `file_uploads_select_public_channel` and restrict `file_uploads_select_message_media` and `file_uploads_select_novedades_thumbnail` on `public.file_uploads` so rows with `bucket = 'channel-media'` (and `avatars/chat-<channel_id>/channel-*`) are **readable directly ONLY when `uploader_id = auth.uid()` or `is_channel_staff(<channel_id>, auth.uid())`**. Non-staff channel viewers and destination-chat members of a forwarded channel post **cannot** `SELECT uploader_id FROM public.file_uploads`.
   - Expose a `security_barrier` view `public.message_media_public` (`security_invoker = false`) AND embed safe upload metadata in `get_chat_messages` / `get_channel_messages` returning `(id, bucket, path, original_filename, mime_type, size_bytes, width, height, duration_seconds, status, created_at, completed_at)` with `uploader_id` **forced to `NULL`** when `bucket = 'channel-media'` and caller is not channel staff (authorized only when `EXISTS` an accessible non-deleted channel post **or** `can_access_chat_message(m.id)` for a forwarded chat message referencing `file_upload_id` or `media_thumbnail_upload_id`).
   - In `get_chat_messages`, when `forwarded_from_message_id` points to a `channel_id` source message, never expose the source channel post's `sender_id` to non-staff destination members.

2. **`storage.objects` (`channel-media` and channel `avatars`) isolation:**
   - `channel-media` paths use `<channel_id>/<upload_uuid>.<ext>` and channel avatar paths (`saveGroupAvatar(..., "channel")`) use `chat-<channel_id>/channel-<ts>-<uuid>.webp` (never `<user_id>`).
   - Drop `channel_media_select_public` and `channel_media_select_forwarded` on `storage.objects`; restrict `storage.objects` `SELECT` for `channel-media` and `avatars/chat-<channel_id>/channel-%` strictly to `is_channel_staff(...)`. Non-staff users (including discovery card viewers, invite recipients, destination-chat members of forwarded channel posts, and unrelated users) cannot call `storage.from(...).list(...)` or `SELECT owner FROM storage.objects`.

3. **End-User-Authorized Signing Endpoint (`supabase/functions/sign-channel-media/index.ts`):**
   - Following the two-client pattern in `supabase/functions/livekit-token/index.ts`:
     - Construct `userClient` (`SUPABASE_ANON_KEY` + caller's `Authorization` header), call `userClient.auth.getUser()`, and verify `userClient.rpc("auth_mfa_satisfied")` returns `true`.
     - **Execute all authorization RPCs on `userClient`** (so `auth.uid()` and `public.can_access_chat_message(...)` execute under the verified end user's real JWT identity and MFA state, never under `service_role`):
       - **Case A — Public Channel Post Attachment / Thumbnail** (`{ kind: "channel_post", uploadId, channelId }`): `userClient.rpc("authorize_channel_post_media_read", { p_upload_id, p_channel_id })` verifies `auth_mfa_satisfied()` and `EXISTS` a non-deleted (`NOT deleted_for_everyone AND deleted_at IS NULL`) `messages` row with `channel_id = p_channel_id` and (`file_upload_id = p_upload_id OR media_thumbnail_upload_id = p_upload_id`), returning `{ bucket: 'channel-media', path }` only.
       - **Case B — Forwarded Channel Media in Destination Chat** (`{ kind: "forwarded_chat", uploadId, messageId }`): `userClient.rpc("authorize_forwarded_channel_media_read", { p_upload_id, p_message_id })` runs `public.can_access_chat_message(p_message_id)` **as the end user (`auth.uid()`)** and verifies `messages.id = p_message_id` has `chat_id IS NOT NULL`, `NOT deleted_for_everyone`, and references `p_upload_id` (`file_upload_id` or `media_thumbnail_upload_id`), returning `{ bucket: 'channel-media', path }` only.
       - **Case C — Current Public Channel Avatar** (`{ kind: "channel_avatar", channelId, path }`): `userClient.rpc("authorize_channel_avatar_read", { p_channel_id, p_path })` verifies `auth_mfa_satisfied()`, verifies `p_path ~ ('^chat-' || p_channel_id::text || '/channel-[a-zA-Z0-9-]+\.webp$')`, and verifies `EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id AND avatar_url = p_path)` — **strictly bound to that channel and its current active avatar file** (replaced/old avatar paths return `403`).
     - **Reserve `adminClient` (`SUPABASE_SERVICE_ROLE_KEY`) exclusively** to call `adminClient.storage.from(authorized.bucket).createSignedUrl(authorized.path, ttlSeconds, downloadOpt)` after user-scoped authorization succeeds, returning `{ signedUrl }` only (no `uploader_id`, `storage.objects.owner`, or listing data).
   - Client integration: `useMediaUrl` (`src/features/messages/lib/media.ts`) calls `sign-channel-media` for `bucket === "channel-media"` (passing `channelId` or `messageId`), and `<Avatar>` / `useAvatarUrl` (`src/features/settings/hooks/useAvatar.ts`) calls `sign-channel-media` (`kind: "channel_avatar"`) when rendering a channel avatar (`^chat-<uuid>/channel-`).

### 4.3 Channel Invitations — Channel-Attributed Delivery & Separate Projections (`OC-04`)

1. **Privacy guarantees:**
   - Because only channel participants (`owner`, `admin`, `follower`) can send invitations and every participant counts as a follower (`OC-02`), exposing `sender_id` or `sender_name` on a received invitation, notification, or DM envelope would let a staff recipient identify an ordinary follower even before acceptance.
   - Similarly, filtering out contacts who already follow/staff the channel during Step 3/invite selection or returning `"already following"` / `"is staff"` delivery errors would disclose follower/staff status to the sender.
   - Finally, privately dismissing a received invitation must **not** reveal an extra recipient action to the sender.
2. **Data model & separate projections:**
   - Base table `public.channel_invitations (id uuid PRIMARY KEY, channel_id uuid NOT NULL, sender_id uuid NOT NULL, recipient_id uuid NOT NULL, status text NOT NULL CHECK (status IN ('pending', 'accepted', 'dismissed')), created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz, UNIQUE (channel_id, sender_id, recipient_id))` — **no `sender_role` column**.
   - **Revoke all direct privileges (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) on `public.channel_invitations` from `authenticated`.**
   - Expose two distinct `security_barrier` views (`security_invoker = false`):
     - `public.channel_invitations_sent` (`WHERE sender_id = auth.uid()`): exposes `(id, channel_id, recipient_id, CASE WHEN status = 'accepted' THEN 'accepted' ELSE 'pending' END AS status, created_at, accepted_at)` — lets each sender see acceptance **through their own specific invitation only**; a recipient's private dismissal maps to `'pending'`.
     - `public.channel_invitations_received` (`WHERE recipient_id = auth.uid() AND status = 'pending'`): exposes `(id, channel_id, status, created_at)` — **completely omits `sender_id`, `sender_name`, `sender_role`, and `accepted_at`**!
   - **Delivery & Notification path:** Invitations are **never** written as a personal DM row in `public.messages` (`chat_id`) and never trigger a sender-named notification. `send_channel_invitations` verifies caller is `is_channel_staff` OR `is_channel_follower`, checks only `is_contact(auth.uid(), recipient_id)` and `NOT is_blocked_either_way`, **does NOT exclude or error on existing followers/staff**, writes to `public.channel_invitations`, and optional Realtime/in-app notification signals carry only `{ invitation_id, channel_id, channel_name, channel_slug, channel_avatar_url }`, rendering `"You were invited to follow '{channel.name}'"` (identical regardless of sender role).
   - **Accept vs. Dismiss vs. Independent Follow:**
     - `follow_channel(p_channel_id, p_invitation_id DEFAULT NULL)` inserts `(p_channel_id, auth.uid())` into `channel_followers`, and updates `channel_invitations SET status = 'accepted', accepted_at = now()` **only** when `p_invitation_id IS NOT NULL AND id = p_invitation_id AND channel_id = p_channel_id AND recipient_id = auth.uid() AND status = 'pending'`. Independent follows (`p_invitation_id IS NULL`) never modify invitation status.
     - `dismiss_channel_invitation(p_invitation_id)` (`recipient_id = auth.uid()`) sets `status = 'dismissed'`; hidden from `channel_invitations_received`, while `channel_invitations_sent` continues projecting `'pending'`.

### 4.4 Deadlock-Free Concurrency & Common Lock Acquisition Order

To prevent interleaving races and deadlocks between message sends/forwards and community/group mutations:

1. **Canonical Global Lock Order:**
   1. `public.communities` (ordered by `id ASC` when multiple)
   2. `public.chats` (ordered by `id ASC` when multiple)
   3. `public.community_members` (ordered by `(community_id, user_id)`)
   4. `public.chat_members` / `public.community_announcement_writers`
2. **Exact Lock Pairs:**
   - **Unrelated `direct` and `self` chats:** `serialize_chat_message_write()` returns immediately on `type IN ('direct', 'self')` with **zero** `communities` or `chats` row locks, preserving existing direct/self concurrency and behavior untouched.
   - **`group` send / `forward_chat_message`:** Acquires `FOR SHARE` on `public.chats WHERE id = ...` (and `forward_chat_message` locks target `chats` `ORDER BY id ASC FOR UPDATE` as in `0010`/`20261119160000`), conflicting directly with `update_group_info` / `add_chat_members` / `remove_chat_member` (`FOR UPDATE` on `chats`).
   - **`community_chat` send (`serialize_chat_message_write()` `BEFORE INSERT` trigger) & `forward_chat_message`:**
     - `serialize_chat_message_write()` acquires in strict order:
       1. `SELECT 1 FROM public.communities WHERE id = v_community_id FOR SHARE`
       2. `SELECT * FROM public.chats WHERE id = NEW.chat_id FOR SHARE`
       3. `SELECT * FROM public.community_members WHERE community_id = v_community_id AND user_id = NEW.sender_id FOR SHARE`
       Then checks `silenced_until > now()`, `write_policy`, and `community_announcement_writers` inside those held locks.
     - `forward_chat_message` resolves all distinct `community_id`s across `p_chat_ids`, locks `public.communities` (`ORDER BY id ASC FOR SHARE`), then locks `public.chats` (`ORDER BY id ASC FOR UPDATE`), then locks `public.community_members` (`ORDER BY community_id, user_id FOR SHARE`), then validates `write_policy` / `silenced_until` / `community_announcement_writers` before inserting.
   - **Community-wide & Chat-level Mutations (matching global order):**
     - `silence_community_member` / `unsilence_community_member`: `communities` (`FOR SHARE`) -> `community_members` (`FOR UPDATE` on target row — **conflicts directly** with send/forward's `FOR SHARE` on `community_members`).
     - `set_announcement_writer` & `update_community_chat_write_policy`: `communities` (`FOR SHARE`) -> `chats` (`FOR UPDATE` on target chat — **conflicts directly** with send/forward's `FOR SHARE` on `chats`).
     - `remove_community_moderator` / `expel_community_member` / `promote_community_admin` / `demote_community_admin` / `transfer_community_ownership`: `communities` (`FOR UPDATE`) -> `chats` (`ORDER BY id ASC FOR UPDATE` if modifying child chat/announcement rows) -> `community_members` (`FOR UPDATE`).

---

## 5. Affected Source & Data Paths

### 5.1 Database, Edge Functions & Types
- New LF-normalized SQL migrations in `supabase/migrations/`:
  - `public.chats`: `owner_id`, `only_admins_can_add_members`, `only_admins_can_share_link`, `only_admins_can_edit_info`, `require_admin_approval`, `write_policy`, `system_role` + partial unique index `(community_id) WHERE system_role = 'announcements'`. Revoke direct `UPDATE` on `public.chats`; drop `chats_update_admin_or_creator`.
  - `public.chat_invite_links`, `public.group_join_requests`.
  - `public.channel_staff`, `public.channel_invitations` (revoked from `authenticated`), `public.channel_feed_events`, views `channels_public`, `channel_invitations_sent`, `channel_invitations_received`, `message_media_public`, RPCs `get_channel_messages`, `get_channel_staff`, `send_channel_invitations`, `dismiss_channel_invitation`, `appoint_channel_admin`, `remove_channel_admin`, `transfer_channel_ownership`, `delete_channel`, `authorize_channel_post_media_read`, `authorize_forwarded_channel_media_read`, `authorize_channel_avatar_read`.
  - `public.community_members` (`role` extended with `'moderator'`, `silenced_until`, `silenced_by`, `silence_reason`), `public.community_announcement_writers`, `public.community_bans`, `public.community_audit_logs`, trigger `serialize_chat_message_write()`, moderation/succession/audit RPCs.
- Edge Function: `supabase/functions/sign-channel-media/index.ts`.
- `src/types/database.ts`: updated to match all new tables, views, columns, enums, and RPC signatures.

### 5.2 Frontend & Routes
- **Shared module (`src/features/roles/`):**
  - Pure capability matrix evaluators (`group`, `channel`, `community`, `community_chat`) + `MultiStepDialog` responsive wizard shell + `PhotoEditorPanel` (extracted from `src/features/settings/components/AvatarPickerModal.tsx` & `useAvatarPicker.ts`) + `GroupPermissionsControl`.
- **Groups:**
  - `src/routes/_authenticated.chats.new-group.tsx`, `src/features/chats/hooks/useNewGroupPage.ts`, `useCreateGroupChat.ts`.
  - `src/features/chat-settings/components/GroupSettingsScreen.tsx`, `GroupMembersList.tsx`, `AddMembersModal.tsx`, `ChatOptionsMenu.tsx`, `ChatSettingsLayer.tsx`, plus Group Invite Link/QR & Join Requests UI.
  - `src/features/chat-settings/hooks/useGroupSettings.ts`, `useGroupMembers.ts`, `useAddMembers.ts`, `useChatSettingsLayer.ts`, `src/features/chat-settings/lib/chatActions.ts`.
  - `src/features/messages/lib/writePermissions.ts`, `actionMatrix.ts`, `forwardTargets.ts`, `outboxSync.ts`, `src/features/messages/hooks/useChat.ts`, `useRealtimeMessages.ts`, `src/routes/_authenticated.chats.$chatId.tsx`, `src/features/chats/hooks/useChats.ts`, `src/features/chats/types.ts`.
- **Channels:**
  - `src/features/novedades/components/channels/CreateChannelModal.tsx`, `useCreateChannelDialog.ts`, `useCreateChannel.ts`.
  - `src/features/novedades/components/channels/ChannelInfoScreen.tsx`, `ChannelHeader.tsx`, `ChannelView.tsx`, `DiscoverChannelsSection.tsx`, `ChannelsSection.tsx`, `src/features/novedades/hooks/channels/*`, `src/features/novedades/lib/channelChat.ts`, `src/features/novedades/types.ts`, `src/features/messages/lib/media.ts`, `src/features/settings/hooks/useAvatar.ts`.
  - `src/features/chat-growth/components/ChannelInviteAdminModal.tsx`, `ChatGrowthHost.tsx`, `src/features/chat-growth/lib/growthConfig.ts`.
  - `src/features/chat-settings/components/ReportModal.tsx` (allow channel `admin` reporting; omit `blockUserId` for channels).
- **Communities (`OC-08` enabled across all build modes):**
  - `src/routes/_authenticated.tsx` (remove `"Coming soon"` gate on `/communities/*`), `src/features/communities/components/CommunityChatSidebar.tsx` (mount `CreateCommunityChatModal`).
  - `src/features/communities/components/CommunityInfoScreen.tsx`, `CommunitySettingsActions.tsx`, `CreateCommunityChatModal.tsx`, `CreateCommunityModal.tsx`, `CommunityChatView.tsx`, plus Blocked List, Audit Log, Timed Silence, Expulsion, and Ownership Transfer modals.
  - `src/features/communities/hooks/*`, `src/features/communities/lib/communityApi.ts`, `communityActions.ts`, `communityDetails.ts`, `src/features/communities/types.ts`.
  - `src/features/messages/components/RestrictedComposerNotice.tsx`.

---

## 6. Migration, Backfill & Compatibility Strategy

1. **Existing Groups (`OC-09` — Guardian Recommendation Pending Explicit PO Approval at Plan Approval):**
   - **Owner backfill:** Set `chats.owner_id` to `created_by` if `created_by` is currently in `chat_members` (ensuring `role = 'admin'`), else oldest `admin` (`joined_at ASC, user_id ASC`), else oldest `member`.
   - **Permissions backfill:**
     - Preserve stored `only_admins_can_send` unchanged.
     - Set `require_admin_approval = false`.
     - **Guardian-recommended historical default for existing groups:** backfill `only_admins_can_add_members = true`, `only_admins_can_share_link = true`, `only_admins_can_edit_info = true` (preserving `0011`/`0014` admin-only enforcement on `add_chat_members`, `update_group_info`, and `avatars` Storage).
     - **Historical discrepancy noted:** `0002_rls_policies.sql` left `GRANT UPDATE(name,description,avatar_url)` on `chats` (`chats_update_admin_or_creator`) allowing `created_by` raw `PATCH` updates bypassing `update_group_info`. Revoking direct `chats` `UPDATE` closes that discrepancy.
     - **Newly created groups:** default to open (`false` for all 4 `only_admins_can_*` flags and `false` for `require_admin_approval`), independent of size.
2. **Existing Channels (`OC-02`):**
   - Populate `channel_staff` (`'owner'`) from `channels.owner_id` where non-null, and ensure `channel_followers` contains `(channel_id, owner_id)` (`ON CONFLICT DO NOTHING`) so `follower_count` matches `count(channel_followers)`.
3. **Existing Communities & `Avisos` (`OC-10`):**
   - **Pre-flight cardinality check:** Assert no community has `> 1` chat matching `lower(btrim(name)) = 'avisos'` (raise explicit exception / flag duplicate rows for review rather than silently assigning one).
   - Where `count = 1`: preserve that chat's `id`, messages, and memberships; set `system_role = 'announcements'`, `write_policy = 'admins'`, `only_admins_can_send = true`.
   - Where `count = 0`: create one official announcements chat (`name = 'Avisos'`, `system_role = 'announcements'`, `write_policy = 'admins'`, `only_admins_can_send = true`) and enroll current `community_members`.
   - Run this legacy identification **once** in the migration; later renames, deletions, or new chats named `"Avisos"` never alter `system_role`.
   - Backfill remaining `community_chat` rows: `system_role = NULL`, `write_policy = CASE WHEN only_admins_can_send THEN 'admins' ELSE 'all' END`.

---

## 7. Accessible, Responsive Single-Dialog Creation Flow & Retry Recovery

1. **Shared `MultiStepDialog` (`Modal` + `MotionOverlay` + `FocusTrap`):**
   - Single native `<dialog>` (no nested `<dialog>`), responsive sizing (`w-[calc(100%-1rem)] sm:max-w-lg`, `max-h-[calc(100dvh-1.5rem)]`), sticky step header (`aria-current="step"`), scrollable step body (`overscroll-contain`), sticky footer with 44x44+ touch targets and `safe-area-inset-bottom`.
   - Focus moves cleanly to the active step heading/first control on step transitions; `Escape` and close are guarded while `busy` or during active creation/upload.
2. **Channel Creation 3-Step Configuration:**
   - **Step 1 (Introduction):** Public visibility, follower/staff privacy guarantees, and explicit prohibition of explicit sexual content, drug sales, explicit violence, and illegal content.
   - **Step 2 (Details + Inline Photo Editor):** Name (`1..100`), generated/editable slug (`[a-z0-9-]{3,50}`) with debounced availability check against `channels_public`, optional description (`<=500`), and **inline `PhotoEditorPanel`** (prominent visual avatar preview + cropper + zoom + camera/upload/clipboard paste/remove, all inside the same dialog). Zero DB writes yet.
   - **Step 3 (Eligible Contacts / Skip):** Search & multi-select strictly scoped to **eligible contacts** (`useDirectContacts`, excluding self and blocked users; no global user search, no exclusion/error leak for contacts who already follow or staff the channel). Actions: `Back`, `Skip & create channel`, `Create & send invitations`.
3. **Lost-Response & Partial-Invite Recovery:**
   - Before invoking `create_channel`, the dialog holds a client-generated `channelId = crypto.randomUUID()` and per-recipient `invitationId` UUIDs.
   - `create_channel(..., p_channel_id)` is idempotent: if `p_channel_id` already exists owned by `auth.uid()`, it returns `p_channel_id` without creating a duplicate channel or failing on slug uniqueness.
   - If the create response is lost and the user clicks Confirm again, retrying with the same `p_channel_id` recovers cleanly without creating a second channel.
   - If channel creation succeeds (`createdChannelId` set) and photo upload or a subset of invitations fail: Steps 1–2 lock, the channel is preserved, per-contact delivery status (`Sent` vs `Failed`) is shown, and `Retry failed invitations` re-invokes `send_channel_invitations` **only** for failed recipients using their stable `invitationId` UUIDs (`ON CONFLICT DO NOTHING`), preventing duplicate invitations.

---

## 8. Planned Verification Criteria & Acceptance Checks (Not Yet Executed)

*Note: All checks below are **planned (`NOT_RUN`)** acceptance criteria for implementation; no migrations, application code, Edge Functions, or tests have been executed during G1 discovery/design.*

### 8.1 Planned Real Database Authorization, Edge Function & Concurrency Suites
Executed against the designated local test database (`SUPABASE_DB_URL`) using real PostgreSQL roles and JWT claims (`request.jwt.claims` + `SET LOCAL ROLE authenticated`), noting that `scripts/run-db-tests.mjs` defaults to `calls.sql` when invoked without arguments:
- **Primary new SQL suite:** `pnpm test:db supabase/tests/shared_roles_permissions.sql`
- **Affected regression SQL suites:** `pnpm test:db supabase/tests/chat_settings.sql supabase/tests/novedades.sql supabase/tests/novedades_storage.sql supabase/tests/messages.sql supabase/tests/message_actions.sql`
- **Local Edge Function contract checks:** Invoke `supabase/functions/sign-channel-media/index.ts` locally against the designated local Supabase instance with distinct user JWTs (`staff`, `destination_member`, `unrelated_user`, `aal1_mfa_pending`), verifying end-user `auth.uid()` enforcement inside `authorize_*` RPCs.
- **Required database & Edge Function test coverage:**
  - **Groups:** Full `owner`/`admin`/`member` matrix across all 5 permissions; `admin` blocked from demoting/removing `admin` or `owner` (`OC-01`); **outsider and former member rejected on all member-configurable actions (info edit, avatar upload/delete, invite read/share, add members) even when all group permissions are open**; rotation/revocation rejected for ordinary `member` while active link sharing allowed when open; raw `PATCH public.chats` rejected; `require_admin_approval` creates `group_join_requests` only for ordinary `member` direct add, while Link/QR and `owner`/`admin` admit directly; legacy `created_by` who departed/rejoined lacks `owner` authority; `owner` departure updates `chats.owner_id`.
  - **Channels & Media/Avatar Privacy:** `owner`/`admin` follower-count invariant (`OC-02`); `admin` edits/deletes own posts only (`OC-03`); follower reaction writes rejected; **direct SQL reads** by follower/visitor on `public.channels`, `public.messages`, `public.file_uploads`, `public.channel_staff`, and `storage.objects` (`channel-media` and `avatars/chat-<channel_id>/channel-%`) return `0 rows` / `permission denied`, while `channels_public` & `get_channel_messages` return `NULL` for `owner_id`, `sender_id`, `uploader_id`; **current channel avatar** signing succeeds via `sign-channel-media` (`kind: "channel_avatar"`) for non-staff discovery cards & invite previews, while replaced/old avatar paths and mismatched `channelId`s return `403` and expose zero `uploader_id`/`owner`; **direct SQL reads** by owner/admin on `channel_followers` return only their own row; **ordinary follower inviting a staff contact** produces channel-attributed `channel_invitations_received` & notification with **zero** `sender_id`/`sender_name` and zero DM row, does not leak existing follower/staff status, and private dismissal leaves `channel_invitations_sent.status = 'pending'` until explicit acceptance via that `p_invitation_id`; **forwarded channel media contract** tested across distinct scenarios: (a) non-staff destination chat member signs & views forwarded media + thumbnail without learning `uploader_id` or `storage.objects.owner`, (b) unrelated viewer is allowed on a **still-public original** via `kind: "channel_post"` (zero identity metadata) while **denied (`403`)** on `kind: "forwarded_chat"` for the destination chat, and (c) unrelated viewer is **denied (`403`)** on both endpoints when the attachment is accessible **only through the destination chat** (original channel post deleted); channel `admin` can report own channel while `owner` cannot (`OC-04`); lost-response retry with same `p_channel_id` and `invitationId` creates zero duplicate channels or invitations.
  - **Communities:** `create_community` creates `General` (`all`) + official announcements (`system_role = 'announcements'`, `admins`); duplicate `Avisos` cardinality check aborts cleanly; `0` and `1` `Avisos` backfill preserves messages/IDs (`OC-10`); renaming/deleting official announcements does not grant `system_role` to later chats named `"Avisos"`; `moderator` edits community & child-chat descriptions only (rejected on name/avatar); all 4 `write_policy` levels + `community_announcement_writers` enforced; removing `moderator` clears announcement grant; timed silence + lift (including post-promotion lift rejection for peer moderator); expulsion blocks re-entry until `owner`/`admin` unbans, rejoining as `member`; `moderator` reads `community_bans` (`SELECT` allowed) but cannot unban, and deletes departed authors' messages separately tested from active `admin`/`owner` messages (`OC-06`); `community_audit_logs` records all events including message/bulk deletions without copying message text (`OC-07`) and returns `0 rows` to `member` & outsiders; voluntary transfer to any member (`OC-05`) and automatic succession `admin -> moderator -> member`.
  - **Two-session concurrency checks (`tests/*-concurrency.mjs` / parallel pg sessions):** (a) announcement-grant revocation (`set_announcement_writer` or `remove_community_moderator`) racing a moderator send/forward, (b) community-wide silence racing a send/forward, and (c) unrelated `direct` and `group` sends proceeding with existing behavior without waiting on community locks.

### 8.2 Planned Unit & Mocked Browser Suites (`tests/*.test.ts` & `tests/*-browser.mjs`)
- **Unit (`pnpm test`):** Shared role/capability evaluators (`group`, `channel`, `community`, `community_chat`), `MultiStepDialog` step/validation/recovery state machine, `forwardTargets`, `outboxSync` terminal failure on `42501` (silence/write-policy), `ReportModal` channel payload & target matrix.
- **Browser (`tests/*-browser.mjs` on isolated Vite server, desktop + mobile viewports):**
  - Groups: identical 5-permission control in creation & Group details; approval queue vs QR/link join; `admin` demote/remove blocked for non-owner; share vs rotate/revoke separation; outsider/former member denied.
  - Channels: 3-step `MultiStepDialog` (intro rules -> inline cropper/preview -> eligible-contacts-only selector/skip), zero creation before final confirm, simulated lost create response + partial invite failure preserving channel and retrying only failed contacts; discovery cards & invite previews rendering current channel avatar as non-staff (and handling replacement); ordinary follower inviting staff contact without exposing sender, and private dismissal keeping sender status `pending`; channel `admin` report flow without `blockUserId`; no follower reaction controls.
  - Communities (`OC-08`): direct navigation & deep links to `/communities`, `/communities/$communityId`, `/communities/$communityId/info`, `/communities/$communityId/chats/$chatId` across build modes; `General` + official announcements; `write_policy` & moderator exception controls; timed silence + expiry notice; expulsion confirmation (both with bulk delete unchecked and checked); blocked list (read-only for moderator, unban for admin/owner); ownership transfer confirmation; staff-only audit log view.
- **Static checks:** `pnpm typecheck` and `npx biome check` on all touched files.

---

## 9. Pending Approvals Before Implementation

- **Guardian G1 sign-off** on this Revision 4 design specification (`docs/superpowers/specs/2026-11-20-shared-roles-permissions-design.md`) and implementation plan (`docs/superpowers/plans/2026-11-20-shared-roles-permissions-plan.md`).
- **Product Owner approval** of the Implementation Plan and explicit confirmation of **`OC-09`** (Guardian's recommended historical group backfill preserving admin-only `add`/`share`/`edit` for existing groups while using open defaults for new groups).
