# SILVERCHAT — PROMPT #11: COMMUNITIES

You are a senior full-stack engineer implementing the **Communities**
feature for SilverChat. Communities are containers of themed chats (similar
to Discord servers or Telegram groups-of-groups).

This prompt covers: communities list, community cards, community chat view
(two-pane desktop / fullscreen mobile), community info, create community,
create community chat, membership, ownership succession, mute, leave, delete.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CM1 | Cards colapsables, each showing up to 4 chats preview + "See all"                                                                                                  |
| CM2 | Community chats render identically to groups (reuse #8a-#9 components); only `ChatHeader` subtitle differs                                                         |
| CM3 | Only community admins can create new chats in the community                                                                                                        |
| CM4 | Every new community auto-creates a "General" chat; owner is auto-joined                                                                                            |
| CM5 | Desktop (≥1024px): two-pane (chat list sidebar + chat pane). Mobile: fullscreen chat with back button                                                              |
| CM6 | No discovery — invite-only (direct RPC call or exact-name search)                                                                                                  |
| CM7 | **Ownership succession:** if owner leaves, promote oldest `admin`; if no admins, promote oldest `member` and make them admin; if no members left, delete community |
| CM8 | Community info screen (name, description, avatar, members list, admin actions, leave, delete)                                                                      |
| CM9 | Mute affects ALL chats in the community (bulk `chat_members.muted_until`); individual chat mute is disabled                                                        |

Additional locked decisions:

- **Community chats are `chats.type = 'community_chat'`** with `community_id`
  set. Membership is derived from `community_members` via triggers (already
  in #4b-2 — `handle_community_member_insert` / `_delete`).
- **Reuse everything**: `MessageList`, `MessageBubble`, `Composer`,
  `MessageContextMenu`, `PinnedMessagesBar`, `InChatSearch` from #8a-#8b
  with `channelMode`-like prop adjustments.
- **Chat context menu differences** (compared to group chats):
  - Disabled: "Add members", "View members", "Leave group" (membership is
    managed at the community level)
  - Enabled: mute (mutually handled with community-level mute UI), clear
    chat, pin, search
- **Search bar in `/communities`**: searches only communities the user is
  a member of. No global search.
- **Avatar upload** for community: reuses `AvatarPickerModal` from #6,
  uploading to `avatars/community-{community_id}/community-{ts}.webp`.
- **Ownership succession must ALSO handle account deletion** (a user
  deleting their account deletes their `profiles` row → cascade to
  `community_members` → trigger runs).

---

## 2. MIGRATION `0012_communities.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1. UPDATE create_community RPC (auto-create General chat)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_community(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id uuid;
  v_general_chat_id uuid;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Community name is required';
  END IF;
  IF length(p_name) > 100 THEN
    RAISE EXCEPTION 'Community name must be 100 characters or less';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  INSERT INTO public.communities (name, description, owner_id)
  VALUES (trim(p_name), p_description, auth.uid())
  RETURNING id INTO v_community_id;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, auth.uid(), 'admin');

  -- Auto-create "General" chat
  INSERT INTO public.chats (type, status, name, community_id, created_by)
  VALUES ('community_chat', 'active', 'General', v_community_id, auth.uid())
  RETURNING id INTO v_general_chat_id;

  -- Owner auto-joins the General chat
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_general_chat_id, auth.uid(), 'admin');

  RETURN v_community_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_community(text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE COMMUNITY CHAT (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_community_chat(
  p_community_id uuid,
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only community admins can create chats';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Chat name is required';
  END IF;
  IF length(p_name) > 100 THEN
    RAISE EXCEPTION 'Chat name must be 100 characters or less';
  END IF;

  INSERT INTO public.chats (type, status, name, community_id, created_by)
  VALUES ('community_chat', 'active', trim(p_name), p_community_id, auth.uid())
  RETURNING id INTO v_chat_id;

  -- Add all current community members to the new chat
  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT v_chat_id, cm.user_id,
    CASE WHEN cm.role = 'admin' THEN 'admin'::chat_member_role
         ELSE 'member'::chat_member_role END
  FROM public.community_members cm
  WHERE cm.community_id = p_community_id
  ON CONFLICT DO NOTHING;

  RETURN v_chat_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_community_chat(uuid, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. LEAVE COMMUNITY
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION leave_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = auth.uid();
  -- Trigger handle_community_member_delete does the rest
END;
$$;
GRANT EXECUTE ON FUNCTION leave_community(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. MUTE COMMUNITY (bulk mute all chats)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION mute_community(
  p_community_id uuid,
  p_muted_until timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_community_member(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this community';
  END IF;

  UPDATE public.chat_members
  SET muted_until = p_muted_until
  WHERE user_id = auth.uid()
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = p_community_id
    );
END;
$$;
GRANT EXECUTE ON FUNCTION mute_community(uuid, timestamptz) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. UPDATE COMMUNITY INFO (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_community_info(
  p_community_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can update info';
  END IF;

  IF p_name IS NOT NULL AND (length(p_name) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Name must be 1-100 characters';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  UPDATE public.communities
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = p_community_id;
END;
$$;
GRANT EXECUTE ON FUNCTION update_community_info(uuid, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. REMOVE MEMBER (admin only, not owner)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION remove_community_member(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can remove members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the community owner';
  END IF;

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION remove_community_member(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. PROMOTE / DEMOTE COMMUNITY ADMIN
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION promote_community_admin(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can promote';
  END IF;

  UPDATE public.community_members
  SET role = 'admin'
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION promote_community_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION demote_community_admin(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can demote';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = p_user_id
  ) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot demote the community owner';
  END IF;

  UPDATE public.community_members
  SET role = 'member'
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION demote_community_admin(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. DELETE COMMUNITY (owner only, hard delete)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the owner can delete this community';
  END IF;

  DELETE FROM public.communities WHERE id = p_community_id;
  -- CASCADE deletes community_members, chats, messages, chat_members
END;
$$;
GRANT EXECUTE ON FUNCTION delete_community(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 9. OVERRIDE handle_community_member_delete (add succession)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_community_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_owner boolean;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  -- 1. Decrement member count
  UPDATE public.communities
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = OLD.community_id;

  -- 2. Remove user from all community chats
  DELETE FROM public.chat_members
  WHERE user_id = OLD.user_id
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = OLD.community_id
    );

  -- 3. Check if the departing user was the owner
  SELECT (owner_id = OLD.user_id) INTO v_was_owner
  FROM public.communities
  WHERE id = OLD.community_id;

  IF v_was_owner THEN
    -- Count remaining members
    SELECT COUNT(*) INTO v_remaining_count
    FROM public.community_members
    WHERE community_id = OLD.community_id;

    IF v_remaining_count = 0 THEN
      -- Last member left → delete community (cascades everything)
      DELETE FROM public.communities WHERE id = OLD.community_id;
      RETURN OLD;
    END IF;

    -- Find successor: oldest admin first, then oldest member
    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = OLD.community_id
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      joined_at ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities
      SET owner_id = v_next_owner
      WHERE id = OLD.community_id;

      UPDATE public.community_members
      SET role = 'admin'
      WHERE community_id = OLD.community_id AND user_id = v_next_owner;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Ensure the trigger still points to the new version
DROP TRIGGER IF EXISTS community_members_after_delete ON public.community_members;
CREATE TRIGGER community_members_after_delete
  AFTER DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION handle_community_member_delete();

-- ═══════════════════════════════════════════════════════════════
-- 10. TRIGGER: HANDLE OWNER ACCOUNT DELETION
--     (fires BEFORE DELETE on profiles to run succession before FK nulls out)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION handle_profile_deletion_community_succession()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community RECORD;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  -- Handle each community where the departing user was owner
  FOR v_community IN
    SELECT id FROM public.communities WHERE owner_id = OLD.id
  LOOP
    SELECT COUNT(*) INTO v_remaining_count
    FROM public.community_members
    WHERE community_id = v_community.id AND user_id <> OLD.id;

    IF v_remaining_count = 0 THEN
      DELETE FROM public.communities WHERE id = v_community.id;
      CONTINUE;
    END IF;

    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = v_community.id AND user_id <> OLD.id
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      joined_at ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities
      SET owner_id = v_next_owner
      WHERE id = v_community.id;

      UPDATE public.community_members
      SET role = 'admin'
      WHERE community_id = v_community.id AND user_id = v_next_owner;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS profiles_before_delete_community_succession ON public.profiles;
CREATE TRIGGER profiles_before_delete_community_succession
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_profile_deletion_community_succession();

  3. FILE STRUCTURE
text
src/routes/
├── _authenticated.communities.tsx                          (list)
├── _authenticated.communities.$communityId.tsx             (chat list + chat pane container)
├── _authenticated.communities.$communityId.index.tsx       (chat list, mobile root)
├── _authenticated.communities.$communityId.chats.$chatId.tsx  (chat view)
└── _authenticated.communities.$communityId.info.tsx        (info / settings)

src/features/communities/
├── components/
│   ├── CommunitiesList.tsx
│   ├── CommunityCard.tsx
│   ├── CommunityChatListItem.tsx
│   ├── CommunityChatView.tsx
│   ├── CommunityChatSidebar.tsx
│   ├── CommunityChatHeader.tsx
│   ├── CommunityInfoScreen.tsx
│   ├── CreateCommunityModal.tsx
│   └── CreateCommunityChatModal.tsx
├── hooks/
│   ├── useCommunities.ts
│   ├── useCommunity.ts
│   ├── useCommunityChats.ts
│   ├── useCommunityMembers.ts
│   ├── useCreateCommunity.ts
│   ├── useCreateCommunityChat.ts
│   ├── useLeaveCommunity.ts
│   ├── useMuteCommunity.ts
│   ├── useUpdateCommunityInfo.ts
│   └── useDeleteCommunity.ts
└── lib/
    └── communityActions.ts           (action matrix)
Modified files:

src/features/chat-settings/components/ChatOptionsMenu.tsx — add
contextChatType === 'community_chat' variant that hides "Add members",
"View members", "Leave group" (membership managed at community level)

src/features/messages/components/ChatHeader.tsx — for community chats,
show chat.community_name as subtitle below chat name

4. ROUTES
_authenticated.communities.tsx — /communities

Main list of communities the user is a member of

Search bar at top ("Search communities...")

List of CommunityCard (colapsable)

Empty state if no communities: "You're not in any communities yet. Ask a friend for an invite or create one."

NewCommunityFAB (bottom-right, reuses FAB pattern from #7)

_authenticated.communities.$communityId.tsx — layout wrapper

On desktop (≥1024px): renders two-pane (CommunityChatSidebar + <Outlet />)

On mobile: renders only <Outlet /> (children show fullscreen)

Fetches community metadata, redirects to /communities if not a member

_authenticated.communities.$communityId.index.tsx — index route

On desktop: redirects to first chat (General) OR shows empty pane with "Select a chat"

On mobile: shows the chat list (equivalent to sidebar but full-screen)

_authenticated.communities.$communityId.chats.$chatId.tsx — chat view

Reuses MessageList, Composer, MessageContextMenu, PinnedMessagesBar,
InChatSearch from #8a-#8b

CommunityChatHeader at top (back button on mobile, chat name + community
subtitle)

No "call/video" buttons (community chats can't start calls directly —
decision for MVP simplicity; calls are 1:1 only in Prompt #12)

Auto-mark-read on mount: UPDATE chat_members SET last_read_at = now() WHERE ...

_authenticated.communities.$communityId.info.tsx — info screen

Similar to GroupSettingsScreen (#9)

5. COMPONENT SPECS
5.1 CommunitiesList
Main list of the user's communities.

tsx
// useCommunities() query
const { data } = await supabase
  .from('communities')
  .select(`
    id, name, description, avatar_url, member_count, created_at,
    community_members!inner ( role, joined_at )
  `)
  .eq('community_members.user_id', user.id)
  .order('created_at', { ascending: false });
Layout:

Search bar (filters client-side by name)

Section header: "Your communities ({N})"

List of <CommunityCard> (see 5.2)

Empty state

5.2 CommunityCard
Card per community. Two states: collapsed (default) and expanded.

Collapsed:

text
┌──────────────────────────────────────────┐
│ [Avatar] Community Name      12 members ▼│
│          Short description...            │
└──────────────────────────────────────────┘
Expanded:

text
┌──────────────────────────────────────────┐
│ [Avatar] Community Name      12 members ▲│
│          Short description...            │
├──────────────────────────────────────────┤
│ [Chat icon] General                      │
│              {preview}        2h ago     │
├──────────────────────────────────────────┤
│ [Chat icon] Logistics                    │
│              {preview}        1d ago     │
├──────────────────────────────────────────┤
│ [Chat icon] Announcements                │
│              {preview}        Mon        │
├──────────────────────────────────────────┤
│              See all 5 chats →           │
└──────────────────────────────────────────┘
Header: click anywhere → toggle expand (persist expanded state in
localStorage['silverchat_community_expanded_{id}'] = 'true' | 'false')

Only 3 chats shown by default; "See all N chats →" navigates to
/communities/:id (the sidebar view)

Each CommunityChatListItem shows: icon, name, preview, timestamp,
unread badge, mute icon

Chat click → navigates to /communities/:id/chats/:chatId

useCommunityChats(communityId) query:

ts
supabase.from('chats')
  .select(`
    id, name, avatar_url,
    last_message_at, last_message_preview,
    chat_members!inner ( last_read_at, muted_until, manually_unread )
  `)
  .eq('community_id', communityId)
  .eq('chat_members.user_id', user.id)
  .order('last_message_at', { ascending: false, nullsFirst: false });
Unread count: batched query similar to useChats in Prompt #7.

5.3 CommunityChatListItem
Row inside a CommunityCard (expanded state) or inside CommunityChatSidebar.

Icon 40×40 (community chats don't have unique avatars by default — uses
<MessageCircle> icon with community gradient)

Name + optional verified (Fase 2)

Preview (last message preview, or "No messages yet")

Timestamp (relative: "2h ago", "Yesterday", "Mon", "12/09/2026")

Unread badge (only if not muted) — dot for manually_unread

Mute icon if muted_until in future

Click → navigate to chat

5.4 CommunityChatView — /communities/:id/chats/:chatId
Two-pane desktop layout is rendered by the parent layout route
(_authenticated.communities.$communityId.tsx). This component renders the
RIGHT pane (or the full screen on mobile).

Structure:

tsx
<div className="flex flex-col h-full">
  <CommunityChatHeader chat={chat} community={community} />
  <PinnedMessagesBar chatId={chatId} />
  <MessageList chatId={chatId} />
  <Composer chatId={chatId} chat={chat} />
</div>
Reuses all #8a-#8b components. Only CommunityChatHeader is new.

5.5 CommunityChatSidebar
Desktop only. Left pane (~320px width).

tsx
<aside className="w-80 border-r flex flex-col">
  <header className="p-4 border-b">
    <h1 className="text-lg font-semibold">{community.name}</h1>
    <p className="text-xs text-muted-foreground">{community.member_count} members</p>
  </header>
  <nav className="flex-1 overflow-y-auto">
    {chats.map(chat => (
      <CommunityChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChatId} />
    ))}
    {isAdmin && (
      <button onClick={openCreateChat}>
        <Plus /> New chat
      </button>
    )}
  </nav>
  <footer className="p-3 border-t">
    <button onClick={() => navigate({to: `/communities/${id}/info`})}>
      <Info /> Community info
    </button>
  </footer>
</aside>
Active chat is highlighted with bg-muted. Navigation uses URL-based routing
via TanStack Router.

5.6 CommunityChatHeader
Top bar of the chat pane.

Mobile only: back button (navigates to /communities/:id)

Chat name (font-semibold) + community name as subtitle (text-xs text-muted-foreground)

Menu button (3-dot) → opens ChatOptionsMenu with community adjustments

No call / video buttons in MVP

5.7 CommunityInfoScreen — /communities/:id/info
Layout similar to GroupSettingsScreen (#9):

Avatar (large, editable if admin)

Name (editable if admin, inline)

Description (editable if admin, inline)

"{N} members · Created {date}"

Buttons: "View members", "Mute community" (opens submenu — bulk mute),
"Leave community" (destructive)

"Add members" (admins only) — reuses AddMembersModal from #9 but calls
join_community RPC per member (community-level). Fase 2: bulk RPC.

"Delete community" (owner only, type-to-confirm dialog)

If admin: "Create chat" button (same as sidebar, but available in info screen too)

Owner succession warning (shown to owner before leaving):

"You're the owner of this community. If you leave, the oldest admin (or
oldest member if no admins) will automatically become the new owner."

5.8 CreateCommunityModal
Form:

Name (required, 1-100 chars)

Description (optional, 500 chars)

Avatar (optional)

Submit flow:

create_community(name, description) RPC → returns community_id

If avatar → upload to avatars/community-{id}/... → update_community_info(id, null, null, avatarUrl)

router.navigate({ to: '/communities/:id' }) → auto-redirects to General
chat on desktop; on mobile lands on chat list showing General

5.9 CreateCommunityChatModal
Form:

Name (required, 1-100 chars)

Description (optional, 500 chars — displayed in chat header on tap? no,
MVP: ignored in UI, only stored)

Submit → create_community_chat(communityId, name, description) →
invalidate chats query → auto-navigate to the new chat.

6. HOOKS
6.1 useCommunities()
Returns Community[] sorted by created_at DESC. Refetch on focus.

6.2 useCommunity(communityId)
Single community + membership info + user's role. Redirects if not a member.

6.3 useCommunityChats(communityId)
Returns chats with unread counts + last message + mute state, matching the
CommunityChatListItem shape.

6.4 useCommunityMembers(communityId)
Similar to useGroupMembers from #9, but reads from community_members.

6.5 useCreateCommunity()
Mutation → create_community RPC.

6.6 useCreateCommunityChat(communityId)
Mutation → create_community_chat RPC.

6.7 useLeaveCommunity(communityId)
Mutation → leave_community RPC → invalidate communities → navigate to
/communities.

Special handling: if user is owner, show confirmation modal explaining
succession before calling.

6.8 useMuteCommunity(communityId)
Mutation → mute_community RPC → invalidate chats query.

6.9 useUpdateCommunityInfo(communityId)
Mutation → update_community_info RPC.

6.10 useDeleteCommunity(communityId)
Mutation → delete_community RPC → navigate to /communities.

7. LIB: communityActions.ts
ts
export type CommunityAction =
  | 'view_info'
  | 'view_members'
  | 'mute'
  | 'unmute'
  | 'add_members'
  | 'create_chat'
  | 'leave'
  | 'delete';

export function getAvailableCommunityActions(
  community: Community,
  userId: string,
  isAdmin: boolean,
  isOwner: boolean,
  isMuted: boolean
): CommunityAction[] {
  const actions: CommunityAction[] = ['view_info', 'view_members'];
  actions.push(isMuted ? 'unmute' : 'mute');
  if (isAdmin) {
    actions.push('add_members', 'create_chat');
  }
  if (!isOwner) actions.push('leave');
  else actions.push('leave'); // owner can leave but succession runs
  if (isOwner) actions.push('delete');
  return actions;
}
8. CHAT OPTIONS MENU — COMMUNITY_VARIANT
Modify ChatOptionsMenu (#9) to hide certain actions when
contextChatType === 'community_chat':

Hide: "Add members", "View members", "Leave group"

Keep: "Search in chat", "Mute" (works — updates this chat's
chat_members.muted_until; community-level mute is via info screen),
"Mark as unread", "Pin/Unpin", "Clear chat"

Add: "Community info" → navigates to /communities/:id/info

9. CHAT HEADER MODIFICATION
ChatHeader (#8a) needs a small adjustment: when the chat is a
community_chat, show chat.community_name as a subtitle below the chat
name. The chat data join needs to include community:communities(name).

tsx
{chat.type === 'community_chat' && chat.community_name && (
  <span className="text-xs text-muted-foreground">{chat.community_name}</span>
)}
10. REALTIME
Not subscribed to communities or community_members in MVP
(refetch on focus is fine).

Chats inside a community are already covered by messages /
chat_members realtime from #8a.

11. WHAT NOT TO INCLUDE
❌ Discovery / public communities (Fase 2)

❌ Invite links (Fase 2)

❌ Community-level roles beyond admin/member (Fase 2)

❌ Custom chat ordering / categories (Fase 2)

❌ Community-wide announcements channel (already possible via "Announcements" chat)

❌ Bulk add members (only one-by-one via join_community RPC)

❌ Calls within community chats (calls are 1:1 only in MVP)

❌ Voice channels (Discord-style) — Fase 2

❌ Threads within chats (Fase 2)

❌ Emoji/reaction on community cards (Fase 2)

❌ Community analytics (Fase 2)

12. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0012 (8 RPCs + 1
modified + 2 succession triggers), 9 components, 10 hooks, 1 lib,
5 routes.

Complete migration file supabase/migrations/0012_communities.sql.

Complete file tree of new/modified files.

Complete content of every file:

5 routes (list, layout, index, chat, info)

9 components

10 hooks

1 lib (communityActions)

Modified ChatOptionsMenu (#9) + ChatHeader (#8a)

Verification checklist:

Create community → auto-creates "General" chat → owner is in it

Communities list shows the new community as a card

Expand card → shows "General" chat

Click "General" → opens chat view

Desktop: sidebar shows "General" + new chats; mobile: fullscreen chat
with back button

As admin: create a chat "Announcements" → all community members auto-join

As non-admin: "New chat" button is hidden

Community info → edit name → save → updates in list + header

Community info → mute → all chats in community show muted icon

Community info → leave → confirmation → removed from community + all
chats → redirected to /communities

Owner leaves community → confirmation with succession warning → oldest
admin becomes owner (verify via another member's view)

Owner leaves with NO admins → oldest member becomes owner + admin

Owner leaves as ONLY member → community is deleted (verify via another
user's search)

Owner deletes account (via settings from #6) → same succession logic
runs

Delete community as owner → type-to-confirm → community deleted →
redirect

Non-owner cannot delete community (button hidden)

Non-admin cannot edit info (fields read-only)

Search bar filters communities by name

Community chat shows "{community.name}" subtitle in header

Context menu on community chat: no "Add members", no "View members",
no "Leave group"

Message sending works identically to group chats

A short list of pitfalls to warn the developer:

Why the succession trigger is BEFORE DELETE ON profiles (needs to run
before the FK sets owner_id = NULL)

Why handle_community_member_delete also handles the case when the
owner leaves normally (not through account deletion) — same logic,
different trigger

Why the succession query orders by CASE WHEN role = 'admin' THEN 0 ELSE 1 END, joined_at ASC (admins first, then oldest within role)

Why community chats don't have individual "leave" (would desync
membership from the community)

Why muting a chat inside a community is still possible (only the
community-level mute is a bulk action; per-chat mute is legacy behavior
but allowed)

Why the create_community RPC was rewritten (not just extended) —
atomicity of community + membership + General chat + owner chat
membership

Why "Add members" on a community uses join_community per member (no
bulk RPC in MVP — Fase 2)

Why no realtime on community_members (role changes are rare; refetch
on focus is acceptable)

Why the desktop two-pane layout uses a layout route
(_authenticated.communities.$communityId.tsx) rather than each chat
route rendering the sidebar (avoids re-mount on chat navigation)

Why CommunityChatListItem doesn't show avatars (all chats in a
community share the community gradient by default)

Do not implement Prompt #12+ features. Do not implement invite links. This
completes the communities feature set.
```
