# SILVERCHAT — PROMPT #9: CONTACT PROFILE & CHAT SETTINGS

You are a senior frontend engineer implementing the **contact profile modal**
and the **chat settings menu** for SilverChat. This prompt covers the
per-contact view, per-chat settings, group member management, group settings,
reporting, shared media, and bulk actions.

This prompt (#9) covers: contact profile modal, chat options menu, group
members list, add members modal, group settings, report modal, shared media
view (Media + Files tabs), leave group modal, clear chat modal.

**Not covered here**: shared links tab (Fase 2), message info (Fase 2),
pinned messages (already in #8b), search in chat (already in #8b).

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Contact profile opens as a **modal** from the chat, with a "View full profile →" link to `/profile/:username`                   |
| P2  | Actions: Message · Call · Video · Block · Report + link to full profile                                                         |
| P3  | Report modal: 4 reasons (Spam / Harassment / Inappropriate / Other) + optional description (required if "Other", max 500 chars) |
| P4  | Chat options menu is flat with separators. 3 variants: direct / group-community / self                                          |
| P5  | Multiple admins. Creator cannot be demoted by others. Trigger from #4b-2 promotes oldest member when last admin leaves          |
| P6  | Add members: contacts + global user search, multi-select up to 50, uses **new bulk RPC**                                        |
| P7  | Shared media MVP = 2 tabs (Media grid, Files list). Links tab → Fase 2. New indexes added                                       |
| P8  | Clear chat = bulk delete-for-me via **new RPC**. Leave group = confirmation + trigger from #4b-2                                |

Additional decisions:

- **Contact profile modal is only reachable from a chat** (not from search
  or chat list). Direct access to `/profile/:username` still exists from
  Prompt #6.
- **Call / Video buttons respect `chat.status === 'active'`** — disabled with
  tooltip "Accept the chat request first" if chat is `pending_request`.
- **Group avatar** (composite of members' initials) → **Fase 2**. For MVP,
  group chats show a single avatar from `chats.avatar_url` or a generic
  `Users` icon with primary gradient.
- **Shared media** loads lazily when the tab is opened, paginated 30 per page.
- **Empty chat** (clear chat) is a soft action — no message is deleted from
  the DB, only from the user's view (via `message_deletions`).

---

## 2. MIGRATION `0010_chat_settings.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1. BULK ADD MEMBERS (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION add_chat_members(
  p_chat_id uuid,
  p_user_ids uuid[]
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added int := 0;
  v_uid uuid;
  v_type chat_type;
BEGIN
  SELECT type INTO v_type FROM public.chats WHERE id = p_chat_id;
  IF v_type NOT IN ('group', 'community_chat') THEN
    RAISE EXCEPTION 'Can only add members to group or community chats';
  END IF;

  IF NOT is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can add members';
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids LOOP
    -- Skip if already a member
    IF NOT EXISTS (
      SELECT 1 FROM public.chat_members
      WHERE chat_id = p_chat_id AND user_id = v_uid
    ) THEN
      -- Skip if blocked (either direction) with any current member
      IF EXISTS (
        SELECT 1 FROM public.chat_members cm
        WHERE cm.chat_id = p_chat_id
          AND is_blocked_either_way(cm.user_id, v_uid)
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.chat_members (chat_id, user_id, role)
      VALUES (p_chat_id, v_uid, 'member');
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN v_added;
END;
$$;
GRANT EXECUTE ON FUNCTION add_chat_members(uuid, uuid[]) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2. REMOVE A MEMBER (admin only, except owner)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION remove_chat_member(
  p_chat_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can remove members';
  END IF;

  -- Cannot remove the chat creator
  IF EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = p_chat_id AND created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the group creator';
  END IF;

  DELETE FROM public.chat_members
  WHERE chat_id = p_chat_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION remove_chat_member(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. PROMOTE TO ADMIN (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION promote_chat_admin(
  p_chat_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can promote members';
  END IF;

  UPDATE public.chat_members
  SET role = 'admin'
  WHERE chat_id = p_chat_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION promote_chat_admin(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. DEMOTE FROM ADMIN (admin only, cannot demote creator)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION demote_chat_admin(
  p_chat_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can demote other admins';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = p_chat_id AND created_by = p_user_id
  ) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot demote the group creator';
  END IF;

  UPDATE public.chat_members
  SET role = 'member'
  WHERE chat_id = p_chat_id AND user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION demote_chat_admin(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. UPDATE GROUP INFO (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_group_info(
  p_chat_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can update group info';
  END IF;

  IF p_name IS NOT NULL AND (length(p_name) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Group name must be between 1 and 100 characters';
  END IF;

  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Group description must be 500 characters or less';
  END IF;

  UPDATE public.chats
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = p_chat_id;
END;
$$;
GRANT EXECUTE ON FUNCTION update_group_info(uuid, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. CLEAR CHAT FOR ME (bulk delete-for-me, no confirmation in DB)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION clear_chat_for_me(p_chat_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT is_chat_member(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  INSERT INTO public.message_deletions (message_id, user_id)
  SELECT id, auth.uid()
  FROM public.messages
  WHERE chat_id = p_chat_id
    AND id NOT IN (
      SELECT message_id FROM public.message_deletions
      WHERE user_id = auth.uid()
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Also clear the preview in chat_members (so the list shows no preview)
  UPDATE public.chat_members
  SET last_read_at = now(), manually_unread = false
  WHERE chat_id = p_chat_id AND user_id = auth.uid();

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION clear_chat_for_me(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. INDEXES FOR SHARED MEDIA
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_messages_chat_media
  ON public.messages(chat_id, created_at DESC)
  WHERE type IN ('image', 'video') AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_chat_files
  ON public.messages(chat_id, created_at DESC)
  WHERE type = 'file' AND deleted_at IS NULL;

  3. FILE STRUCTURE
text
src/features/chat-settings/
├── components/
│   ├── ContactProfileModal.tsx
│   ├── ChatOptionsMenu.tsx
│   ├── MuteSubmenu.tsx
│   ├── GroupMembersList.tsx
│   ├── AddMembersModal.tsx
│   ├── GroupSettingsScreen.tsx
│   ├── ReportModal.tsx
│   ├── SharedMediaView.tsx
│   ├── SharedMediaTab.tsx
│   ├── SharedFilesTab.tsx
│   ├── LeaveGroupModal.tsx
│   └── ClearChatModal.tsx
├── hooks/
│   ├── useContactProfile.ts
│   ├── useGroupMembers.ts
│   ├── useGroupSettings.ts
│   ├── useAddMembers.ts
│   ├── useReportUser.ts
│   ├── useSharedMedia.ts
│   ├── useLeaveGroup.ts
│   └── useClearChat.ts
└── lib/
    └── chatActions.ts             (chat action availability matrix)
Modified files:

ChatHeader.tsx (from #8a) — more menu (3-dot) opens ChatOptionsMenu

ChatPage route (from #8a) — mounts <ContactProfileModal> and <ChatOptionsMenu> when triggered

4. LIB: chatActions.ts
ts
export type ChatAction =
  | 'view_profile'
  | 'view_group_info'
  | 'search_in_chat'
  | 'mute'
  | 'unmute'
  | 'mark_unread'
  | 'pin'
  | 'unpin'
  | 'clear_chat'
  | 'block'
  | 'report'
  | 'view_members'
  | 'add_members'
  | 'leave_group';

export interface ChatActionContext {
  chat: Chat;
  currentUserId: string;
  isAdmin: boolean;
  isCreator: boolean;
  isMuted: boolean;
}

export function getAvailableChatActions(ctx: ChatActionContext): ChatAction[] {
  const { chat, isAdmin, isMuted } = ctx;

  if (chat.type === 'self') {
    return ['search_in_chat', 'pin', 'unpin', 'clear_chat'];
  }

  if (chat.type === 'direct') {
    return [
      'view_profile',
      'search_in_chat',
      isMuted ? 'unmute' : 'mute',
      'mark_unread',
      chat.pinned_at ? 'unpin' : 'pin',
      'clear_chat',
      'block',
      'report',
    ];
  }

  // group or community_chat
  const actions: ChatAction[] = [
    'view_group_info',
    'search_in_chat',
    isMuted ? 'unmute' : 'mute',
    'mark_unread',
    chat.pinned_at ? 'unpin' : 'pin',
    'clear_chat',
    'view_members',
  ];
  if (isAdmin) actions.push('add_members');
  actions.push('leave_group');
  return actions;
}
5. COMPONENT: ContactProfileModal
Triggered from: chat header (avatar / name click), or "View profile" in
ChatOptionsMenu.

Query: useContactProfile(userId) — fetches from profiles_visible +
user_settings (for privacy-respecting fields) + chat context (to know if
the action buttons should be enabled).

Layout (from Prompt #6's /profile/:username, condensed):

text
┌─────────────────────────────────────────┐
│  [Banner: gradient hash of user_id]  [✕]│
│  [Avatar - half overlapping banner]     │
│  Display Name                           │
│  @username  •  Online (or Last seen…)   │
│  Bio (truncated to 2 lines)             │
│  [Social links row: pills]              │
│                                         │
│  [Message] [Call] [Video]               │
│  [Block] [Report]                       │
│                                         │
│  View full profile →                    │
└─────────────────────────────────────────┘
Action behaviors:

Action	Behavior
Message	Closes modal, navigates to /chats/:chatId (existing chat) or opens MessageRequestsSection flow if chat.status === 'pending_request'
Call	Disabled if chat.status !== 'active' (tooltip: "Accept the chat request first"). Otherwise, closes modal + starts call (Prompt #12)
Video	Same as Call
Block	Opens block confirmation modal (from Prompt #6, section 6). On confirm → INSERT user_blocks → closes modal
Report	Opens <ReportModal>
View full profile →	Closes modal + navigates to /profile/:username
Full-screen on mobile, centered dialog on desktop (max-w-md).

Presence: rendered inline next to @username. Uses the same logic as
ChatHeader (last_seen within 2 min = "Online", etc.). If
presence_visible = false → hide presence entirely.

6. COMPONENT: ChatOptionsMenu
Triggered from: 3-dot menu button in ChatHeader (top-right).

Rendered as: mobile = bottom sheet; desktop = popover anchored to the
3-dot button.

Structure: flat list with 3 separator groups. Items are computed by
getAvailableChatActions (section 4).

Direct chat menu:

text
👤 View profile
🔍 Search in chat
🔕 Mute            → submenu (1h, 8h, 1d, 1w, Always, Unmute)
📬 Mark as unread
📌 Pin / Unpin
🗑️  Clear chat
─────
🚫 Block
⚠️  Report
Group / community menu:

text
ℹ️  Group info
🔍 Search in chat
🔕 Mute            → submenu
📬 Mark as unread
📌 Pin / Unpin
🗑️  Clear chat
─────
👥 View members
➕ Add members      (admin only)
─────
🚪 Leave group      (destructive color)
Self chat menu:

text
🔍 Search in chat
📌 Pin / Unpin
─────
🗑️  Clear chat
Mute submenu (MuteSubmenu): shows 6 options → clicking one runs
UPDATE chat_members SET muted_until = <calc> where calc is:

"1 hour" → now() + interval '1 hour'

"8 hours" → now() + interval '8 hours'

"1 day" → now() + interval '1 day'

"1 week" → now() + interval '1 week'

"Always" → '9999-12-31T23:59:59Z'::timestamptz

"Unmute" (only shown if muted) → NULL

Behavior:

Click on any action → closes menu → runs action

"Group info" → opens <GroupSettingsScreen> (section 9)

"View members" → opens <GroupMembersList> (section 7)

"Add members" → opens <AddMembersModal> (section 8)

"Block" / "Report" → opens respective modals

"Clear chat" → opens <ClearChatModal> (section 11)

"Leave group" → opens <LeaveGroupModal> (section 10)

"Search in chat" → toggles <InChatSearch> (from #8b)

7. COMPONENT: GroupMembersList
Full-screen view (mobile) / large dialog (desktop).

Layout:

text
┌────────────────────────────────────────┐
│  [←]  {N} members              [+ Add] │
│  ────────────────────────────────────  │
│  ADMINS                                 │
│  [Avatar] Alice                    ⋮   │
│            @alice                       │
│            (Admin badge if I am admin)  │
│  [Avatar] Bob (Creator)            ⋮   │
│            @bob                         │
│                                         │
│  MEMBERS                                │
│  [Avatar] Carol                    ⋮   │
│  [Avatar] Dave                     ⋮   │
│                                         │
└────────────────────────────────────────┘
Data: useGroupMembers(chatId) — query:

ts
supabase.from('chat_members')
  .select(`
    user_id, role, joined_at,
    profile:profiles_visible ( id, username, display_name, avatar_url )
  `)
  .eq('chat_id', chatId)
  .order('role', { ascending: false }) // admin first
  .order('joined_at', { ascending: true });
Row actions (visible only if I am admin):

Promote to admin (if member is member)

Demote from admin (if member is admin and not creator)

Remove from group (if member is not creator and not me)

Actions open a confirmation modal:

"Remove {name} from the group?" → confirm → remove_chat_member

"Promote {name} to admin?" → confirm → promote_chat_admin

"Demote {name} from admin?" → confirm → demote_chat_admin

Header: "+ Add" button (admin only) → opens <AddMembersModal>.

Row click → opens <ContactProfileModal> for that member.

8. COMPONENT: AddMembersModal
Full-screen on mobile, dialog on desktop.

Layout:

text
┌────────────────────────────────────────┐
│  [←]  Add members                       │
│  [🔍 Search by name or @username]       │
│  ────────────────────────────────────  │
│  SELECTED (N)                           │
│  [chip: Alice ×] [chip: Bob ×]          │
│  ────────────────────────────────────  │
│  CONTACTS                               │
│  ☑ [Avatar] Alice @alice                │
│  ☐ [Avatar] Carol @carol                │
│                                         │
│  OTHER USERS (from global search)       │
│  ☐ [Avatar] Dave @dave                  │
│                                         │
│  ────────────────────────────────────  │
│              [Add 2 members]            │
└────────────────────────────────────────┘
Data sources (combined, deduplicated by user_id):

Contacts: users with whom I have an active direct chat
(SELECT user_id FROM chat_members JOIN chats WHERE ...)

Global search: when query is non-empty, search profiles_visible by
username ILIKE '%{q}%' OR display_name ILIKE '%{q}%' (limit 20)

Exclusions: current chat members and myself.

Behavior:

Multi-select via checkbox

Max 50 selected → if 51st selected, toast "You can select up to 50 members at once"

Search triggers global fetch (debounced 300ms)

"Add N members" button disabled if 0 selected

On confirm → calls add_chat_members(chatId, selectedIds) (bulk RPC) →
toast "Added N members" → close modal → invalidate group-members query

9. COMPONENT: GroupSettingsScreen
Full-screen route: /chats/$chatId/info (or a modal depending on layout).
Registered as _authenticated.chats.$chatId.info.tsx.

Layout:

text
┌────────────────────────────────────────┐
│  [←]                                    │
│                                         │
│         [Large avatar]                  │
│         [Change photo] (admins)         │
│                                         │
│  Group name (editable if admin)         │
│  ──────────────────────────────         │
│  Description (editable if admin)        │
│  ──────────────────────────────         │
│                                         │
│  📅 Created on {date}                   │
│  👥 {N} members                         │
│                                         │
│  [View members →]                       │
│  [Shared media →]                       │
│                                         │
│  ──────────────────────────────         │
│  🚪 Leave group (destructive)           │
└────────────────────────────────────────┘
Editable fields (visible only to admins, otherwise read-only):

Group avatar: click avatar → opens AvatarPickerModal (from Prompt #6,
reuses the same component) → on save, uploads to avatars bucket with path
avatars/chat-{chat_id}/group-{timestamp}.webp + update_group_info

Group name: inline edit (input + save on blur)

Description: inline edit (textarea + save on blur)

Non-admin view: same layout, but fields are read-only (no edit triggers).

CTA navigations:

"View members" → /chats/$chatId/members

"Shared media" → /chats/$chatId/media

"Leave group" → opens <LeaveGroupModal>

10. COMPONENT: LeaveGroupModal
Confirmation dialog.

Body (dynamic based on state):

If not the only admin:

"Leave {group name}? You won't receive messages from this group anymore."

If I am the last admin:

"Leave {group name}? You're the last admin. The oldest member will be
promoted automatically."

If I am the only member (rare):

"Leave {group name}? This group will be deleted."

Buttons: "Cancel" / "Leave group" (destructive)

Action: DELETE FROM chat_members WHERE chat_id = ? AND user_id = auth.uid()

Trigger chat_members_after_delete (from #4b-2) handles promotion or chat
deletion

On success → toast "You left the group" → router.navigate({ to: '/chats' })

Invalidate chats query

11. COMPONENT: ClearChatModal
Confirmation dialog.

Body:

"Clear this chat? All messages will be removed from your view. Other
participants will still see them."

Buttons: "Cancel" / "Clear chat" (destructive)

Action: clear_chat_for_me(chatId) RPC

On success → toast "Chat cleared" → invalidate ['messages', chatId] +
['chats']

Modal closes, user stays on the chat (now empty)

12. COMPONENT: ReportModal
Dialog (mobile full-screen, desktop centered).

Layout:

text
┌────────────────────────────────────────┐
│  Report {displayName}                   │
│  ────────────────────────────────────  │
│  Why are you reporting this user?       │
│                                         │
│  ◉ Spam                                 │
│  ○ Harassment or bullying               │
│  ○ Inappropriate content                │
│  ○ Other                                │
│                                         │
│  [Description textarea - optional]      │
│  0/500                                  │
│                                         │
│  [Cancel]           [Submit report]     │
└────────────────────────────────────────┘
Behavior:

Description required only if "Other" selected (submit disabled otherwise)

On submit → useReportUser mutation:

ts
await supabase.from('reports').insert({
  reporter_id: currentUserId,
  reported_user_id: targetUserId,
  reason: selectedReason, // 'spam' | 'harassment' | 'inappropriate' | 'other'
  description: description || null,
});
RLS from #4b-1 (reports_insert_own) enforces reporter_id = auth.uid()

On success → toast "Report submitted. Thanks for helping keep SilverChat
safe." → close modal

No info revealed to the reported user (RLS on reports prevents it)

13. COMPONENT: SharedMediaView
Route: /chats/$chatId/media (pathless under _authenticated.chats.$chatId)

Layout:

text
┌────────────────────────────────────────┐
│  [←]  Shared media                     │
│  ────────────────────────────────────  │
│  [Media]  [Files]         ← tabs       │
│  ────────────────────────────────────  │
│                                         │
│  [Grid of thumbnails - 3 cols]          │
│  [  ] [  ] [  ]                         │
│  [  ] [  ] [  ]                         │
│  ...infinite scroll                     │
└────────────────────────────────────────┘
13.1 Media tab (SharedMediaTab)
Query (useSharedMedia(chatId, 'media')):

ts
supabase.from('messages')
  .select(`
    id, created_at, media_url:file_upload_id (
      bucket, path, width, height, mime_type
    )
  `)
  .eq('chat_id', chatId)
  .in('type', ['image', 'video'])
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .range(offset, offset + 29);
Grid:

3 columns (mobile), 4 columns (desktop)

Each cell: thumbnail (<img> for image, poster for video)

Aspect ratio 1:1 (use media_width/media_height to center-crop via
object-cover)

Video cells show a small <Play> icon overlay

Click cell → opens <MediaLightbox> (from #8a) with the full list as the
carousel source (Fase 2 pagination within lightbox, MVP shows single)

13.2 Files tab (SharedFilesTab)
Query (useSharedMedia(chatId, 'files')):

ts
supabase.from('messages')
  .select(`
    id, created_at, file_upload:file_upload_id (
      original_filename, size_bytes, mime_type, bucket, path
    )
  `)
  .eq('chat_id', chatId)
  .eq('type', 'file')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .range(offset, offset + 29);
List: each row:

<FileText> icon by extension (PDF, DOCX, XLSX, ZIP, generic)

Filename (truncated 40 chars)

Metadata: {size} · {date}

Download button → opens signed URL in new tab

13.3 Tabs behavior
Tab state in URL: ?tab=media|files (default: media)

Each tab's query runs only when it's active (enabled: tab === 'media')

Pagination via useInfiniteQuery, 30 per page, infinite scroll trigger

14. HOOKS
14.1 useContactProfile(userId)
ts
useQuery({
  queryKey: ['contact-profile', userId],
  queryFn: async () => {
    const [{ data: profile }, { data: chat }] = await Promise.all([
      supabase.from('profiles_visible').select('*').eq('id', userId).single(),
      supabase.from('chats')
        .select('id, status, type')
        .or(`direct_pair_key.eq.${directPairKey(userId, currentUserId)},...`)
        .maybeSingle(),
    ]);
    return { profile, chat };
  },
});
directPairKey(a, b) computes LEAST(a,b)::text || '::' || GREATEST(a,b)::text.

14.2 useGroupMembers(chatId)
Query with chat_members + profiles_visible join. Exposed mutations:

useAddMembers(chatId) → add_chat_members(chatId, userIds)

useRemoveMember(chatId) → remove_chat_member(chatId, userId)

usePromoteAdmin(chatId) → promote_chat_admin(chatId, userId)

useDemoteAdmin(chatId) → demote_chat_admin(chatId, userId)

All mutations invalidate ['group-members', chatId] + ['chats'].

14.3 useGroupSettings(chatId)
Fetch current group info (name, description, avatar_url). Mutation:
update_group_info(chatId, { name, description, avatar_url }) — only sends
changed fields.

14.4 useReportUser()
ts
useMutation({
  mutationFn: (input: { targetUserId: string; reason: string; description?: string }) =>
    supabase.from('reports').insert({
      reporter_id: currentUserId,
      reported_user_id: input.targetUserId,
      reason: input.reason,
      description: input.description ?? null,
    }),
});
14.5 useSharedMedia(chatId, type)
useInfiniteQuery with pageParam offset, 30 per page. Disabled when tab
isn't active.

14.6 useLeaveGroup(chatId)
Mutation: DELETE FROM chat_members WHERE chat_id = ? AND user_id = auth.uid()
→ invalidate chats + navigate to /chats.

14.7 useClearChat(chatId)
Mutation: clear_chat_for_me(chatId) → invalidate ['messages', chatId] +
['chats'].

15. ROUTES
text
src/routes/
├── _authenticated.chats.$chatId.tsx              (existing from #8a)
├── _authenticated.chats.$chatId.info.tsx         (new — GroupSettingsScreen)
├── _authenticated.chats.$chatId.members.tsx      (new — GroupMembersList)
├── _authenticated.chats.$chatId.media.tsx        (new — SharedMediaView)
ContactProfileModal, ChatOptionsMenu, AddMembersModal, ReportModal,
LeaveGroupModal, ClearChatModal are modal components (not routes) mounted
at the chat level when triggered.

Modal state pattern: a useUIStore (Zustand) with keys like
contactProfileModal: { open: boolean, userId: string | null }. Simpler than
URL state for transient modals.

16. MODIFIED: ChatHeader (from #8a)
Add:

3-dot menu button → opens <ChatOptionsMenu>

Avatar / name click → opens <ContactProfileModal> (direct) or navigates
to /chats/$chatId/info (group / community_chat)

17. MODIFIED: ChatPage route (from #8a)
Mount modals conditionally:

tsx
{uiStore.contactProfileModal.open && (
  <ContactProfileModal userId={uiStore.contactProfileModal.userId!} chatId={chatId} />
)}
{uiStore.chatOptionsMenu.open && (
  <ChatOptionsMenu chatId={chatId} />
)}
{uiStore.addMembersModal.open && (
  <AddMembersModal chatId={chatId} />
)}
{uiStore.reportModal.open && (
  <ReportModal userId={uiStore.reportModal.userId!} />
)}
{uiStore.leaveGroupModal.open && (
  <LeaveGroupModal chatId={chatId} groupName={chat.name} />
)}
{uiStore.clearChatModal.open && (
  <ClearChatModal chatId={chatId} />
)}
18. WHAT NOT TO INCLUDE
❌ Shared links tab (Fase 2)

❌ Message info screen (Fase 2)

❌ Group avatar composite (Fase 2)

❌ Member permissions beyond admin/member (Fase 2)

❌ Mute-by-user within a group (Fase 2)

❌ Member search within members list (Fase 2)

❌ Group invite links (Fase 2)

❌ Message pinning (already in #8b)

❌ In-chat search (already in #8b)

❌ Block confirmation modal (reused from Prompt #6)

❌ Avatar picker (reused from Prompt #6)

❌ The /profile/:username full page (already in Prompt #6)

19. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0010 (6 RPCs + 2
indexes), 12 components, 8 hooks, 1 lib (action matrix), modal state via
Zustand.

Complete migration file supabase/migrations/0010_chat_settings.sql.

Complete file tree of new/modified files.

Complete content of every file:

12 new components

8 hooks

1 lib (chatActions)

3 new routes

Modified ChatHeader, ChatPage

Verification checklist:

Click avatar in direct chat header → Contact profile modal opens →
shows correct info → "Message" navigates back → "Call" starts call
(Prompt #12) → "Block" opens confirmation → "Report" opens ReportModal

Click 3-dot in direct chat header → ChatOptionsMenu shows 8 items

Mute → submenu → select "8 hours" → chat shows muted icon in list

Unmute → muted icon disappears

Pin from menu → chat pins to top of list

Clear chat → confirmation → all messages disappear from my view → other
user still sees them

Click 3-dot in group chat → ChatOptionsMenu shows admin-specific items
(Add members only if admin)

Group info screen: read-only if not admin, editable if admin

Change group name → save on blur → updates everywhere

Change group avatar → opens AvatarPickerModal → save → updates

View members → see admins first, members below, owner badge on creator

As admin: promote member → member moves to admins section

As admin: demote non-creator admin → member moves to members

As admin: try to demote creator → error

As admin: remove member → member disappears from list

Add members → search → select 3 → "Add 3 members" → they join → see
system message (if implemented) or just appear in list

Add members with >50 selected → blocked

Leave group → confirmation → removed from chat → redirected to /chats

Last admin leaves → oldest member promoted (check via another admin)

Report user → select reason → submit → toast → report appears in DB

Shared media tab → grid of images/videos → click thumbnail → lightbox

Shared files tab → list of files → click download → opens signed URL

Media tab pagination works on chats with >30 media files

A short list of pitfalls to warn the developer:

Why block/remove actions require admin check on the server (client hides
the UI, but a malicious user could call the RPC directly)

Why creator cannot be demoted by others (prevents hostile takeovers of
groups)

Why add_chat_members silently skips blocked users instead of throwing
(avoids leaking block status to the adder)

Why clear_chat_for_me doesn't actually delete messages from the DB
(soft delete, other members still see them)

Why directPairKey must use LEAST/GREATEST (matches the DB computed
column from Prompt #4a)

Why the "Add members" search debounces 300ms (each keystroke triggers a
global query)

Why the contact profile modal hides last_seen_at when
presence_visible = false (Prompt #4b-1 policy already filters it via
profiles_visible, so last_seen_at will be NULL)

Why group settings screen is a route (/info) and not a modal (it's
reachable from outside the chat, e.g., notifications or chat list
context menu — Fase 2)

Why the mute submenu uses muted_until = '9999-12-31' for "Always"
instead of NULL (NULL means "not muted" in the schema; infinite
timestamps represent "always")

Do not implement Prompt #10+ features. Do not implement typing indicators.
Do not implement shared links. This completes the chat-related surfaces.
```
