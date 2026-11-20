# Leave-Chat System Feedback & Admin-Only Write Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record visible `system` messages when members leave group or community chats, enforce `only_admins_can_send` in SQL/RLS/Realtime, allow group admins to toggle it in settings, and replace the composer with an explanatory notice for unauthorized writers (excluding channels).

**Architecture:** A single PostgreSQL migration extends `handle_chat_member_delete()` to insert `sender_id = NULL, type = 'system'` departure messages, adds `chats.only_admins_can_send` with `messages_insert` RLS + `forward_chat_message` enforcement + `update_group_info` / `create_community_chat` support + `supabase_realtime` publication for `chats`. On the client, shared helpers translate canonical departure messages in both `SystemMessage` and `computeChatDisplay`, `useChat` / `useChats` / `useRealtimeMessages` sync write permissions live, `Conversation` renders `<RestrictedComposerNotice />` instead of `<Composer />` for restricted non-admins, and `GroupSettingsScreen` exposes the toggle for group admins.

**Tech Stack:** PostgreSQL / Supabase (SQL migrations, RLS, `SECURITY DEFINER` RPCs, Realtime), TypeScript, React 19, TanStack Query & Router, Node built-in test runner (`node --experimental-strip-types --test`), Playwright (`playwright-core`).

**Spec:** [2026-11-19-chat-leave-and-write-permissions-design.md](../specs/2026-11-19-chat-leave-and-write-permissions-design.md)

## Global Constraints

- Work strictly inside the isolated worktree `.worktrees/chat-leave-and-write-permissions` on branch `feat/chat-leave-and-write-permissions`; leave the primary checkout clean on `main`.
- New SQL migration files in `supabase/migrations/` MUST use LF-only (`\n`) line endings (never CRLF) so `tests/db-guard.test.ts` passes.
- Do NOT run migrations or modify schemas/data on remote Supabase without explicit owner authorization.
- Preserve existing `ChannelView` (`src/features/novedades/components/channels/ChannelView.tsx`), `0014_communities.sql`'s `update_group_info` `type = 'group'` restriction, and the `"Coming soon"` `/communities/*` route gate in `src/routes/_authenticated.tsx`.
- All repository artifacts (code, comments, identifiers, SQL messages, tests) use English; user-facing UI strings provide `(en, es)` pairs via `useMessageText` / `Language`.
- Commit once after full verification at completion (do not create microcommits per TDD step, per repository `AGENTS.md`).

## Review Focus

- Departing member display name contains apostrophes (e.g., `O'Connor`) or fallback `'Member'` when profile is gone during account deletion.
- Non-admin user already inside an open conversation or `/chats` list when an admin enables `only_admins_can_send` (Realtime `UPDATE` on `public.chats` must swap `<Composer />` to `<RestrictedComposerNotice />` and hide the chat from `ForwardModal` without page reload).
- Non-admin attempts to send a message right before Realtime arrives or via `forward_chat_message`: PostgreSQL `42501` / RLS error must fail immediately (`localStatus: "failed"`) without triggering infinite offline retry loops.
- Admin in an `only_admins_can_send` group retains `<Composer />`, `"reply"` context menu action, and forward target availability in `ForwardModal`.
- Channels (`ChannelView`) remain unaffected: no composer-replacement notice for followers and no public unfollow system messages.

---

