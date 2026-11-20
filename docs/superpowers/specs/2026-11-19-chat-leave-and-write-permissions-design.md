# Design: Leave-Chat System Feedback & Admin-Only Write Permissions

**Date:** 2026-11-19
**Status:** Ready for owner approval (builder check completed)
**Branch / Worktree:** `feat/chat-leave-and-write-permissions` (`.worktrees/chat-leave-and-write-permissions`)

## 1. Intent & Why

Two visibility gaps currently confuse participants in SilverChat conversations:

1. **Silent member departures:** When a member leaves a group (`useLeaveGroup`) or leaves a community (`leave_community` / `handle_community_member_delete`), or is removed from either, `chat_members` rows are deleted without recording any event in the timeline. Remaining members have no indication in the chat that someone left.
2. **Missing write-restriction feedback:** `Conversation` (`src/routes/_authenticated.chats.$chatId.tsx`) only hides `Composer` when `details.readOnly` is true (currently used solely for incoming pending direct-chat requests). There is no schema support, RLS enforcement, admin toggle, or composer-replacement notice for chats where only admins may send messages (such as admin-restricted groups or community announcement chats).

This feature adds end-to-end support across PostgreSQL (triggers, schema, RLS, RPCs, Realtime) and the React UI so member departures are clearly recorded in group and community chats, and non-admin members in admin-only chats see clear feedback instead of an active message input.

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- Emit a `system` message into `public.messages` whenever a member leaves a `group` or `community_chat` (including when leaving a community removes them from its child chats), as long as the chat remains active after the departure.
- Render departure system messages clearly inside the timeline (`SystemMessage` / `SystemPill`) and chat list previews (`computeChatDisplay`) in the viewer's active language (`"'{member}' left the chat"` / `"'{member}' salió del chat"`).
- Add `only_admins_can_send` (`boolean NOT NULL DEFAULT false`) on `public.chats`, enforced in both `messages_insert` RLS and `forward_chat_message` RPC, and configurable by group admins via `update_group_info` (and optionally at creation time via `create_community_chat`).
- Add a group admin setting toggle in `GroupSettingsScreen` (`context === "group"`) so group admins can toggle write restrictions. Keep `community_chat` write-restriction management scoped to the data/RLS/read-UI layers while `/communities/*` remains behind the `"Coming soon"` gate in `src/routes/_authenticated.tsx`.
- Replace `<Composer />` in `Conversation` with a clear non-interactive footer notice (`"Only admins are allowed to chat here"` / `"Solo los administradores pueden enviar mensajes aquí"`) when the user is a non-admin member of an `only_admins_can_send` chat, and update live via Supabase Realtime when the rule changes.
- Keep channels (`ChannelView`, `channels`, `channel_followers`) excluded from the composer-replacement notice and from public unfollow system messages.

### Non-Goals
- **Channels (`channels` / `channel_followers`):** Channels are one-to-many public broadcasts where follower lists are private. Emitting `"'{member}' left the chat"` on `unfollow_channel` would leak subscriber identities and conflicts with `messages_insert` / `channels` schema. Channels remain excluded from both leave notices and the admin-only composer notice (channels already render either `ChannelFollowFooter` or `null` for non-owners).
- **Auto-creating a second `"Announcements"` chat in `create_community`:** Existing tests (`tests/communities-browser.mjs`) assert that `create_community` creates exactly one initial chat (`General`). Instead, `create_community_chat` and `chats.only_admins_can_send` provide the full capability whenever an Announcements chat is created or toggled, without altering `create_community` behavior or touching any maintenance/gating work on Communities.
- **Applying migrations to remote Supabase:** Writing the local SQL migration file and updating `src/types/database.ts` are in scope; pushing or executing SQL against remote Supabase databases is out of scope without explicit owner authorization.

### Anti-Goals
- **Silent failures in the composer:** Do not leave the `<Composer />` mounted and only reject on send for restricted non-admins; replace the input with the explanatory notice, while also enforcing the restriction in RLS and failing cleanly (not retrying offline forever) if a race occurs.
- **Unlocalized raw strings locked to one user's language:** Do not store a hardcoded Spanish-only or English-only string that ignores the reader's language setting when rendered in the UI.

## 3. Approaches Considered

- **Option A — End-to-end DB + Settings + UI (Selected):** Add a SQL migration (`handle_chat_member_delete` system message insertion, `chats.only_admins_can_send` column + `messages_insert` RLS + `update_group_info` / `create_community_chat` support + `chats` Realtime publication), update `src/types/database.ts`, wire `useChat` / `useRealtimeMessages` / `Conversation` / `GroupSettingsScreen` / `SystemMessage` / `computeChatDisplay`, and add unit + browser tests.
  - *Trade-off:* Touches SQL migrations and TypeScript DB types, requiring careful verification against existing triggers and tests, but delivers genuine multi-user persistence, Realtime updates, and security enforcement.
