# SILVERCHAT — PROMPT #7: CHATS LIST

You are a senior frontend engineer implementing the **chats list** — the
most-used screen of SilverChat. This prompt covers the list, filters,
search, message requests, context menu, multi-select, swipe actions, drafts,
and realtime subscriptions.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 7 filters as **horizontal scrollable chips**: All · Favorites · Unread · Groups · Archived · Muted · Blocked                                                           |
| C2  | Global badge on Chats tab: real number, "99+" if over                                                                                                                  |
| C3  | Load all chats at once in MVP (LIMIT 200 default)                                                                                                                      |
| C4  | Hybrid interaction: long-press / right-click → context menu; "Select" button → multi-select mode; swipe actions (mobile) + hover actions (desktop)                     |
| C5  | Message requests shown as a **section above the main list** when filter is "All" or "Unread"                                                                           |
| C6  | **Self-chat is NOT auto-pinned.** Created via FAB → "New chat" → "Message yourself". Behaves like a normal chat                                                        |
| C7  | Timestamps via `Intl.DateTimeFormat` with user's locale                                                                                                                |
| C8  | Desktop: hover actions (pin/archive/mute icons) + right-click context menu                                                                                             |
| C9  | Unread badge: real number up to 99, then "99+". Hidden if chat is muted                                                                                                |
| C10 | Preview with prefixes by chat type (self/group/direct)                                                                                                                 |
| C11 | **WhatsApp-style checkmarks in the list** (only when last message is from me): ✓ sent, ✓✓ delivered, ✓✓ blue read. Plus critical states (failed/pending/draft/deleted) |
| C12 | Drafts in `localStorage['silverchat_draft_{chat_id}']`                                                                                                                 |
| C13 | Search: local, debounced 150ms                                                                                                                                         |
| C14 | Pull-to-refresh mobile + refresh button desktop                                                                                                                        |
| C15 | Realtime: `messages`, `chat_members`, `message_receipts`                                                                                                               |
| C16 | Empty states per filter: icon + text + CTA where applicable                                                                                                            |
| C17 | Flat list ordered by `pinned_at DESC NULLS LAST, last_message_at DESC NULLS LAST`                                                                                      |
| C18 | Archive and Delete coexist. Delete via RPCs + policy relaxation                                                                                                        |
| C19 | Mark-as-unread uses new `manually_unread boolean` column + dot badge (no number)                                                                                       |
| C20 | Rejected message request → chat silently disappears from sender's list; retry blocked for 7 days                                                                       |

---

## 2. MIGRATION `0007_chat_delete_adjustments.sql`