### File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261119160000_leave_system_messages_and_write_permissions.sql` | Add `chats.only_admins_can_send`, update `messages_insert`, `forward_chat_message`, `update_group_info`, `create_community_chat`, `handle_chat_member_delete`, and `supabase_realtime` |
| `src/types/database.ts` | Reflect `chats.only_admins_can_send` and updated RPC arg types |
| `src/features/messages/lib/systemMessageText.ts` | Parse and localize canonical leave/remove system message text (`en`/`es`) |
| `src/features/messages/components/content/SystemMessage.tsx` | Format `system` timeline pills via `formatSystemMessageText` |
| `src/features/chats/utils/computeChatDisplay.ts` | Format `system` chat-list previews via `formatSystemMessageText` |
| `src/features/messages/lib/writePermissions.ts` | `isWriteRestricted(details)` pure predicate |
| `src/features/messages/types.ts` | Add `onlyAdminsCanSend: boolean` to `ChatDetails` |
| `src/features/messages/hooks/useChat.ts` | Map `only_admins_can_send` into `ChatDetails.onlyAdminsCanSend` |
| `src/features/novedades/lib/channelChat.ts` | Set `onlyAdminsCanSend: false` on channel `ChatDetails` stub |
| `src/features/messages/lib/actionMatrix.ts` | Exclude `"reply"` when `writeRestricted` is `true` |
| `src/features/messages/hooks/useMessageActionsController.ts` | Expose `writeRestricted` on action UI context and gate `openMenu` |
| `src/features/messages/components/MessageActionsProvider.tsx` | Pass `writeRestricted` to `MessageContextMenu` |
| `src/features/messages/components/MessageContextMenu.tsx` | Forward `writeRestricted` to `useMessageMenu` |
| `src/features/messages/hooks/useMessageMenu.ts` | Pass `writeRestricted` to `getAvailableActions` |
| `src/features/messages/components/MessageBubble.tsx` | Pass `ui.writeRestricted` to `getAvailableActions` |
| `src/features/chats/types.ts` | Add `onlyAdminsCanSend?: boolean` and `canSend?: boolean` to `Chat` |
| `src/features/chats/hooks/useChats.ts` | Select `only_admins_can_send`, compute `canSend`, subscribe to `chats` `UPDATE`s |
| `src/features/messages/hooks/useForwardDialog.ts` | Filter out chats where `c.canSend === false` |
| `src/features/messages/hooks/useRealtimeMessages.ts` | Subscribe to `chats` `UPDATE` for `id=eq.${chatId}` |
| `src/features/messages/components/RestrictedComposerNotice.tsx` | Render `"Only admins are allowed to chat here"` footer notice |
| `src/routes/_authenticated.chats.$chatId.tsx` | Render `<RestrictedComposerNotice />` when `!details.readOnly && isWriteRestricted(details)` |
| `src/styles/messages.css` | Style `.restricted-composer-notice` matching `.conversation-request` / `.composer-dock` |
| `src/features/chat-settings/hooks/useGroupSettings.ts` | Support `only_admins_can_send?: boolean` in `save()` via `update_group_info` |
| `src/features/chat-settings/components/GroupSettingsScreen.tsx` | Render admin-only messaging `Switch` for `context === "group" && admin` |
| `tests/messages.test.ts` | Unit tests for `formatSystemMessageText`, `isWriteRestricted`, `isOfflineOrNetworkError` on `42501` |
| `tests/chats.test.ts` | Unit tests for `computeChatDisplay` system previews |
| `tests/message-actions.test.ts` | Unit tests for `getAvailableActions` with `writeRestricted` and forward target filtering |
| `tests/chat-settings-browser.mjs` | Browser test for group admin toggling `only_admins_can_send` |
| `tests/messages-browser.mjs` | Browser test for leave system pill, restricted composer notice, live Realtime toggle, and channel exclusion |

---

### Task 1: SQL Migration & Database Types

**Files:**
- Create: `supabase/migrations/20261119160000_leave_system_messages_and_write_permissions.sql`
- Modify: `src/types/database.ts:379-425` and RPC signatures in `src/types/database.ts`
- Test: `tests/db-guard.test.ts`, `tests/communities.test.ts`