- **Option B — Client-only UI preparation:** Add UI props/components for `onlyAdminsCanSend` and client-side leave helper without DB schema, trigger, or RLS changes.
  - *Rejected:* Remaining members would never see leave records or real-time permission changes, and non-admins could still bypass client checks.

## 4. Architecture & Detailed Design

### 4.1 Database Migration (`supabase/migrations/20261119160000_leave_system_messages_and_write_permissions.sql`)

#### A. Leave System Messages
- Update `public.handle_chat_member_delete()` (used by `chat_members_after_delete`):
  - Keep existing `type = 'group'` cascade-delete (when `remaining_members = 0`) and admin-succession logic untouched.
  - Note that `handle_community_member_delete()` already deletes `chat_members` rows for all child chats in a community, which triggers `chat_members_after_delete` for each `community_chat`.
  - For both `type = 'group'` and `type = 'community_chat'`: if the chat still exists (`EXISTS (SELECT 1 FROM public.chats WHERE id = OLD.chat_id)` — i.e., it was not just deleted because `remaining_members = 0` or because the parent community was deleted), look up the departing member's display name from `public.profiles` (`COALESCE(NULLIF(btrim(display_name), ''), username, 'Member')` using `OLD.user_id`).
  - Also check if the parent community still exists (`community_id IS NULL OR EXISTS (SELECT 1 FROM public.communities WHERE id = v_chat.community_id)`), and avoid inserting during full chat/community cascade deletion (`DELETE FROM public.chats` / `DELETE FROM public.communities` fires `ON DELETE CASCADE` on `chat_members`; guarding on `EXISTS (SELECT 1 FROM public.chats WHERE id = OLD.chat_id)` plus `BEFORE`/`AFTER` check: wait — in PostgreSQL `ON DELETE CASCADE`, parent row deletion occurs before child `AFTER DELETE` triggers, so `SELECT 1 FROM public.chats WHERE id = OLD.chat_id` already returns `false` when the chat or community itself is being deleted!).
  - Insert into `public.messages (chat_id, sender_id, type, content)` with:
    - `sender_id = NULL` (existing `handle_new_message()` already handles `NEW.sender_id IS NULL` when creating `message_receipts` for remaining members and updating `chats.last_message_*`).
    - `type = 'system'`
    - `content`:
      - If `auth.uid() IS NULL OR auth.uid() = OLD.user_id` (voluntary leave or profile deletion): `format('''%s'' left the chat', v_name)`
      - Wait: what if an admin removed the member (`remove_chat_member` / `remove_community_member`, where `auth.uid() <> OLD.user_id`)? Using `format('''%s'' was removed from the chat', v_name)` vs `format('''%s'' left the chat', v_name)`: we will emit `format('''%s'' left the chat', v_name)` for self-leave / profile deletion and `format('''%s'' was removed from the chat', v_name)` when `auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id` (and translate both in UI!). That way every departure is clearly visible and accurate.
  - Note on `compute_message_preview`: `0003_business_logic.sql` already returns `COALESCE(m.content, '')` for `type = 'system'`, so `chats.last_message_preview` and `last_message_at` update automatically via `handle_new_message()`.
  - Note on `chat_members` cascade during `DELETE FROM public.communities` / `DELETE FROM public.chats` / `handle_community_member_delete`: `handle_community_member_delete()` deletes `chat_members` BEFORE checking `v_remaining_count = 0` and deleting the community! If the last member of a community leaves, `handle_community_member_delete()` runs `DELETE FROM public.chat_members` first (while the community and chats still exist), and only afterward deletes the empty community (which cascades the chats). That's harmless (the messages cascade-delete milliseconds later in the same transaction), and `SELECT count(*) > 0 FROM public.chat_members WHERE chat_id = OLD.chat_id` ensures we don't even bother inserting a system message if 0 members remain in that chat!

#### B. Admin-Only Write Permission (`only_admins_can_send`)
- `ALTER TABLE public.chats ADD COLUMN only_admins_can_send boolean NOT NULL DEFAULT false;`
- Add check constraint: `ALTER TABLE public.chats ADD CONSTRAINT chats_only_admins_can_send_group_check CHECK (NOT only_admins_can_send OR type IN ('group', 'community_chat'));`
- Keep `only_admins_can_send` excluded from direct table `GRANT UPDATE` on `public.chats` (matching existing security design where `update_group_info` is `SECURITY DEFINER`).
- **Update `messages_insert` RLS policy on `public.messages`** (preserving all existing conditions from `0003_business_logic.sql` and `0002_rls_policies.sql`):
  - For `chat_id IS NOT NULL`, require:
    `NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.only_admins_can_send) OR public.is_chat_admin(chat_id, auth.uid())`
