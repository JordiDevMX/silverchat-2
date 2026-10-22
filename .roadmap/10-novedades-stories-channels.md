# SILVERCHAT — PROMPT #10: NOVEDADES (STORIES & CHANNELS)

You are a senior frontend engineer implementing the **Novedades tab** — the
second main tab of SilverChat, containing ephemeral Stories (24h) and
broadcast Channels.

This prompt covers: Stories row, Story viewer, Story creator, Story viewers
sheet, Channels list, Channel view, Channel info, Create channel modal,
Discover channels.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

### Stories

| #   | Decision                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Fullscreen viewer, segmented progress bars, 5s (image/text) / 15s (video), tap L/R navigate, swipe down close, long-press pause |
| S2  | **Max 10 active stories per user** (not 30)                                                                                     |
| S3  | Video max 15s per segment                                                                                                       |
| S4  | Text stories: 8 preset background colors + custom color picker, max 200 chars                                                   |
| S5  | Caption **below** the image/video (not overlay)                                                                                 |
| S6  | Reply to story = DM to owner + `messages.reply_to_story_id`                                                                     |
| S7  | Owner sees "👁 {N} views" button → bottom sheet with viewers                                                                    |
| S8  | **Hard delete** (no soft delete)                                                                                                |
| S9  | "My story" card dynamic: camera icon if empty, preview + "+" if has stories                                                     |
| S10 | No push notifications for stories in MVP                                                                                        |

### Channels

| #   | Decision                                                                         |
| --- | -------------------------------------------------------------------------------- |
| C1  | Slug auto-generated from name, editable before create, regex `^[a-z0-9-]{3,50}$` |
| C2  | Verification via SQL admin only (no UI in MVP)                                   |
| C3  | Followers can react (8 emojis) but not comment                                   |
| C4  | Composer only visible to owner                                                   |
| C5  | Mute via new `channel_followers.muted_until` column                              |
| C6  | Unread badge 99+, resets on open, hidden if muted                                |
| C7  | 50 messages + infinite scroll up                                                 |
| C8  | Search only over followed + discovered channels (no global search)               |
| C9  | "Discover" = top 20 by `follower_count DESC` NOT followed                        |
| C10 | Channel view at `/channels/:channelId`                                           |
| C11 | Create via modal (bottom buttons + Chats FAB menu)                               |
| C12 | Channel info at `/channels/:channelId/info`                                      |
| C13 | No push notifications for channels in MVP                                        |
| C14 | Tab order: Stories → Channels → Discover → sticky bottom buttons                 |
| C15 | Story cards: my story first, unwatched before watched, DESC by date              |

Additional decisions:

- **Channel messages reuse `messages` table** with `channel_id` set
  (mutually exclusive with `chat_id` — CHECK already in Prompt #4a).
- **Channel view header is NOT the ChatHeader** — uses `ChannelHeader`
  (different: shows follower count, verified badge, follow/unfollow instead
  of call buttons).
- **Story viewer is a modal, not a route** — mounted at `/novedades` level.
- **Story reply input** opens a mini-composer at the bottom of the viewer;
  submitting creates/reuses direct chat and sends the message (via existing
  RPC flow from #4b-2).
- **Story views are tracked** only for non-owner viewers, upserted on open.
- **Preset text-story colors** reuse the 12 avatar gradient palettes from
  Prompt #6 (`AVATAR_GRADIENTS`), showing only the first 8 for simplicity.
- **Stories are hard-deleted**: either by owner action or by cron job
  (already in #4b-2 for expired stories).

---

## 2. MIGRATION `0011_stories_channels.sql`

```sql
-- ═══════════════════════════════════════════════════════════════
-- 1. SCHEMA ADDITIONS
-- ═══════════════════════════════════════════════════════════════

-- Story reply link
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_story_id uuid NULL
    REFERENCES public.stories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_story
  ON public.messages(reply_to_story_id)
  WHERE reply_to_story_id IS NOT NULL;

-- Channel follower mute
ALTER TABLE public.channel_followers
  ADD COLUMN IF NOT EXISTS muted_until timestamptz NULL;

-- Partial index for active stories
CREATE INDEX IF NOT EXISTS idx_stories_active
  ON public.stories(user_id, created_at DESC)
  WHERE expires_at > now();

-- ═══════════════════════════════════════════════════════════════
-- 2. RPC: CREATE STORY (enforces 10 active limit)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_story(
  p_media_type story_media_type,
  p_file_upload_id uuid DEFAULT NULL,
  p_text_content text DEFAULT NULL,
  p_background_color text DEFAULT NULL,
  p_caption text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
  v_story_id uuid;
BEGIN
  SELECT COUNT(*) INTO v_active_count
  FROM public.stories
  WHERE user_id = auth.uid() AND expires_at > now();

  IF v_active_count >= 10 THEN
    RAISE EXCEPTION 'You can have up to 10 active stories';
  END IF;

  IF p_media_type = 'text' AND p_text_content IS NULL THEN
    RAISE EXCEPTION 'Text stories require text content';
  END IF;
  IF p_media_type IN ('image', 'video') AND p_file_upload_id IS NULL THEN
    RAISE EXCEPTION 'Media stories require a file upload';
  END IF;
  IF p_text_content IS NOT NULL AND length(p_text_content) > 200 THEN
    RAISE EXCEPTION 'Text must be 200 characters or less';
  END IF;

  INSERT INTO public.stories (
    user_id, media_type, file_upload_id, text_content,
    background_color, caption
  ) VALUES (
    auth.uid(), p_media_type, p_file_upload_id, p_text_content,
    p_background_color, p_caption
  )
  RETURNING id INTO v_story_id;

  RETURN v_story_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_story(story_media_type, uuid, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. RPC: MARK STORY VIEWED (idempotent, skips owner)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION mark_story_viewed(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.stories WHERE id = p_story_id;
  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;
  IF v_owner_id = auth.uid() THEN
    RETURN;
  END IF;

  INSERT INTO public.story_views (story_id, viewer_id)
  VALUES (p_story_id, auth.uid())
  ON CONFLICT (story_id, viewer_id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION mark_story_viewed(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC: DELETE STORY (owner only, hard delete)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION delete_story(p_story_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.stories
    WHERE id = p_story_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this story';
  END IF;
  DELETE FROM public.stories WHERE id = p_story_id;
END;
$$;
GRANT EXECUTE ON FUNCTION delete_story(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC: UNFOLLOW CHANNEL
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION unfollow_channel(p_channel_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.channel_followers
  WHERE channel_id = p_channel_id AND user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION unfollow_channel(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. RPC: UPDATE CHANNEL INFO (owner only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_channel_info(
  p_channel_id uuid,
  p_name text DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_channel_owner(p_channel_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the channel owner can update it';
  END IF;

  IF p_slug IS NOT NULL AND NOT (p_slug ~ '^[a-z0-9-]{3,50}$') THEN
    RAISE EXCEPTION 'Slug must be 3-50 chars, lowercase letters, numbers, hyphens';
  END IF;

  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  UPDATE public.channels
  SET
    name = COALESCE(p_name, name),
    slug = COALESCE(p_slug, slug),
    description = COALESCE(p_description, description),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = p_channel_id;
END;
$$;
GRANT EXECUTE ON FUNCTION update_channel_info(uuid, text, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. RPC: GET STORY VIEWERS (owner only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_story_viewers(p_story_id uuid)
RETURNS TABLE (
  viewer_id uuid,
  username text,
  display_name text,
  avatar_url text,
  viewed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sv.viewer_id, p.username, p.display_name, p.avatar_url, sv.viewed_at
  FROM public.story_views sv
  JOIN public.profiles_visible p ON p.id = sv.viewer_id
  WHERE sv.story_id = p_story_id
    AND EXISTS (
      SELECT 1 FROM public.stories
      WHERE id = p_story_id AND user_id = auth.uid()
    )
  ORDER BY sv.viewed_at DESC;
$$;
GRANT EXECUTE ON FUNCTION get_story_viewers(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. RLS POLICY AMENDMENTS
-- ═══════════════════════════════════════════════════════════════

-- Allow owner to also see their own story views (from #4b-1 policy
-- "story_views_select" already allows this — verify)
DROP POLICY IF EXISTS "story_views_select" ON public.story_views;
CREATE POLICY "story_views_select" ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

-- Allow owner of channel to see follower list
-- (already allowed via is_channel_owner in #4b-1 policy, verify)

3. FILE STRUCTURE
text
src/routes/
├── _authenticated.novedades.tsx              (main Novedades tab)
├── _authenticated.channels.$channelId.tsx    (channel view)
└── _authenticated.channels.$channelId.info.tsx  (channel info)

src/features/novedades/
├── components/
│   ├── stories/
│   │   ├── StoriesRow.tsx
│   │   ├── StoryCard.tsx
│   │   ├── StoryViewer.tsx
│   │   ├── StoryProgressBar.tsx
│   │   ├── StoryViewersSheet.tsx
│   │   ├── StoryCreator.tsx
│   │   ├── StoryTextEditor.tsx
│   │   └── StoryReplyInput.tsx
│   └── channels/
│       ├── ChannelsSection.tsx
│       ├── ChannelListItem.tsx
│       ├── DiscoverChannelsSection.tsx
│       ├── ChannelView.tsx
│       ├── ChannelHeader.tsx
│       ├── ChannelInfoScreen.tsx
│       ├── CreateChannelModal.tsx
│       └── ChannelComposer.tsx
├── hooks/
│   ├── stories/
│   │   ├── useStories.ts
│   │   ├── useMyStories.ts
│   │   ├── useStoryViewers.ts
│   │   ├── useCreateStory.ts
│   │   ├── useDeleteStory.ts
│   │   ├── useMarkStoryViewed.ts
│   │   └── useStoryTimer.ts
│   └── channels/
│       ├── useChannels.ts
│       ├── useChannelMessages.ts
│       ├── useDiscoverChannels.ts
│       ├── useCreateChannel.ts
│       ├── useChannelInfo.ts
│       ├── useUpdateChannelInfo.ts
│       ├── useFollowChannel.ts
│       ├── useUnfollowChannel.ts
│       └── useMuteChannel.ts
└── lib/
    ├── storyColors.ts
    └── storyOrdering.ts
4. COMPONENT SPECS
4.1 Novedades route — /novedades
Layout:

<AppHeader> (search bar with placeholder "Buscar historias y canales...")

<StoriesRow> (horizontal scroll)

<ChannelsSection> (my followed channels)

<DiscoverChannelsSection> (top 20 suggested)

Sticky bottom: two buttons side-by-side

Left: [🧭 Explore more] (secondary, opens a future full-screen explore)

Right: [📢 Create channel] (primary, opens <CreateChannelModal>)

<StoryCreator> modal mounted conditionally

<StoryViewer> modal mounted conditionally

4.2 StoriesRow
Container: horizontal scroll, gap-3, padding-x-4, py-4.

First card = <StoryCard type="mine">

Followed by one <StoryCard> per contact with active stories

Order: my story → unwatched contacts (DESC by latest story created_at) → watched contacts (DESC)

useStories() query:

sql
SELECT
  s.user_id,
  p.username, p.display_name, p.avatar_url,
  MAX(s.created_at) AS last_created_at,
  COUNT(*) AS story_count,
  bool_or(
    NOT EXISTS (
      SELECT 1 FROM story_views sv
      WHERE sv.story_id = s.id AND sv.viewer_id = auth.uid()
    )
  ) AS has_unwatched
FROM stories s
JOIN profiles_visible p ON p.id = s.user_id
WHERE s.expires_at > now()
  AND s.user_id <> auth.uid()
  AND can_view_story(s.user_id, auth.uid())
GROUP BY s.user_id, p.username, p.display_name, p.avatar_url
ORDER BY last_created_at DESC;
4.3 StoryCard — my story (type="mine")
Empty state: dashed border, camera icon center, "Añadir historia" text

Has stories: preview of the most recent story + small "+" circle badge (top-right)

Click → if empty, opens StoryCreator; if has stories, opens StoryViewer for my stories

4.4 StoryCard — contact
Rounded card ~140×200, background = image/video thumbnail of latest story, or gradient (deterministic hash) if load fails

Top-left: avatar circle (32px) with ring (accent if has_unwatched, muted otherwise)

Bottom-left: display name (bold, white, text-xs, drop-shadow)

Click → opens StoryViewer for that user's stories

4.5 StoryViewer
Fullscreen modal. Props: userId, initialStoryIndex, onClose.

State:

storyIndex (current story in this user's list)

isPaused

viewersSheetOpen

replyInputOpen

Layout:

Segmented progress bars at top (one per story)

Header: avatar + name + timestamp ("2h ago") + close button (X) + owner 3-dot (only if mine)

Content area:

text → centered text on background_color, max-w-lg

image → <img> object-contain, full available space

video → <video autoplay muted={false}> — starts playing immediately, progress bar follows video duration (up to 15s)

Footer:

If mine: "👁 {N} views" button (left) → opens StoryViewersSheet

If not mine: StoryReplyInput (input + send button)

Hidden zones: left 30% tap = prev, right 70% tap = next

Long-press anywhere = pause

Progress animation: useStoryTimer manages a CSS animation per segment based on duration = story.media_type === 'video' ? videoDuration : 5000.

Auto-advance logic: onComplete → next story in same user → if last story of user, move to next user's stories → if no next user, close.

mark_story_viewed(story_id) called on segment start.

Video handling:

Pause progress bar while video buffering

On video ended → force-advance (even if before 15s)

If video > 15s → cut playback at 15s (set timeout)

4.6 StoryCreator
Full-screen modal. Three modes selectable via a small toolbar at bottom:

Camera (default) → <input type="file" accept="image/*,video/*" capture="environment">

Gallery → <input type="file" accept="image/*,video/*">

Text → opens StoryTextEditor

After media selected:

If image: compress to WebP (2048px, quality 0.82) → preview with caption input

If video: check duration ≤ 15s (show error if > 15s), generate thumbnail, preview with caption input

Bottom: [Cancel] [Send] buttons

Send flow:

Upload file to story-media/{userId}/{uploadId}/story.webp|mp4
Insert file_uploads row (pending → completed)
Call create_story(media_type, file_upload_id, null, null, caption) RPC
On success → close modal → invalidate useStories + useMyStories
4.7 StoryTextEditor
Fullscreen, background = selected color (default: first preset)

Textarea centered, max 200 chars, large font (text-3xl), white text

Bottom toolbar: horizontal color swatches (8 presets + custom color picker button)

Save → calls create_story('text', null, text, background_color, null)

Discard returns to StoryCreator

4.8 StoryViewersSheet
Bottom sheet. Props: storyId.

useStoryViewers(storyId) — calls get_story_viewers RPC.

Layout:

Title: "Viewed by {N}"

List: avatar + display name + @username + relative time ("5m ago")

Empty: "No views yet"

4.9 StoryReplyInput
Inside StoryViewer, bottom bar:

Input (max 500 chars) + send button

Placeholder: "Reply to {name}…"

On send:

Compute directPairKey(myId, ownerId)
Call create_direct_chat_request(ownerId, '') RPC (from #4b-2) — handles existing chat reuse
Insert message: { chat_id, sender_id: me, type: 'text', content, reply_to_story_id: story.id }
Toast: "Reply sent" + close input
Note: since reply_to_story_id is on messages, and message insert requires existing chat membership, the flow creates the chat first if needed. If the chat is pending_request, the message still inserts (per RLS in #4b-2).

4.10 ChannelsSection
List of followed channels. Header: "Canales" (uppercase, text-xs, muted).

useChannels() query:

sql
SELECT
  c.id, c.name, c.slug, c.avatar_url, c.is_verified,
  c.follower_count, c.last_message_at, c.last_message_preview,
  cf.last_read_at, cf.muted_until
FROM channels c
JOIN channel_followers cf ON cf.channel_id = c.id
WHERE cf.user_id = auth.uid()
ORDER BY c.last_message_at DESC NULLS LAST;
Unread count per channel: SELECT COUNT(*) FROM messages WHERE channel_id = X AND created_at > cf.last_read_at AND deleted_at IS NULL.

Each row: <ChannelListItem>

Avatar (gradient fallback if no avatar_url)

Name + verified badge (accent-colored check)

Preview (last message preview, truncated)

Right column: relative time + unread badge (or muted icon)

Click → navigate to /channels/:channelId

4.11 DiscoverChannelsSection
Header: "Encuentra canales para seguir".

useDiscoverChannels():

sql
SELECT id, name, slug, avatar_url, is_verified, follower_count, description
FROM channels
WHERE id NOT IN (
  SELECT channel_id FROM channel_followers WHERE user_id = auth.uid()
)
ORDER BY follower_count DESC
LIMIT 20;
Each row: avatar + name + verified + "{N} followers" + description (truncated). Right: [Follow] button.

Follow → follow_channel(channel_id) RPC → invalidate channels + discover

Optimistic: row removed from discover (since user now follows)

4.12 ChannelView — /channels/:channelId
Layout similar to ChatPage but read-only:

<ChannelHeader> — avatar + name + verified + follower count + follow/unfollow + mute (3-dot menu)

<MessageList> (reused from #8a with channelMode prop)

<ChannelComposer> — only visible if channel.owner_id === auth.uid()

useChannelMessages(channelId):

ts
useInfiniteQuery({
  queryKey: ['channel-messages', channelId],
  queryFn: ({ pageParam }) => {
    let q = supabase.from('messages')
      .select(`
        id, channel_id, sender_id, type, content, created_at,
        edited_at, deleted_at, deleted_for_everyone,
        file_upload:file_uploads (...),
        reactions:message_reactions ( emoji, user_id )
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (pageParam) q = q.lt('created_at', pageParam);
    return q;
  },
  initialPageParam: null,
  getNextPageParam: (last) => last.length === 50 ? last[49].created_at : undefined,
});
Reuse MessageBubble from #8a. But:

showAvatar → false for all (channel messages don't show avatar per message; the channel IS the sender)

Reactions → displayed, picker enabled (per C3)

Context menu → only react and copy (no reply, no delete, no edit for followers)

If owner viewing own message → full action matrix

ChannelComposer: reuses Composer from #8a but:

No reply bar (no reply support in channels)

Sends with channel_id set instead of chat_id

Send mutation:

ts
supabase.from('messages').insert({
  channel_id: channelId,
  sender_id: auth.uid(),
  type, content, file_upload_id,
})
RLS from #4b-1 (messages_insert) already enforces is_channel_owner

Auto-mark-read: on ChannelView mount, UPDATE channel_followers SET last_read_at = now() WHERE channel_id = X AND user_id = auth.uid().

4.13 ChannelInfoScreen — /channels/:channelId/info
Same layout as GroupSettingsScreen (#9) but for channels:

Large avatar (change if owner)

Name + @slug + verified badge + {N} followers

Description

"Created {date}"

Follow/Unfollow button

Mute menu (same submenu as chats)

If owner: "Edit channel" → reveals inline edit for name/slug/description + avatar upload

If owner: "Delete channel" (destructive, confirm modal) → DELETE FROM channels WHERE id = ? → cascade deletes messages + followers → navigate to /novedades

4.14 ChannelHeader
Compact: [back] [avatar] [name + verified + N followers] [3-dot]

3-dot menu: Follow/Unfollow · Mute submenu · Channel info · Copy link (Fase 2)

No call/video buttons (channels aren't chats)

4.15 CreateChannelModal
Form:

Name (1-100 chars)

Slug (auto-generated from name via slugify(), editable, regex ^[a-z0-9-]{3,50}$, live availability check debounced 500ms against channels.slug)

Description (optional, max 500)

Avatar (optional, file picker)

On submit:

create_channel(name, slug, description) RPC → returns channel_id

If avatar provided → upload to avatars/chat-{channel_id}/channel-{ts}.webp → update_channel_info(channel_id, null, null, null, avatarUrl)

follow_channel(channel_id) RPC (owner auto-follows — actually create_channel already does this)

Toast "Channel created" → navigate to /channels/:channelId/info

4.16 ChannelListItem
Row styled like a chat item:

Avatar 48×48

Line 1: name + verified badge

Line 2: last message preview (truncated 1 line)

Right: relative time + unread badge (if unread) OR mute icon (if muted)

Muted channels show the unread count in muted color (or hidden — decision: hidden, per Prompt #7 D9)

5. HOOKS SUMMARY
Stories
useStories() — aggregated stories by user (main list)

useMyStories() — current user's active stories

useStoryViewers(storyId) — RPC call, owner-only

useCreateStory() — RPC mutation

useDeleteStory() — RPC mutation

useMarkStoryViewed() — RPC mutation (fire-and-forget)

useStoryTimer(duration, onComplete, isPaused) — timer abstraction

Channels
useChannels() — followed channels list

useChannelMessages(channelId) — infinite messages

useDiscoverChannels() — top 20 non-followed

useCreateChannel() — RPC mutation

useChannelInfo(channelId) — single channel + user's follow state

useUpdateChannelInfo() — RPC mutation

useFollowChannel() — RPC mutation (existing from #4b-2)

useUnfollowChannel() — RPC mutation

useMuteChannel() — UPDATE channel_followers.muted_until

6. LIB: storyColors.ts
ts
// Reuses the 12 avatar gradients from Prompt #6, first 8 shown
import { AVATAR_GRADIENTS } from '@/features/profile/lib/avatar';

export const STORY_COLORS = AVATAR_GRADIENTS.slice(0, 8).map(
  ([from, to]) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
);
7. LIB: storyOrdering.ts
ts
export function orderStoryGroups(groups: StoryGroup[], myUserId: string): {
  mine: StoryGroup | null;
  unwatched: StoryGroup[];
  watched: StoryGroup[];
} {
  const mine = groups.find(g => g.user_id === myUserId) ?? null;
  const others = groups.filter(g => g.user_id !== myUserId);
  const unwatched = others.filter(g => g.has_unwatched);
  const watched = others.filter(g => !g.has_unwatched);
  return { mine, unwatched, watched };
}
8. REALTIME (MVP decisions)
Stories: no realtime. Refetch on tab focus.

Channels: subscribe to messages INSERT filtered by channel_id=eq.{channelId} while viewing the channel. List unread counts refetch on focus.

Stories views: no realtime (owner sees viewers count on manual refresh / reopening the sheet).

9. WHAT NOT TO INCLUDE
❌ Story text overlays / stickers / drawing (Fase 2)

❌ Story filters / AR (Fase 2)

❌ Story reactions (only replies, no emoji reacts on the story itself — Fase 2)

❌ Story archive / highlights (Fase 2)

❌ Global channel search (Fase 2)

❌ Channel comments / discussion threads (Fase 2)

❌ Channel verification UI (SQL admin only)

❌ Push notifications for stories/channels (Fase 2)

❌ Channel analytics / insights (Fase 2)

❌ Channel invite links (Fase 2)

❌ Stories in list view of channels (separate)

❌ Story videos > 15s (rejected at upload)

❌ Multi-segment creation flow for a single story post (each story is 1 segment)

❌ The Explore more button target page (button present, links to a placeholder that shows same DiscoverChannelsSection full-screen — Fase 2 gets richer)

10. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: migration 0011 (7 RPCs + 3 columns/indexes + RLS amendments), 16 components, 16 hooks, 2 libs, Stories + Channels flows.

Complete migration file supabase/migrations/0011_stories_channels.sql.

Complete file tree of new/modified files.

Complete content of every file:

3 routes: _authenticated.novedades.tsx, _authenticated.channels.$channelId.tsx, _authenticated.channels.$channelId.info.tsx

16 components

16 hooks

2 libs

Verification checklist:

Open /novedades: stories row shows "My story" + contact stories

No stories from contacts → empty row (or only "My story")

Click "My story" (empty) → opens StoryCreator → pick image → caption → send → story appears

Click contact story → StoryViewer opens → auto-advances in 5s → tap left goes back → tap right goes forward → swipe down closes

Viewer: video story auto-plays → 15s max or video ends → advances

Viewer: owner sees "👁 N views" → click → sheet with viewers

Viewer: non-owner has reply input → type → send → creates DM + message appears in chat with reference

Owner 3-dot → delete story → confirmation → deleted

11th story attempt → error "You can have up to 10 active stories"

Channels section shows followed channels (empty if none)

Discover section shows top 20 non-followed

Click Follow on a discover item → item disappears from discover → appears in my channels

Click channel → opens ChannelView → header shows name + followers + follow state

Non-owner sees messages read-only, no composer

Owner sees composer → sends message → appears in channel

Channel followers can react (8 emojis) but no context menu actions beyond react/copy

Muted channel → unread badge hidden, mute icon shown

Click channel info → see description + followers count + Edit button (owner only)

Owner edits name → save → reflected everywhere

Owner deletes channel → confirmation → cascade deletes → redirect to /novedades

"Create channel" modal → fill name → slug auto-updates → pick avatar → create → redirected to info

Slug collision → error toast

"Explore more" button → navigates to a full-screen discover view (placeholder same component)

A short list of pitfalls to warn the developer:

Why the 10-active-stories limit is enforced in the RPC, not the RLS (needs COUNT query, clearer error)

Why story_views uses ON CONFLICT DO NOTHING (idempotent, opening a story twice doesn't double-count)

Why story reply goes through create_direct_chat_request first (ensures chat exists, handles block/cooldown)

Why channel messages use channel_id instead of chat_id (mutually exclusive via CHECK constraint)

Why channel_followers.muted_until is separate from chat_members.muted_until (different tables, different scope)

Why channel mute doesn't use manually_muted boolean (uses muted_until = '9999-12-31' for "always muted" — consistent with chats)

Why the video cut at 15s is enforced client-side AND in create_story (client provides UX, server provides safety)

Why useStoryTimer uses requestAnimationFrame not setInterval (avoids drift during long stories)

Why channels don't have a "reply" action (topology is 1-to-many broadcast, not conversational)

Why ChannelView reuses MessageList but with channelMode prop (avoids duplicating pagination/scroll logic)

Why story viewer uses a modal and not a route (Instagram/WhatsApp pattern — modal is more fluid for the swipe-down-to-close gesture)

Do not implement Prompt #11+ features. Do not implement stories reactions. Do not implement channel comments. This completes the Novedades tab surfaces.
```