**Interfaces:**
- Produces (SQL):
  - `public.chats.only_admins_can_send boolean NOT NULL DEFAULT false`
  - `public.update_group_info(p_chat_id uuid, p_name text DEFAULT NULL, p_description text DEFAULT NULL, p_avatar_url text DEFAULT NULL, p_only_admins_can_send boolean DEFAULT NULL) RETURNS void`
  - `public.create_community_chat(p_community_id uuid, p_name text, p_description text DEFAULT NULL, p_only_admins_can_send boolean DEFAULT false) RETURNS uuid`
  - `public.forward_chat_message(p_message_id uuid, p_chat_ids uuid[], p_message_ids uuid[]) RETURNS void`
  - `public.handle_chat_member_delete() RETURNS trigger` (inserts `type = 'system', sender_id = NULL` message on leave/removal when chat still exists and has remaining members)
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.chats`
- Produces (TS): `Database["public"]["Tables"]["chats"]["Row" | "Insert" | "Update"]["only_admins_can_send"]`, updated `Functions` args for `update_group_info` and `create_community_chat`.

- [ ] **Step 1: Inspect `src/types/database.ts` around `update_group_info` and `create_community_chat` before editing**

Read lines 1350-1750 of `src/types/database.ts` (or search for `update_group_info` / `create_community_chat`) to note exact lines for `Functions`.

- [ ] **Step 2: Write LF-only SQL migration `supabase/migrations/20261119160000_leave_system_messages_and_write_permissions.sql`**

Wrap in `BEGIN; ... COMMIT;` with LF (`\n`) endings only:
1. `ALTER TABLE public.chats ADD COLUMN IF NOT EXISTS only_admins_can_send boolean NOT NULL DEFAULT false;`
2. `ALTER TABLE public.chats ADD CONSTRAINT chats_only_admins_can_send_group_check CHECK (NOT only_admins_can_send OR type IN ('group', 'community_chat'));`
3. Recreate `"messages_insert"` policy on `public.messages` preserving all conditions from `0003_business_logic.sql` and adding:
   `AND (NOT EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.only_admins_can_send) OR public.is_chat_admin(chat_id, auth.uid()))` inside the `chat_id IS NOT NULL` branch.
4. Recreate `public.forward_chat_message(uuid, uuid[], uuid[])` (`SECURITY DEFINER SET search_path = ''`) preserving `0010_message_actions.sql` validation/idempotency while adding `(NOT c.only_admins_can_send OR cm.role = 'admin')` to the target chat check (raising `'Only admins can send messages in this chat'` if violated, or checking active membership first then admin check so errors stay clear), and re-applying `REVOKE ALL` / `GRANT EXECUTE TO authenticated` / `OWNER TO postgres`.
5. `DROP FUNCTION IF EXISTS public.update_group_info(uuid, text, text, text);` then create `public.update_group_info(p_chat_id uuid, p_name text DEFAULT NULL, p_description text DEFAULT NULL, p_avatar_url text DEFAULT NULL, p_only_admins_can_send boolean DEFAULT NULL)` preserving `0014_communities.sql` (`type = 'group'`, `is_chat_admin`, validation) and updating `only_admins_can_send = coalesce(p_only_admins_can_send, only_admins_can_send)`. Grant `EXECUTE` to `authenticated` and set `OWNER TO postgres`.
6. `DROP FUNCTION IF EXISTS public.create_community_chat(uuid, text, text);` then create `public.create_community_chat(p_community_id uuid, p_name text, p_description text DEFAULT NULL, p_only_admins_can_send boolean DEFAULT false)` preserving `0014_communities.sql` and inserting `only_admins_can_send` into `public.chats`. Grant `EXECUTE` to `authenticated` and set `OWNER TO postgres`.
7. Update `public.handle_chat_member_delete()` (`SECURITY DEFINER SET search_path = ''`):
   - Keep `type = 'group'` empty-chat cascade delete (`remaining_members = 0` -> `DELETE FROM public.chats`) and last-admin promotion.
   - For `type IN ('group', 'community_chat')` when the chat still exists (`SELECT type INTO v_chat_type FROM public.chats WHERE id = OLD.chat_id`) and `EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = OLD.chat_id)`:
     - Look up `SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Member') INTO v_member_name FROM public.profiles WHERE id = OLD.user_id;` (falling back to `'Member'` if `NOT FOUND`).
     - Compute `v_content := CASE WHEN auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN format('''%s'' was removed from the chat', v_member_name) ELSE format('''%s'' left the chat', v_member_name) END;`
     - `INSERT INTO public.messages (chat_id, sender_id, type, content) VALUES (OLD.chat_id, NULL, 'system', v_content);`