- **Update `public.forward_chat_message(p_message_id uuid, p_chat_ids uuid[], p_message_ids uuid[])`**:
  - Because `forward_chat_message` (`0010_message_actions.sql`) is `SECURITY DEFINER`, it bypasses `messages_insert` RLS. Update its per-target membership check (`WHERE c.id = target AND c.status = 'active' AND cm.user_id = auth.uid() AND cm.archived_at IS NULL`) to also require `(NOT c.only_admins_can_send OR cm.role = 'admin')`, rejecting non-admin forwards into restricted chats with `'Only admins can send messages in this chat'`.
- **Update `public.update_group_info`**:
  - Keep `0014_communities.sql`'s `type = 'group'` restriction intact (`-- Membership/info changes for a community must use its own RPCs`).
  - Add `p_only_admins_can_send boolean DEFAULT NULL` to the existing function signature (dropping the old 4-arg signature and replacing in a single transaction, re-applying `REVOKE ALL` / `GRANT EXECUTE ON FUNCTION public.update_group_info(uuid, text, text, text, boolean) TO authenticated`, `OWNER TO postgres`).
  - Update `only_admins_can_send = COALESCE(p_only_admins_can_send, only_admins_can_send)`.
- **Update `public.create_community_chat`**:
  - Add `p_only_admins_can_send boolean DEFAULT false` so community creation flows can mark an Announcements chat as admin-only when Communities is enabled, while keeping existing 3-arg callers in `communityApi` and `tests/communities.test.ts` untouched.
- **Realtime:** Add `public.chats` to `supabase_realtime` publication (`IF NOT EXISTS ... ALTER PUBLICATION supabase_realtime ADD TABLE public.chats`), so connected clients receive `UPDATE` events when `only_admins_can_send` (or group info) changes.

### 4.2 Localization & Display of System Messages

- Add formatting helpers in `src/features/messages/lib/systemMessageText.ts` (reusable by both `SystemMessage.tsx` and `computeChatDisplay.ts`):
  - Parse `^'(.+)' left the chat$` →
    - `en`: `'{name}' left the chat`
    - `es`: `'{name}' salió del chat`
  - Parse `^'(.+)' was removed from the chat$` →
    - `en`: `'{name}' was removed from the chat`
    - `es`: `'{name}' fue eliminado del chat`
  - Fall back to the raw `content` string for any unrecognized `system` message content.
- Update `src/features/messages/components/content/SystemMessage.tsx` to format `message.content` using `useMessageText().language` and the helper.
- Update `src/features/chats/utils/computeChatDisplay.ts` (`resolveMessagePreview`) so when `type === "system"` (or `chat.lastMessageType === "system"`), `computeChatDisplay` translates known leave/remove system previews into `language` (`en` / `es`) just like media previews.

### 4.3 Write-Permission Model & UI

- **Types & Data Fetching (`src/types/database.ts`, `src/features/messages/types.ts`, `src/features/messages/hooks/useChat.ts`):**
  - Add `only_admins_can_send: boolean` to `chats` Row/Insert/Update in `src/types/database.ts`.
  - Add `onlyAdminsCanSend: boolean` to `ChatDetails` (`src/features/messages/types.ts`), populated from `chat.data?.only_admins_can_send ?? false` in `useChat.ts` (and `false` in `channelChat.ts`).
  - Derive helper `isWriteRestricted(details: Pick<ChatDetails, "type" | "onlyAdminsCanSend" | "own" | "channelMode">): boolean` returning `true` when `!details.channelMode && (details.type === "group" || details.type === "community_chat") && details.onlyAdminsCanSend && details.own?.role !== "admin"`.
- **Realtime Updates (`src/features/messages/hooks/useRealtimeMessages.ts` & `src/features/chats/hooks/useChats.ts`):**
  - In `useRealtimeMessages.ts`, subscribe to `postgres_changes` `UPDATE` events on `public.chats` filtered by `id=eq.${chatId}` and call `refresh()` so `useChat` invalidates immediately when an admin changes `only_admins_can_send` (or name/description).
  - In `useChats.ts`, subscribe to `postgres_changes` `UPDATE` events on `public.chats` so `ForwardModal` and chat list metadata stay synchronized when `only_admins_can_send` changes.