```sql
-- 1. Allow marking as unread via column
ALTER TABLE public.chat_members
  ADD COLUMN IF NOT EXISTS manually_unread boolean NOT NULL DEFAULT false;

-- 2. Relax last_read_at to allow NULL (kept for backward compat, not primary source)
ALTER TABLE public.chat_members
  ALTER COLUMN last_read_at DROP NOT NULL,
  ALTER COLUMN last_read_at DROP DEFAULT;

-- 3. Relax DELETE policy to allow direct chat hiding (per-user)
DROP POLICY IF EXISTS "chat_members_delete_own" ON public.chat_members;
CREATE POLICY "chat_members_delete_own" ON public.chat_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE id = chat_members.chat_id
        AND type IN ('direct', 'group', 'community_chat')
    )
  );
-- Self-chats excluded — they use delete_self_chat() RPC.

-- 4. RPC: mark chat as unread
CREATE OR REPLACE FUNCTION mark_chat_as_unread(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_members
  SET manually_unread = true
  WHERE user_id = auth.uid() AND chat_id = p_chat_id;
END;
$$;
GRANT EXECUTE ON FUNCTION mark_chat_as_unread(uuid) TO authenticated;

-- 5. Update mark_chat_as_read to clear manually_unread
CREATE OR REPLACE FUNCTION mark_chat_as_read(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_members
  SET last_read_at = now(), manually_unread = false
  WHERE user_id = auth.uid() AND chat_id = p_chat_id;

  UPDATE public.message_receipts
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND read_at IS NULL
    AND message_id IN (
      SELECT id FROM public.messages WHERE chat_id = p_chat_id
    );
END;
$$;
-- GRANT already exists from Prompt #4b-2

-- 6. RPC: delete self-chat (actually deletes the chat + all messages)
CREATE OR REPLACE FUNCTION delete_self_chat(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type chat_type;
  v_creator uuid;
BEGIN
  SELECT type, created_by INTO v_type, v_creator
  FROM public.chats WHERE id = p_chat_id;

  IF v_type IS DISTINCT FROM 'self' THEN
    RAISE EXCEPTION 'delete_self_chat only works on self-chats';
  END IF;
  IF v_creator IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.chats WHERE id = p_chat_id;
END;
$$;
GRANT EXECUTE ON FUNCTION delete_self_chat(uuid) TO authenticated;

-- 7. RPC: delete direct chat for me (removes my membership)
CREATE OR REPLACE FUNCTION delete_direct_chat_for_me(p_chat_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type chat_type;
BEGIN
  SELECT type INTO v_type FROM public.chats WHERE id = p_chat_id;
  IF v_type IS DISTINCT FROM 'direct' THEN
    RAISE EXCEPTION 'delete_direct_chat_for_me only works on direct chats';
  END IF;

  DELETE FROM public.chat_members
  WHERE chat_id = p_chat_id AND user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION delete_direct_chat_for_me(uuid) TO authenticated;

3. QUERY ARCHITECTURE
3.1 Two queries, one hook each
useChats() — main list query

ts
const { data } = await supabase
  .from('chats')
  .select(`
    id, type, name, avatar_url,
    last_message_at, last_message_preview, last_message_id,
    chat_members!inner (
      pinned_at, favorited_at, archived_at, muted_until,
      last_read_at, manually_unread
    ),
    last_message:messages!chats_last_message_id_fkey (
      id, sender_id, type, deleted_at, deleted_for_everyone
    )
  `)
  .eq('chat_members.user_id', user.id)
  .in('status', ['active'])
  .order('pinned_at', { ascending: false, nullsFirst: false })
  .order('last_message_at', { ascending: false, nullsFirst: false })
  .limit(200);
Then compute in memory (per chat):

unreadCount: SELECT COUNT(*) FROM message_receipts WHERE message_id IN (...) AND read_at IS NULL AND user_id = me — batched via a second query for all visible chats

lastMessageStatus: check/double-check/blue based on message_receipts aggregation for last_message_id

displayName: from chat_members + profiles_visible for direct/group, or chats.name for group/self/community_chat

avatarGradient: for direct chats without avatar_url, use getGradientForUser(other_user_id)

useMessageRequests() — pending requests query

ts
const { data } = await supabase
  .from('chat_requests')
  .select(`
    id, sender_id, chat_id, created_at,
    chat:chats!chat_requests_chat_id_fkey (
      id, last_message_preview, last_message_at
    ),
    sender:profiles_visible!chat_requests_sender_id_fkey (
      id, username, display_name, avatar_url
    )
  `)
  .eq('recipient_id', user.id)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
3.2 Realtime subscriptions
ts
useEffect(() => {
  const channel = supabase
    .channel('chats-list')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `chat_id=in.(${chatIds.join(',')})` },
        () => queryClient.invalidateQueries({ queryKey: ['chats'] }))
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['chats'] }))
    .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_receipts', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['chats'] }))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [chatIds, user.id]);
Optimization: instead of invalidating on every event, apply optimistic patches for common cases (new message → update last_message_at + increment unread). Invalidate only on structural changes (member added/removed).

4. COMPONENTS
4.1 /chats — src/routes/_authenticated.chats.tsx
Layout (top to bottom):

<AppHeader /> (existing from Prompt #2) with search bar for this tab

<ChatFilters /> — chips

If filter is "All" or "Unread" and messageRequests.length > 0 → <MessageRequestsSection />

<ChatList /> — the main list

If multi-select active → <MultiSelectToolbar /> replaces header

<NewChatFAB /> — floating action button bottom-right (already specified in Prompt #3)

<ChatContextMenu /> — triggered by long-press

Route setup:

tsx
export const Route = createFileRoute('/_authenticated/chats')({
  component: ChatsPage,
  validateSearch: (s) => ({
    filter: (s.filter as FilterKey) ?? 'all',
    q: (s.q as string) ?? '',
  }),
});

function ChatsPage() {
  const { filter, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  // ...
}
Filter + search state in URL (shareable, browser back works correctly).

4.2 ChatFilters — src/features/chats/components/ChatFilters.tsx
Horizontal scrollable row of chips. Below the header, above the list.

tsx
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'unread',    label: 'Unread' },
  { key: 'groups',    label: 'Groups' },
  { key: 'archived',  label: 'Archived' },
  { key: 'muted',     label: 'Muted' },
  { key: 'blocked',   label: 'Blocked' },
];
Styling:

Container: flex gap-2 overflow-x-auto px-4 py-2 no-scrollbar

Chip active: bg-primary text-primary-foreground

Chip inactive: bg-muted text-muted-foreground hover:bg-accent

On click → navigate({ search: (prev) => ({ ...prev, filter: key }) })

Selected chip scrolls into view on mount (scrollIntoView({ inline: 'center', block: 'nearest' }))

4.3 ChatListItem — src/features/chats/components/ChatListItem.tsx
The core row. Structure (left-to-right):

text
┌─────────────────────────────────────────────────────────────┐
│ [Avatar]  [Name + badges]          [Time]     [Badges]      │
│           [Preview line]                        [Unread]    │
└─────────────────────────────────────────────────────────────┘
Avatar (48×48):

If avatar_url → <img> (with lazy loading)

Else → gradient + initials (deterministic hash via getGradientForUser)

Presence dot (bottom-right, 10×10, green if last_seen_at within 5 min)

Name row:

Display name (font-weight 600)

Muted icon (VolumeX, 14px) if muted_until is in the future or NULL-with-mute = muted

Pinned icon (Pin, 14px) if pinned_at is not NULL

Favorite icon (Star, 14px) if favorited_at is not NULL

Verified badge (BadgeCheck, 14px, accent color) — for channels/verified users (Fase 2, but layout ready)

Preview line:

Format based on chat type:

self → {preview} (no prefix)

direct → You: {preview} if last message from me, else {preview}

group/community_chat → {sender_name}: {preview} (sender_name truncated if too long)

Type icons at the beginning of the preview:

text → none

image → <Image> icon

video → <Video> icon

audio → <Mic> icon

file → <FileText> icon

sticker → <Sticker> icon (or similar)

location → <MapPin>

contact → <User>

State overrides (rendered INSTEAD of preview):

deleted_for_everyone → This message was deleted (italic, muted)

failed (draft in localStorage with failed flag) → Message failed to send (danger color) + <AlertCircle> icon + "Tap to retry" behavior

pending → spinner icon + muted text

draft exists in localStorage → Draft: {preview} in italic + accent color

Checkmark at END of preview line if last message is from me:

sent → <Check> (single, muted)

delivered → <CheckCheck> (double, muted)

read → <CheckCheck> (double, accent/blue)

For groups with partial: show the "worst" state (delivered to 2 of 5 → single check)

Right column:

Time (12px, muted, tabular-nums)

Format via Intl.DateTimeFormat:

Today → HH:mm

Yesterday → Yesterday (localized)

Older → dd/MM (or locale short date)

Unread badges (below time):

If manually_unread → dot (8×8, accent color)

Else if unreadCount > 0 → numbered badge (bg-primary, white text, min-w-[20px], rounded-full). "99+" if > 99

If muted: no badge shown for unread count (but dot still shows if manually_unread)

If archived → small archive icon next to time

Row states:

Default: bg-background, hover bg-muted/50

Multi-select active + selected: bg-primary/10 border-l-2 border-primary

Bloqueado (chat with blocked user): dim 60% opacity

Interactions:

Click → navigate to /chats/{id}

Long-press (500ms) → opens ChatContextMenu

Right-click → same menu at cursor position

Hover (desktop only) → show quick-action icons: Pin, Archive, VolumeX (muted toggle)

Swipe left (mobile) → reveal actions: Archive (green), Mute (gray)

Swipe right (mobile) → reveal: Pin (blue), Mark Read (blue)

4.4 MessageRequestsSection — src/features/chats/components/MessageRequestsSection.tsx
Shown ONLY when filter is all or unread and requests exist.

Structure:

text
┌───────────────────────────────────────────────────────┐
│  Message requests (3)                      [See all]  │
│  ─────────────────────────────────────────────────    │
│  [Row 1]  [Avatar] Name @username           [✓] [✕]   │
│           Preview of first message...                 │
│  ─────────────────────────────────────────────────    │
│  [Row 2]  ...                                         │
└───────────────────────────────────────────────────────┘
Each request row shows:

Sender avatar + display name + @username

Preview of the FIRST message (chat.last_message_preview at request time)

Accept button (✓, green) → calls accept_chat_request(request_id)

Decline button (✕, red) → opens confirmation modal → reject_chat_request(request_id)

Clicking the row itself → navigate to /chats/{chat_id} (read-only until accepted)

Accept flow:

Call accept_chat_request(request_id)

Toast: "Chat request accepted"

Invalidate useChats() and useMessageRequests()

The chat now appears in the main list

Optionally navigate to the chat

Decline flow:

Confirmation modal: "Decline this chat request? {sender} won't be able to message you again for 7 days."

On confirm → reject_chat_request(request_id)

Toast: "Chat request declined"

Invalidate queries

Layout collapse: shows first 3 requests, "See all" navigates to /chats/requests (a sub-route, or same page with filter). For MVP, "See all" expands inline.

4.5 ChatContextMenu — src/features/chats/components/ChatContextMenu.tsx
Triggered by long-press / right-click on a ChatListItem.

Uses a portal-rendered, positioned menu (via Radix Popover or custom). Content:

Action	Icon	Behavior
Pin / Unpin	Pin	Toggle pinned_at
Favorite / Unfavorite	Star	Toggle favorited_at
Mute / Unmute	VolumeX	Opens mute-duration submenu
Archive / Unarchive	Archive	Toggle archived_at
Mark as read	Check	Calls mark_chat_as_read(chat_id)
Mark as unread	MailOpen	Calls mark_chat_as_unread(chat_id)
Block (destructive)	Ban	Opens block confirmation modal (from Prompt #6)
Delete chat (destructive)	Trash	Opens delete confirmation modal (see 4.5.1)
Actions toggle state based on current values. Muted submenu:

1 hour → muted_until = now() + interval '1 hour'

8 hours → + interval '8 hours'

1 day → + interval '1 day'

1 week → + interval '1 week'

Always → muted_until = NULL AND manually_muted = true... NO — for MVP use muted_until = '9999-12-31'::timestamptz for "always muted"

4.5.1 Delete confirmation modal
Different behavior by chat type:

Chat type	Confirmation text	Effect
direct	"This chat will be removed from your list. It will reappear if the other person messages you."	delete_direct_chat_for_me(chat_id)
group / community_chat	"You will leave this group. {if last admin} The oldest member will be promoted to admin."	DELETE FROM chat_members (via API)
self	"All your notes and messages to yourself will be permanently deleted."	delete_self_chat(chat_id)
4.6 MultiSelectToolbar — src/features/chats/components/MultiSelectToolbar.tsx
Replaces the header when multi-select is active.

Activation: Tap "Select" button in header (only visible in Chats tab).

Header content:

Left: ✕ (exit multi-select)

Center: "{N} selected"

Right: "Select all" / "Deselect all" button

Bottom toolbar (sticky, replaces FAB):

Mute (VolumeX) — silences selected

Archive — archives selected

Mark read (Check) — marks selected as read

Delete (Trash) — destructive, opens confirmation

Behavior:

Clicking rows toggles selection (checkbox appears at row start, replaces avatar)

Shift+click on desktop selects range

Long-press does NOT open context menu in multi-select mode

Exiting multi-select clears selections

4.7 ChatSearchBar — src/features/chats/components/ChatSearchBar.tsx
Already exists in header (from Prompt #2). In the Chats tab, placeholder is:

Default: "Search chats..." (i18n)

When messageRequests section is visible: still "Search chats..."

When filter is archived: "Search archived..."

On type:

Debounce 150ms → navigate({ search: (prev) => ({ ...prev, q: value }) })

Filtering logic (section 5.2)

If query is non-empty and no results: show "No chats match '{query}'" empty state

4.8 EmptyStates — src/features/chats/components/ChatsEmptyState.tsx
Rendered when list is empty and no requests. Content per filter:

Filter	Icon	Title	Subtitle	CTA
All	MessageSquare	"No chats yet"	"Start a conversation with someone."	"New chat" (opens FAB menu)
Favorites	Star	"No favorite chats"	"Long-press any chat to favorite it."	—
Unread	CheckCheck	"You're all caught up!"	"No unread messages."	—
Groups	Users	"No groups yet"	"Create a group or wait to be added."	"New group"
Archived	Archive	"No archived chats"	"Chats you archive will appear here."	—
Muted	VolumeX	"No muted chats"	"Chats you mute will appear here."	—
Blocked	Ban	"You haven't blocked anyone"	"Blocked contacts won't be able to message you."	—
Layout: centered vertically, icon 48px muted, title bold, subtitle muted, CTA button (primary color) if applicable.

4.9 NewChatFAB — src/features/chats/components/NewChatFAB.tsx
Floating button bottom-right (48×56, bg-primary, shadow-glow).

On click → opens a bottom sheet (mobile) / popover (desktop) with:

"New chat" → opens a modal with a search for existing contacts/users → navigates to /chats/new?userId=X

"New group" → navigates to /chats/new-group

"Message yourself" → calls create_self_chat() RPC → navigates to returned chat

"New channel" → navigates to /channels/new

4.10 SwipeActionsWrapper — src/features/chats/components/SwipeActions.tsx
Mobile-only wrapper for each ChatListItem. Uses touch events + CSS transforms.

Left swipe (reveal actions to the right of the row):

Archive (green, width 80px)

Mute (gray, width 80px)

Right swipe (reveal actions to the left):

Pin (accent, width 80px)

Mark read (accent, width 80px)

Behavior:

Snap threshold: 40% of action width

Once action revealed, click triggers it

Swipe past 90% = auto-trigger action (with haptic feedback if available)

Fully swiping left past 200px triggers Archive without showing action button

Uses touchstart, touchmove, touchend events

Desktop: disabled (uses hover actions instead)

5. FILTERING & SEARCH LOGIC
5.1 Filter application (in-memory)
ts
function applyFilter(chats: Chat[], filter: FilterKey, userId: string): Chat[] {
  switch (filter) {
    case 'all':
      return chats.filter(c => !c.archived_at);
    case 'favorites':
      return chats.filter(c => c.favorited_at && !c.archived_at);
    case 'unread':
      return chats.filter(c =>
        !c.archived_at &&
        (c.manually_unread || c.unreadCount > 0)
      );
    case 'groups':
      return chats.filter(c =>
        !c.archived_at &&
        (c.type === 'group' || c.type === 'community_chat')
      );
    case 'archived':
      return chats.filter(c => c.archived_at);
    case 'muted':
      return chats.filter(c => isMuted(c) && !c.archived_at);
    case 'blocked':
      return chats.filter(c =>
        c.type === 'direct' && c.otherUserIsBlocked
      );
    case 'requests':
      return []; // handled separately by MessageRequestsSection
  }
}

function isMuted(chat: Chat): boolean {
  if (chat.muted_until === null) return false;
  return new Date(chat.muted_until) > new Date();
}
5.2 Search (local, debounced)
ts
function applySearch(chats: Chat[], query: string): Chat[] {
  if (!query.trim()) return chats;
  const q = query.toLowerCase().trim();
  return chats.filter(c => {
    if (c.displayName.toLowerCase().includes(q)) return true;
    if (c.last_message_preview?.toLowerCase().includes(q)) return true;
    if (c.type === 'direct' && c.otherUsername?.toLowerCase().includes(q)) return true;
    if (c.type === 'group' && c.memberNames?.some(n => n.toLowerCase().includes(q))) return true;
    return false;
  });
}
Search applies AFTER filter, and only on the currently visible set.

5.3 Ordering
ts
function orderChats(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => {
    // Pinned first
    const aPinned = a.pinned_at ? 1 : 0;
    const bPinned = b.pinned_at ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;

    // Within pinned: most recently pinned first
    if (a.pinned_at && b.pinned_at) {
      return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
    }

    // Within unpinned: most recent message first
    const aLast = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bLast = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bLast - aLast;
  });
}
6. DRAFTS SYSTEM
6.1 Storage key
localStorage['silverchat_draft_{chat_id}']

Value shape:

json
{
  "text": "Hello...",
  "mediaUrls": [],
  "replyToId": null,
  "updatedAt": "2026-01-01T12:00:00Z"
}
6.2 Lifecycle
Write: debounced 500ms from the chat input component (Prompt #8)

Read: when rendering the chat list, Object.keys(localStorage).filter(k => k.startsWith('silverchat_draft_')) → build a Map<chat_id, Draft>

Clear: when message is sent, remove the key

Cleanup: on app mount, remove drafts older than 30 days

6.3 Display in the list
If a draft exists and updatedAt is newer than last_message_at:

Override the preview with: Draft: {text} in italic + accent color

Show a small "Draft" pill

If both draft AND unread messages exist:

Show draft in preview

Show unread badge anyway (they're orthogonal)

7. TIMESTAMP FORMATTING
ts
const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' });
const dtfTime = new Intl.DateTimeFormat(navigator.language, { hour: '2-digit', minute: '2-digit' });
const dtfShort = new Intl.DateTimeFormat(navigator.language, { day: '2-digit', month: '2-digit' });

function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1 && date.getDate() === now.getDate()) {
    return dtfTime.format(date);
  }
  if (diffDays < 2 && date.getDate() === now.getDate() - 1) {
    return rtf.format(-1, 'day'); // "Yesterday" / "Ayer"
  }
  return dtfShort.format(date);
}
Numbers use tabular-nums class.

8. ROUTE STRUCTURE
text
src/routes/_authenticated.chats.tsx              → /chats
src/routes/_authenticated.chats.$chatId.tsx      → /chats/:chatId  (Prompt #8)
src/routes/_authenticated.chats.new.tsx          → /chats/new      (Prompt #8)
src/routes/_authenticated.chats.new-group.tsx    → /chats/new-group (Prompt #8)
Search params on /chats:

filter: FilterKey (default all)

q: string (search query)

select: 'true' | undefined (multi-select mode)

selectedIds: comma-separated ids (multi-select state)

9. HOOKS
9.1 useChats() — src/features/chats/hooks/useChats.ts
TanStack Query wrapping the main query (section 3.1). Key: ['chats'].
Returns enriched Chat[]:

ts
interface Chat {
  id: string;
  type: 'direct' | 'group' | 'self' | 'community_chat';
  displayName: string;
  avatarUrl: string | null;
  avatarGradient: readonly [string, string];
  otherUserId?: string;
  otherUsername?: string;
  memberNames?: string[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageType: MessageType | null;
  lastMessageStatus: 'sent' | 'delivered' | 'read' | null;
  isMyLastMessage: boolean;
  unreadCount: number;
  manuallyUnread: boolean;
  pinnedAt: string | null;
  favoritedAt: string | null;
  archivedAt: string | null;
  mutedUntil: string | null;
  isBlocked: boolean;
  hasDraft: boolean;
  draftText: string | null;
}
9.2 useMessageRequests()
Returns MessageRequest[] with sender info.

9.3 useChunkedReceipts(chatIds, messageIds)
Batches unread count + last message status into one query per chunk of 50.

9.4 Mutations
useTogglePin() → UPDATE chat_members SET pinned_at = pinned_at IS NULL ? now() : NULL

useToggleFavorite() → same pattern with favorited_at

useToggleArchive() → same pattern with archived_at

useMuteChat() → UPDATE chat_members SET muted_until = <duration> or NULL

useMarkRead() → RPC mark_chat_as_read(chat_id)

useMarkUnread() → RPC mark_chat_as_unread(chat_id)

useAcceptRequest() → RPC accept_chat_request(request_id)

useRejectRequest() → RPC reject_chat_request(request_id)

useDeleteChat() → dispatches to appropriate RPC based on chat type

All mutations use optimistic updates via queryClient.setQueryData for instant UI feedback, then invalidate on settle.

10. WHAT NOT TO INCLUDE
❌ The chat view itself (Prompt #8)

❌ The new chat / new group modals (Prompt #8)

❌ Message composer (Prompt #8)

❌ The block confirmation modal (from Prompt #6 — reuse it)

❌ Push notifications (Fase 2)

❌ Server-side full-text search (Fase 2)

❌ Virtualization / infinite scroll (Fase 2, chats < 200)

❌ Voice message indicator in the list (Prompt #8 will handle audio UI)

❌ Group member avatars in list rows (Fase 2 for group composite avatars)

❌ Multi-account switcher (Fase 2)

❌ Custom reaction display in list (Fase 2)

❌ "Last seen" text in list rows (only presence dot)

11. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0007 (3 RPCs + policy relaxation + manually_unread column), 10 components, 2 hooks (useChats + useMessageRequests), 7 filters, realtime subscriptions, drafts in localStorage.

Complete migration file supabase/migrations/0007_chat_delete_adjustments.sql.

Complete file tree of new/modified files.

Complete content of every file:

The route src/routes/_authenticated.chats.tsx

9 feature components (ChatFilters, ChatListItem, MessageRequestsSection, ChatContextMenu, DeleteChatModal, MultiSelectToolbar, ChatsEmptyState, NewChatFAB, SwipeActions)

4 hooks (useChats, useMessageRequests, useChatMutations, useChatFilters)

2 utils (formatChatTimestamp, computeChatDisplay)

A verification checklist the developer can run:

7 filter chips visible, clicking each updates URL + list

Search filters live within the active filter

Long-press on a chat opens the context menu

Pin a chat → moves to top

Favorite → shows in "Favorites" filter

Mute → no badge on new messages, chat in "Muted" filter

Archive → disappears from "All", appears in "Archived"

Mark as unread → dot badge shown

Message request appears in the top section → accept → chat moves to main list

Decline → chat disappears, retry blocked for 7 days

Send a message → realtime updates list on another device

Draft in one chat → "Draft:..." in the list

Delete a direct chat → disappears from list, returns when other messages you

Delete a group → leaves group, trigger promotes new admin if needed

Delete a self-chat → chat fully removed

Swipe actions on mobile work

Hover actions on desktop work

Multi-select: select 3 chats → toolbar shows "3 selected" → mute all → all move to "Muted"

A short list of pitfalls to warn the developer:

Why manually_unread is a column instead of relying on last_read_at IS NULL
(mark_as_read sets receipts to read_at=now(), so clearing last_read_at
wouldn't resurrect the unread count — a boolean is unambiguous)

Why pending_request chats do NOT appear in the main list (they live in
MessageRequestsSection only)

Why the query LIMIT 200 is applied even though "load all at once" is the
decision — safety against pathological cases, adjustable in Fase 2

Why realtime invalidates via query key rather than patching state (simpler,
avoids stale merged state bugs; optimistic updates handle UX anyway)

Why Intl.RelativeTimeFormat needs numeric: 'auto' (gives "yesterday"
instead of "1 day ago")

Why block/delete actions live in the same context menu but with different
confirmation UX (block is reversible and non-destructive; delete is not)

Why self-chat deletion uses a dedicated RPC (delete_self_chat) instead of
chat_members DELETE (would orphan a chat with no members)

Why the search applies AFTER filter, not before (user expects filter to
scope the search, not the other way around)

Why drafts are read synchronously from localStorage on render (they must
be visible without a network call; they are user-local-only in MVP)

Do not implement Prompt #8 features. Do not implement channel lists or
community lists — those are Prompts #10 and #11.
```