8. Add `public.chats` to `supabase_realtime` inside `IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chats') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.chats; END IF;`.

- [ ] **Step 3: Update `src/types/database.ts`**

Add `only_admins_can_send: boolean` (`Row`) / `only_admins_can_send?: boolean` (`Insert`, `Update`) on `chats`, add `p_only_admins_can_send?: boolean` to `update_group_info.Args` and `create_community_chat.Args`.

- [ ] **Step 4: Verify LF line endings, `db-guard`, `communities.test.ts`, and `typecheck`**

Run:
- `node -e "const fs=require('fs'); const s=fs.readFileSync('supabase/migrations/20261119160000_leave_system_messages_and_write_permissions.sql','utf8'); if(s.includes('\r')) throw new Error('CRLF detected');"`
- `node --experimental-strip-types --test tests/db-guard.test.ts tests/communities.test.ts`
- `pnpm typecheck`
Expected: PASS on all three commands.

---

### Task 2: System Message Localization & Chat-List Preview

**Files:**
- Create: `src/features/messages/lib/systemMessageText.ts`
- Modify: `src/features/messages/components/content/SystemMessage.tsx:1-6`
- Modify: `src/features/chats/utils/computeChatDisplay.ts:15-29` and `135-190`
- Test: `tests/messages.test.ts`, `tests/chats.test.ts`

**Interfaces:**
- Produces: `formatSystemMessageText(content: string | null | undefined, language: Language): string` in `src/features/messages/lib/systemMessageText.ts`.

- [ ] **Step 1: Write failing tests in `tests/messages.test.ts` and `tests/chats.test.ts`**

Add tests asserting:
- `formatSystemMessageText("'Alice' left the chat", "en")` -> `"'Alice' left the chat"`
- `formatSystemMessageText("'Alice' left the chat", "es")` -> `"'Alice' salió del chat"`
- `formatSystemMessageText("'O'Connor' left the chat", "es")` -> `"'O'Connor' salió del chat"`
- `formatSystemMessageText("'Member' left the chat", "es")` -> `"'Miembro' salió del chat"`
- `formatSystemMessageText("'Alice' was removed from the chat", "es")` -> `"'Alice' fue eliminado del chat"`
- `formatSystemMessageText("Custom notice", "es")` -> `"Custom notice"`
- `computeChatDisplay({ ...chat, lastMessageType: "system", lastMessagePreview: "'Alice' left the chat" }, undefined, "es")` returns `text: "'Alice' salió del chat"`.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --experimental-strip-types --test tests/messages.test.ts tests/chats.test.ts`
Expected: FAIL because `systemMessageText.ts` does not exist yet and `computeChatDisplay` returns raw English preview.

- [ ] **Step 3: Implement `formatSystemMessageText` and wire `SystemMessage.tsx` + `computeChatDisplay.ts`**

- In `src/features/messages/lib/systemMessageText.ts`: match `/^'(.+)' left the chat$/` and `/^'(.+)' was removed from the chat$/`; when matched name is `"Member"` and `language === "es"`, map name to `"Miembro"`; format `"'{name}' salió del chat"` / `"'{name}' fue eliminado del chat"` in `"es"` and `"'{name}' left the chat"` / `"'{name}' was removed from the chat"` in `"en"`.
- In `src/features/messages/components/content/SystemMessage.tsx`: read `const { language } = useMessageText();` and render `formatSystemMessageText(message.content, language)`.
- In `src/features/chats/utils/computeChatDisplay.ts`: inside `resolveMessagePreview` (accepting `language`), when `type === "system"` and `rawPreview`, return `{ text: formatSystemMessageText(rawPreview, language), translateText: false }`.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --experimental-strip-types --test tests/messages.test.ts tests/chats.test.ts`
Expected: PASS.