- **Conversation Footer (`src/routes/_authenticated.chats.$chatId.tsx` & `src/styles/messages.css`):**
  - In `Conversation`:
    - When `details.readOnly` is `true` (pending incoming direct request): keep `footer={null}` (unchanged).
    - Else when `isWriteRestricted(details)` is `true`: render a styled footer notice component (e.g., `<RestrictedComposerNotice />` inside `ConversationShell`'s `footer`) displaying an icon (`Lock` or `ShieldAlert`) and localized text `"Only admins are allowed to chat here"` / `"Solo los administradores pueden enviar mensajes aquí"` with `role="status"`.
    - Else: render `<Composer ... />`.
  - Leave `ChannelView.tsx` completely untouched.
- **Message Actions & Forwarding (`src/features/messages/lib/actionMatrix.ts`, `src/features/chats/types.ts`, `src/features/chats/hooks/useChats.ts`, `src/features/messages/hooks/useForwardDialog.ts`):**
  - Non-admin members in an `only_admins_can_send` chat still have `readOnly = false` (only the composer is restricted); pass `writeRestricted` into `getAvailableActions` so `"reply"` is excluded when the user cannot send in this chat (avoiding focusing a non-existent composer), while `"react"`, `"copy"`, `"forward"`, and `"delete_for_me"` remain available.
  - Extend `Chat` (`src/features/chats/types.ts`) and `fetchChats()` (`src/features/chats/hooks/useChats.ts`, which already queries `chat_members.role`) with `onlyAdminsCanSend?: boolean` and `canSend?: boolean` (false when `(c.type === "group" || c.type === "community_chat") && c.only_admins_can_send && ownRole !== "admin"`), and filter out `!c.canSend` (when `c.canSend === false`) in `useForwardDialog.ts` so restricted chats cannot be selected as forward targets.
- **Admin Toggle in Settings (`src/features/chat-settings/components/GroupSettingsScreen.tsx`, `useGroupSettings.ts`):**
  - In `useGroupSettings.ts`: extend `save` patch to accept `only_admins_can_send?: boolean` and pass `p_only_admins_can_send: patch.only_admins_can_send` to `supabase.rpc("update_group_info", ...)` when `context === "group"`.
  - In `GroupSettingsScreen.tsx`: when `context === "group" && admin` (strictly `chat.type === "group"`, respecting `0014_communities.sql` where `update_group_info` is group-only and `community_chat` settings live under `/communities/$communityId/info` which is currently in maintenance), render a Switch row inside a permissions card:
    - Label: `say("Only admins can send messages", "Solo los administradores pueden enviar mensajes")`
    - Helper description: `say("Members can still read messages and react.", "Los miembros aún pueden leer mensajes y reaccionar.")`
    - Bound to `chat.onlyAdminsCanSend`, saving immediately via `hook.save({ only_admins_can_send: checked })` with inline error feedback if the RPC fails.
- **Outbox / Send Race Handling (`src/features/messages/lib/outboxSync.ts`):**
  - Ensure PostgreSQL RLS error code `42501` (e.g., if a user sends right as an admin enables `only_admins_can_send`) is treated as a terminal send failure (`failed`) rather than an offline/network retry loop. (Check `isOfflineOrNetworkError` in `outbox.ts` to confirm `42501` already fails cleanly; if not, keep it terminal.)

### 4.4 Decisions & What's Left to the Builder

- **Decisions made here:**
  - `system` messages use `sender_id = NULL` and English canonical strings (`'{name}' left the chat` / `'{name}' was removed from the chat`) translated on the client for both timeline pills and chat-list previews.
  - `only_admins_can_send` lives on `public.chats` (default `false`), managed for groups via `update_group_info` (leaving `0014_communities.sql`'s `type = 'group'` boundary and `_authenticated.tsx`'s `"Coming soon"` gate untouched), enforced by both `messages_insert` RLS and `forward_chat_message` RPC, filtered in `ForwardModal`, and synced live via `supabase_realtime`.
  - Channels remain excluded from both features.
- **Left to the builder:**
  - Exact visual styling tokens/classes for the footer notice and permissions switch card using existing `src/components/ui/` primitives (`Switch`, `CardSurface`, `messages.css` variables).
  - Exact unit test and Playwright browser test structure (using disposable Vite env + mocked Supabase routes, consistent with `tests/*-browser.mjs`).

## 5. Verification Plan

- Unit tests (`node --experimental-strip-types --test`):
  - Test `systemMessageText` parsing/localization (`en`/`es`, quoted names, apostrophes in names, fallback).
  - Test `computeChatDisplay` preview formatting for `system` leave/remove messages.
  - Test `isWriteRestricted` helper, `getAvailableActions` when `writeRestricted` is true, and `ForwardModal` target filtering (`canSend === false`).
- Browser verification (`tests/*-browser.mjs` against isolated Vite dev server):
  - Group chat showing `"'{member}' left the chat"` / `"'{member}' salió del chat"` system pill and preview.
  - Group admin toggling "Only admins can send messages" in `GroupSettingsScreen`.
  - Non-admin member seeing `"Only admins are allowed to chat here"` replacing the composer (including live update), and admin still seeing the composer.
  - Channel view continuing to follow existing `ChannelView` footer rules without composer-replacement notice.
- Typecheck & Lint (`pnpm typecheck`, `pnpm lint`).