---

### Task 3: Write-Permission Model, Actions, Outbox & Forward Target Filtering

**Files:**
- Create: `src/features/messages/lib/writePermissions.ts`
- Modify: `src/features/messages/types.ts:21-39`
- Modify: `src/features/messages/hooks/useChat.ts:70-100`
- Modify: `src/features/novedades/lib/channelChat.ts:3-17`
- Modify: `src/features/messages/lib/actionMatrix.ts:12-50`
- Modify: `src/features/messages/hooks/useMessageActionsController.ts:8-30,95-113`
- Modify: `src/features/messages/components/MessageActionsProvider.tsx:60-90`
- Modify: `src/features/messages/components/MessageContextMenu.tsx:20-35`
- Modify: `src/features/messages/hooks/useMessageMenu.ts:6-12`
- Modify: `src/features/messages/components/MessageBubble.tsx:32-45`
- Modify: `src/features/chats/types.ts:28-57`
- Modify: `src/features/chats/hooks/useChats.ts:51-60,240-305`
- Modify: `src/features/messages/hooks/useForwardDialog.ts:14-20`
- Test: `tests/messages.test.ts`, `tests/message-actions.test.ts`, `tests/chats.test.ts`, `tests/outbox.test.ts`

**Interfaces:**
- Produces:
  - `ChatDetails.onlyAdminsCanSend: boolean`
  - `isWriteRestricted(chat: Pick<ChatDetails, "type" | "onlyAdminsCanSend" | "own" | "channelMode">): boolean` in `src/features/messages/lib/writePermissions.ts`
  - `getAvailableActions(message: Message, userId: string, readOnly?: boolean, now?: number, writeRestricted?: boolean): MessageAction[]`
  - `Chat.onlyAdminsCanSend?: boolean`, `Chat.canSend?: boolean`
  - `filterForwardTargets(chats: Chat[], search: string): Chat[]` exported from `useForwardDialog.ts` (or a pure helper imported by it)

- [ ] **Step 1: Write failing unit tests in `tests/messages.test.ts`, `tests/message-actions.test.ts`, and `tests/outbox.test.ts`**

Add tests asserting:
- `isWriteRestricted` returns `true` for `type: "group"` or `"community_chat"` when `onlyAdminsCanSend: true`, `channelMode: false`, and `own?.role !== "admin"`; returns `false` when `own?.role === "admin"`, `type === "direct"`, or `channelMode === true`.
- `getAvailableActions(msg, "member", false, now, true)` omits `"reply"` while retaining `"react"`, `"copy"`, `"forward"`, `"pin"`, `"delete_for_me"`.
- `filterForwardTargets` excludes chats with `canSend: false` even if `!archivedAt && !isBlocked`.
- `isOfflineOrNetworkError({ code: "42501", message: "new row violates row-level security policy" }, 403, true)` returns `false` (terminal send failure, no infinite retry).

- [ ] **Step 2: Run tests to verify failure**

Run: `node --experimental-strip-types --test tests/messages.test.ts tests/message-actions.test.ts tests/outbox.test.ts`
Expected: FAIL on missing `isWriteRestricted`, missing `filterForwardTargets`, and `writeRestricted` ignored in `getAvailableActions`.

- [ ] **Step 3: Implement `writePermissions.ts`, update `ChatDetails` / `useChat` / `channelChat`, `actionMatrix` / menu / bubble, `Chat` / `useChats` / `useForwardDialog`**

1. Create `src/features/messages/lib/writePermissions.ts` exporting `isWriteRestricted`.
2. Add `onlyAdminsCanSend: boolean` to `ChatDetails` (`src/features/messages/types.ts`), set `onlyAdminsCanSend: !!chat.data?.only_admins_can_send` in `useChat.ts`, and `onlyAdminsCanSend: false` in `channelChat.ts`.
3. Update `getAvailableActions(..., writeRestricted = false)` in `actionMatrix.ts` to omit `"reply"` when `writeRestricted` is `true`; thread `writeRestricted = isWriteRestricted(chat)` through `useMessageActionsController`, `MessageActionsProvider`, `MessageContextMenu`, `useMessageMenu`, and `MessageBubble`.
4. Add `onlyAdminsCanSend?: boolean` and `canSend?: boolean` to `Chat` (`src/features/chats/types.ts`); in `fetchChats()` (`src/features/chats/hooks/useChats.ts`), select `only_admins_can_send` on `chat:chats` and compute `canSend = !((c.type === "group" || c.type === "community_chat") && c.only_admins_can_send && ownRole !== "admin")` using the already-fetched `members` array.
5. Export and use `filterForwardTargets(chats, search)` in `useForwardDialog.ts` excluding `c.canSend === false`.

- [ ] **Step 4: Run tests and `typecheck` to verify pass**

Run:
- `node --experimental-strip-types --test tests/messages.test.ts tests/message-actions.test.ts tests/chats.test.ts tests/outbox.test.ts`
- `pnpm typecheck`
Expected: PASS.

---

### Task 4: Conversation Restricted Footer, Realtime `chats` Sync & Group Settings Toggle

**Files:**
- Create: `src/features/messages/components/RestrictedComposerNotice.tsx`
- Modify: `src/routes/_authenticated.chats.$chatId.tsx:172-182`
- Modify: `src/styles/messages.css` (around `.conversation-request` / `.conversation-shell-footer`)
- Modify: `src/features/messages/hooks/useRealtimeMessages.ts:43-80`
- Modify: `src/features/chats/hooks/useChats.ts:573-606`
- Modify: `src/features/chat-settings/hooks/useGroupSettings.ts:17-46`
- Modify: `src/features/chat-settings/components/GroupSettingsScreen.tsx:147-168`
- Modify: `tests/chat-settings-browser.mjs`
- Modify: `tests/messages-browser.mjs`

**Interfaces:**
- Consumes: `isWriteRestricted`, `ChatDetails.onlyAdminsCanSend` from Task 3
- Produces:
  - `<RestrictedComposerNotice />` rendering `Lock` icon + `say("Only admins are allowed to chat here", "Solo los administradores pueden enviar mensajes aquí")` with `role="status"` and `data-slot="restricted-composer-notice"`
  - `useGroupSettings(chatId, context).save({ name?, description?, avatar_url?, only_admins_can_send? })`

- [ ] **Step 1: Add browser test assertions first in `tests/chat-settings-browser.mjs` and `tests/messages-browser.mjs` (TDD)**

- Inspect `tests/messages-browser.mjs` and `tests/chat-settings-browser.mjs` around mock route handlers (`chats`, `messages`, `update_group_info`) to add:
  - In `tests/chat-settings-browser.mjs`: verify group admin sees the `"Only admins can send messages"` switch in `GroupSettingsScreen`, toggling it calls `update_group_info` with `p_only_admins_can_send: true`, and state updates (plus non-admin does not see the admin toggle).
  - In `tests/messages-browser.mjs`:
    1. Group chat with a `type: "system", sender_id: null, content: "'Sofia Reyes' left the chat"` message renders `"‘Sofia Reyes’ left the chat"` (`'Sofia Reyes' left the chat`) in English and `"'Sofia Reyes' salió del chat"` in Spanish, and renders `"'O'Connor' salió del chat"` accurately.
    2. Group chat with `only_admins_can_send: true` and `own.role === "member"` replaces `<Composer />` with `"Only admins are allowed to chat here"` (and `"Solo los administradores pueden enviar mensajes aquí"` in Spanish), removes `"Reply"` from the message menu, and updates live when mocked Realtime / refetch flips `only_admins_can_send` from `false` to `true` (and back, verifying admin keeps `<Composer />`).
    3. Verify `ChannelView` (`tests/conversation-shell-browser.mjs` or `tests/novedades-browser.mjs`) does not show `"Only admins are allowed to chat here"`.

- [ ] **Step 2: Run one browser test against isolated Vite server to confirm failure**

Start isolated Vite dev server with disposable `VITE_*` env vars and run `node tests/chat-settings-browser.mjs` or `node tests/messages-browser.mjs`.
Expected: FAIL because the UI toggle, restricted footer, and localized leave pill are not wired yet.

- [ ] **Step 3: Implement `<RestrictedComposerNotice />`, `Conversation` footer, Realtime `chats` subscriptions, and `GroupSettingsScreen` toggle**

1. Create `src/features/messages/components/RestrictedComposerNotice.tsx` using `Lock` from `lucide-react` and `useMessageText().say("Only admins are allowed to chat here", "Solo los administradores pueden enviar mensajes aquí")`, wrapped in `<div className="restricted-composer-notice" data-slot="restricted-composer-notice" role="status">`.
2. Style `.restricted-composer-notice` in `src/styles/messages.css` matching the frosted glass footer aesthetic of `.conversation-request` / `.channel-follow-footer`.
3. In `src/routes/_authenticated.chats.$chatId.tsx`, update `Conversation`'s `footer` prop:
   - `details.readOnly ? null : isWriteRestricted(details) ? <RestrictedComposerNotice /> : <Composer ... />`.
4. In `src/features/messages/hooks/useRealtimeMessages.ts`, chain `.on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats", filter: \`id=eq.\${chatId}\` }, refresh)`.
5. In `src/features/chats/hooks/useChats.ts`, chain `.on("postgres_changes", { event: "UPDATE", schema: "public", table: "chats" }, () => refresh(false))`.
6. In `src/features/chat-settings/hooks/useGroupSettings.ts`, extend the `patch` parameter with `only_admins_can_send?: boolean` and pass `p_only_admins_can_send: patch.only_admins_can_send` to `supabase.rpc("update_group_info", ...)` (using `useMutation` error handling).
7. In `src/features/chat-settings/components/GroupSettingsScreen.tsx`, when `context === "group" && admin`, render a `<CardSurface className="chat-permissions-card">` containing a `<Switch>` labeled `"Only admins can send messages"` / `"Solo los administradores pueden enviar mensajes"` with helper text `"Members can still read messages and react."` / `"Los miembros aún pueden leer mensajes y reaccionar."`, disabled while `hook.busy`, showing inline `role="alert"` error if saving fails.

- [ ] **Step 4: Run browser tests to verify pass**

Run `node tests/chat-settings-browser.mjs`, `node tests/messages-browser.mjs`, `node tests/conversation-shell-browser.mjs`, and `node tests/communities-browser.mjs` against the isolated Vite dev server.
Expected: PASS on all four suites.

---

### Task 5: Full Verification & Final Commit

**Files:**
- Verify all modified/created files in `.worktrees/chat-leave-and-write-permissions`

- [ ] **Step 1: Run full unit tests, typecheck, and lint**

Run inside `.worktrees/chat-leave-and-write-permissions`:
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
Expected: All unit tests pass, `tsc -b` exits 0, `biome check .` exits 0.

- [ ] **Step 2: Verify Git diff and commit on `feat/chat-leave-and-write-permissions`**

Run:
- `git status`
- `git log --oneline main..HEAD`
- `git diff --stat main..HEAD`
Stage task files explicitly (`git add supabase/migrations/... src/... tests/... docs/...`) and commit with an English commit message (`git commit -m "feat: add leave system messages and admin-only chat write permissions"`). Do NOT push or create a PR without explicit owner approval.
