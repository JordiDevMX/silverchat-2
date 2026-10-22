# SILVERCHAT — PROMPT #4b-1: RLS POLICIES & STORAGE SECURITY

You are a senior database security engineer implementing **Row Level Security
(RLS)** for SilverChat's Supabase/Postgres backend. This is the **most critical
prompt in the entire project** — privacy is guaranteed here, not in the
frontend.

This prompt covers:

- Helper functions (`SECURITY DEFINER`, `STABLE`)
- The `profiles_visible` privacy-filtered view
- RLS enablement + policies for all 21 tables (~60 policies total)
- Storage bucket policies (~12 policies)
- Reserved names for RPCs implemented in #4b-2

**This prompt does NOT cover:** business-logic triggers, RPC implementations,
Realtime publication, cron jobs. Those go in **#4b-2**.

All decisions below are **final and locked**.

---

## 1. SECURITY PHILOSOPHY

1. **Every table has RLS enabled**. No exceptions. `ALTER TABLE ... ENABLE
ROW LEVEL SECURITY;` on all 21 tables.
2. **Writes to sensitive tables go through RPCs only** (defined in #4b-2):
   `chats`, `chat_members` (INSERT), `chat_requests`, `channels` (INSERT),
   `communities` (INSERT), `community_members` (INSERT). Direct INSERT via
   client is blocked by the absence of an INSERT policy.
3. **Soft delete is the only delete** for user-generated content. `messages`,
   `chat_requests`, `stories` never hard-delete via client.
4. **Fair trade read receipts**: if a user disables read receipts, they can't
   see others' AND others can't see theirs. Bidirectional.
5. **Privacy is column-level** via `profiles_visible` view, not via RLS
   (RLS can't hide individual columns).

---

## 2. HELPER FUNCTIONS (SECURITY DEFINER, STABLE)

All functions below are:

- `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public`
- Owned by `postgres` (Supabase default)
- Grant `EXECUTE` to `authenticated` role only (not `anon`, not `service_role`)

### 2.1 `is_chat_member(p_chat_id uuid, p_user_id uuid) RETURNS boolean`

```sql
SELECT EXISTS (
  SELECT 1 FROM chat_members
  WHERE chat_id = p_chat_id AND user_id = p_user_id
);

2.2 is_chat_admin(p_chat_id uuid, p_user_id uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM chat_members
  WHERE chat_id = p_chat_id AND user_id = p_user_id AND role = 'admin'
);
2.3 is_blocked(p_blocker uuid, p_blocked uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM user_blocks
  WHERE blocker_id = p_blocker AND blocked_id = p_blocked
);
2.4 is_blocked_either_way(p_user_a uuid, p_user_b uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM user_blocks
  WHERE (blocker_id = p_user_a AND blocked_id = p_user_b)
     OR (blocker_id = p_user_b AND blocked_id = p_user_a)
);
2.5 is_contact(p_user_a uuid, p_user_b uuid) RETURNS boolean
"Contact" = has an active direct chat between the two users.

sql
SELECT EXISTS (
  SELECT 1 FROM chats
  WHERE type = 'direct'
    AND status = 'active'
    AND direct_pair_key =
      LEAST(p_user_a::text, p_user_b::text) || '::' ||
      GREATEST(p_user_a::text, p_user_b::text)
);
2.6 has_read_receipts_enabled(p_user_id uuid) RETURNS boolean
sql
SELECT COALESCE(
  (SELECT read_receipts_enabled FROM user_settings WHERE user_id = p_user_id),
  true
);
2.7 can_view_avatar(p_owner uuid, p_viewer uuid) RETURNS boolean
sql
SELECT CASE
  WHEN p_owner = p_viewer THEN true
  WHEN is_blocked_either_way(p_owner, p_viewer) THEN false
  ELSE COALESCE(
    (SELECT CASE
       WHEN profile_photo_visibility = 'everyone' THEN true
       WHEN profile_photo_visibility = 'nobody' THEN false
       WHEN profile_photo_visibility = 'contacts' THEN is_contact(p_owner, p_viewer)
       WHEN profile_photo_visibility = 'contacts_except' THEN
         is_contact(p_owner, p_viewer) AND NOT (p_viewer = ANY(profile_photo_exclusions))
       ELSE false
     END
     FROM user_settings
     WHERE user_id = p_owner),
    true
  )
END;
2.8 can_view_story(p_owner uuid, p_viewer uuid) RETURNS boolean
Same logic, but with story_visibility and story_exclusions:

sql
SELECT CASE
  WHEN p_owner = p_viewer THEN true
  WHEN is_blocked_either_way(p_owner, p_viewer) THEN false
  ELSE COALESCE(
    (SELECT CASE
       WHEN story_visibility = 'everyone' THEN true
       WHEN story_visibility = 'nobody' THEN false
       WHEN story_visibility = 'contacts' THEN is_contact(p_owner, p_viewer)
       WHEN story_visibility = 'contacts_except' THEN
         is_contact(p_owner, p_viewer) AND NOT (p_viewer = ANY(story_exclusions))
       ELSE false
     END
     FROM user_settings
     WHERE user_id = p_owner),
    true
  )
END;
2.9 is_channel_follower(p_channel_id uuid, p_user_id uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM channel_followers
  WHERE channel_id = p_channel_id AND user_id = p_user_id
);
2.10 is_channel_owner(p_channel_id uuid, p_user_id uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM channels
  WHERE id = p_channel_id AND owner_id = p_user_id
);
2.11 is_community_member(p_community_id uuid, p_user_id uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM community_members
  WHERE community_id = p_community_id AND user_id = p_user_id
);
2.12 is_message_deleted_for_user(p_message_id uuid, p_user_id uuid) RETURNS boolean
sql
SELECT EXISTS (
  SELECT 1 FROM message_deletions
  WHERE message_id = p_message_id AND user_id = p_user_id
);
2.13 is_chat_active(p_chat_id uuid) RETURNS boolean
Used by calls and messages INSERT to block interactions in
pending_request / rejected chats.

sql
SELECT EXISTS (
  SELECT 1 FROM chats WHERE id = p_chat_id AND status = 'active'
);
3. THE profiles_visible VIEW
3.1 Purpose
RLS cannot hide individual columns. To enforce column-level privacy
(avatar_url hidden, last_seen_at hidden), we expose a filtered view and
restrict direct access to the profiles table.

3.2 Rules
profiles table: RLS SELECT only own row (id = auth.uid())

profiles_visible view: run as owner (postgres), bypass profiles RLS,
apply privacy filtering inside the SELECT

Frontend: use profiles for the current user's own data; use
profiles_visible for everyone else

3.3 SQL
sql
CREATE OR REPLACE VIEW public.profiles_visible
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  CASE
    WHEN can_view_avatar(p.id, auth.uid()) THEN p.avatar_url
    ELSE NULL
  END AS avatar_url,
  CASE
    WHEN s.presence_visible = true THEN p.last_seen_at
    ELSE NULL
  END AS last_seen_at,
  p.social_links,
  p.created_at,
  p.updated_at
FROM public.profiles p
LEFT JOIN public.user_settings s ON s.user_id = p.id
WHERE NOT is_blocked_either_way(p.id, auth.uid());

GRANT SELECT ON public.profiles_visible TO authenticated;
Key points:

security_invoker = false → runs as view owner (postgres), bypasses
profiles RLS

security_barrier = true → prevents the optimizer from pushing WHERE
clauses below the view's filters (essential for privacy)

NOT is_blocked_either_way(...) → blocked users don't appear at all

Column-level filtering via can_view_avatar and presence_visible

4. RLS POLICIES — ALL 21 TABLES
Every table has RLS enabled. Each policy below uses TO authenticated (never
anon; unauthenticated users see nothing).

4.1 profiles
sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Only the owner can SELECT their profile row directly.
-- Other users' data is accessed via profiles_visible view.
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT policy: rows are created by handle_new_user() (SECURITY DEFINER).
-- No DELETE policy: rows cascade from auth.users deletion.
4.2 user_settings
sql
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT: created by handle_new_user().
-- No DELETE: cascades from profiles.
4.3 devices
sql
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devices_select_own" ON public.devices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "devices_insert_own" ON public.devices
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "devices_update_own" ON public.devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "devices_delete_own" ON public.devices
  FOR DELETE TO authenticated USING (user_id = auth.uid());
4.4 chats
sql
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chats_select_member" ON public.chats
  FOR SELECT TO authenticated
  USING (is_chat_member(id, auth.uid()));

-- No INSERT policy: chats are created via RPC create_chat() (see #4b-2).
-- No DELETE policy: chats are never deleted by clients.

CREATE POLICY "chats_update_admin_or_creator" ON public.chats
  FOR UPDATE TO authenticated
  USING (
    is_chat_admin(id, auth.uid())
    OR (type IN ('group', 'community_chat') AND created_by = auth.uid())
  )
  WITH CHECK (
    is_chat_admin(id, auth.uid())
    OR (type IN ('group', 'community_chat') AND created_by = auth.uid())
  );
4.5 chat_members
sql
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

-- No INSERT policy: added via RPC create_chat() / add_chat_member().

-- Users can only update their own membership row (pinned, favorited, muted, archived, last_read_at)
CREATE POLICY "chat_members_update_own" ON public.chat_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can leave a chat (delete own membership)
CREATE POLICY "chat_members_delete_own" ON public.chat_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
4.6 messages
sql
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- SELECT: member of the chat/channel AND not soft-deleted-by-me
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (
      chat_id IS NOT NULL AND is_chat_member(chat_id, auth.uid())
      AND NOT is_message_deleted_for_user(id, auth.uid())
    )
    OR
    (
      channel_id IS NOT NULL AND (
        is_channel_follower(channel_id, auth.uid())
        OR is_channel_owner(channel_id, auth.uid())
      )
    )
  );

-- INSERT: authenticated user, sender = self, chat/channel is accessible
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (chat_id IS NOT NULL AND is_chat_member(chat_id, auth.uid()))
      OR
      (channel_id IS NOT NULL AND is_channel_owner(channel_id, auth.uid()))
    )
  );

-- UPDATE policy #1: EDIT content within 15 minutes
-- Only content/edited_at can change (deleted_at and deleted_for_everyone must remain untouched)
CREATE POLICY "messages_edit_within_15min" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
    AND deleted_for_everyone = false
    AND (now() - created_at) < interval '15 minutes'
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND deleted_at IS NULL
    AND deleted_for_everyone = false
  );

-- UPDATE policy #2: DELETE-FOR-EVERYONE within 1 hour
-- Only deleted_at/deleted_for_everyone can change (must be set together)
CREATE POLICY "messages_delete_for_everyone_1h" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND deleted_at IS NULL
    AND (now() - created_at) < interval '1 hour'
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND deleted_at IS NOT NULL
    AND deleted_for_everyone = true
  );

-- Note: "delete for me" is handled via INSERT into message_deletions (see 4.10).
-- The two UPDATE policies above are mutually exclusive: edit requires
-- deleted_for_everyone=false AND deleted_at IS NULL; delete-for-everyone
-- requires both to be set. A single UPDATE cannot satisfy both WITH CHECKs,
-- preventing combined edit+delete in one transaction.
-- No DELETE policy: messages are never hard-deleted by clients.
4.7 message_receipts — fair trade
sql
ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

-- SELECT: viewer sees own receipt OR (viewer AND owner both have read receipts enabled)
CREATE POLICY "message_receipts_select_fair_trade" ON public.message_receipts
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      has_read_receipts_enabled(auth.uid())
      AND has_read_receipts_enabled(user_id)
      AND is_chat_member(
        (SELECT chat_id FROM messages WHERE id = message_id),
        auth.uid()
      )
    )
  );

-- INSERT/UPDATE: recipient marks own receipt
CREATE POLICY "message_receipts_insert_own" ON public.message_receipts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_receipts_update_own" ON public.message_receipts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
4.8 message_reactions
sql
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    is_chat_member(
      (SELECT chat_id FROM messages WHERE id = message_id),
      auth.uid()
    )
  );

CREATE POLICY "message_reactions_insert_own" ON public.message_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reactions_delete_own" ON public.message_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());
4.9 message_deletions — "delete for me"
sql
ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_deletions_select_own" ON public.message_deletions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "message_deletions_insert_own" ON public.message_deletions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- No DELETE: user can't "undo" a self-deletion via client.
4.10 chat_requests
sql
ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_requests_select_participant" ON public.chat_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- No INSERT/UPDATE/DELETE: all handled via RPCs
-- (create_chat_request, accept_chat_request, reject_chat_request).
4.11 user_blocks
sql
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());
4.12 reports
sql
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporter can see their own reports (for "your report status" UX).
CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

-- No UPDATE/DELETE: reports are immutable once submitted.
4.13 stories
sql
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stories_select" ON public.stories
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND can_view_story(user_id, auth.uid())
  );

CREATE POLICY "stories_insert_own" ON public.stories
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_update_own" ON public.stories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_delete_own" ON public.stories
  FOR DELETE TO authenticated USING (user_id = auth.uid());
4.14 story_views
sql
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "story_views_select" ON public.story_views
  FOR SELECT TO authenticated
  USING (
    viewer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM stories s
      WHERE s.id = story_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "story_views_insert_own" ON public.story_views
  FOR INSERT TO authenticated WITH CHECK (viewer_id = auth.uid());
4.15 channels
sql
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can see channel metadata (for discover/search).
CREATE POLICY "channels_select_authenticated" ON public.channels
  FOR SELECT TO authenticated USING (true);

-- No INSERT policy: created via RPC create_channel().

CREATE POLICY "channels_update_owner" ON public.channels
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "channels_delete_owner" ON public.channels
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
4.16 channel_followers
sql
ALTER TABLE public.channel_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_followers_select" ON public.channel_followers
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_channel_owner(channel_id, auth.uid())
  );

CREATE POLICY "channel_followers_insert_own" ON public.channel_followers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "channel_followers_update_own" ON public.channel_followers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "channel_followers_delete_own" ON public.channel_followers
  FOR DELETE TO authenticated USING (user_id = auth.uid());
4.17 communities
sql
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Members see their communities. Public search returns metadata only
-- (all fields are safe: name, description, avatar_url, member_count).
CREATE POLICY "communities_select" ON public.communities
  FOR SELECT TO authenticated USING (true);

-- No INSERT policy: created via RPC create_community().

CREATE POLICY "communities_update_owner" ON public.communities
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "communities_delete_owner" ON public.communities
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
4.18 community_members
sql
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_members_select" ON public.community_members
  FOR SELECT TO authenticated
  USING (is_community_member(community_id, auth.uid()));

-- No INSERT: added via RPC join_community().

CREATE POLICY "community_members_update_own" ON public.community_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_members_delete_own" ON public.community_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());
4.19 calls
sql
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- SELECT: chat member of an active chat
CREATE POLICY "calls_select" ON public.calls
  FOR SELECT TO authenticated
  USING (
    is_chat_member(chat_id, auth.uid())
    AND is_chat_active(chat_id)
  );

-- INSERT: chat must be active (blocked: pending_request / rejected chats
-- cannot initiate calls — prevents strangers from calling before acceptance)
CREATE POLICY "calls_insert_active_member" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (
    is_chat_member(chat_id, auth.uid())
    AND is_chat_active(chat_id)
    AND initiator_id = auth.uid()
  );

-- UPDATE: initiator or receiver in the chat
CREATE POLICY "calls_update_participant" ON public.calls
  FOR UPDATE TO authenticated
  USING (
    is_chat_member(chat_id, auth.uid())
    AND (initiator_id = auth.uid() OR is_chat_member(chat_id, auth.uid()))
  )
  WITH CHECK (is_chat_member(chat_id, auth.uid()));
4.20 file_uploads
sql
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

-- SELECT: uploader sees own files; users who can see the referencing
-- message/story see the file
CREATE POLICY "file_uploads_select" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM messages m
      WHERE m.file_upload_id = file_uploads.id
        AND (
          (m.chat_id IS NOT NULL AND is_chat_member(m.chat_id, auth.uid()))
          OR (m.channel_id IS NOT NULL AND (
            is_channel_follower(m.channel_id, auth.uid())
            OR is_channel_owner(m.channel_id, auth.uid())
          ))
        )
    )
    OR EXISTS (
      SELECT 1 FROM stories s
      WHERE s.file_upload_id = file_uploads.id
        AND can_view_story(s.user_id, auth.uid())
    )
  );

-- INSERT: uploader creates metadata before upload, path must contain own user_id
-- or chat_id they're a member of (scope validation)
CREATE POLICY "file_uploads_insert_own" ON public.file_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND status = 'pending'
  );

-- UPDATE: uploader marks complete / updates status
CREATE POLICY "file_uploads_update_own" ON public.file_uploads
  FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

-- DELETE: uploader, only if not referenced by any message/story
CREATE POLICY "file_uploads_delete_unreferenced" ON public.file_uploads
  FOR DELETE TO authenticated
  USING (
    uploader_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM messages WHERE file_upload_id = file_uploads.id)
    AND NOT EXISTS (SELECT 1 FROM stories WHERE file_upload_id = file_uploads.id)
  );
4.21 app_config
sql
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can READ config (needed for upload limits, feature flags).
CREATE POLICY "app_config_select_authenticated" ON public.app_config
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE: managed via SQL admin only.
5. STORAGE BUCKET POLICIES
5.1 Path structure (contract for policies)
text
avatars/{user_id}/avatar-{timestamp}.webp
chat-media/{chat_id}/{file_upload_id}/{filename}
story-media/{user_id}/{story_id}/{filename}
channel-media/{channel_id}/{file_upload_id}/{filename}
The first path segment (via storage.foldername(name)[1]) is always the
scope ID (user, chat, channel).

5.2 Enable RLS on storage.objects
Supabase enables RLS on storage.objects by default. Policies below assume
that's the case. Buckets are created in the Supabase dashboard (Prompt #6)
with public = false.

5.3 avatars bucket
sql
CREATE POLICY "avatars_select_visible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND can_view_avatar(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND ((string_to_array(name, '/'))[1])::uuid = auth.uid()
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((string_to_array(name, '/'))[1])::uuid = auth.uid()
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((string_to_array(name, '/'))[1])::uuid = auth.uid()
  );
5.4 chat-media bucket
sql
CREATE POLICY "chat_media_select_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND is_chat_member(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "chat_media_insert_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND is_chat_member(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );

-- Delete: only uploader (via file_uploads table check)
CREATE POLICY "chat_media_delete_uploader" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM file_uploads fu
      WHERE fu.uploader_id = auth.uid()
        AND fu.bucket = 'chat-media'
        AND fu.path = name
    )
  );
5.5 story-media bucket
sql
CREATE POLICY "story_media_select_visible" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'story-media'
    AND can_view_story(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "story_media_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'story-media'
    AND ((string_to_array(name, '/'))[1])::uuid = auth.uid()
  );

CREATE POLICY "story_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'story-media'
    AND ((string_to_array(name, '/'))[1])::uuid = auth.uid()
  );
5.6 channel-media bucket
sql
CREATE POLICY "channel_media_select_follower" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'channel-media'
    AND (
      is_channel_follower(
        ((string_to_array(name, '/'))[1])::uuid,
        auth.uid()
      )
      OR is_channel_owner(
        ((string_to_array(name, '/'))[1])::uuid,
        auth.uid()
      )
    )
  );

CREATE POLICY "channel_media_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel-media'
    AND is_channel_owner(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );

CREATE POLICY "channel_media_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'channel-media'
    AND is_channel_owner(
      ((string_to_array(name, '/'))[1])::uuid,
      auth.uid()
    )
  );
6. RPCs RESERVED FOR #4b-2
The following RPCs must be implemented in the NEXT prompt. Do not implement
them here — just register their names and signatures so the developer knows
what's coming and the RLS "no INSERT policy" decisions make sense.

RPC	Purpose
create_chat(target_user_id uuid, initial_message_id uuid)	Creates direct chat + membership + optional chat_request atomically
create_group_chat(name text, member_ids uuid[])	Creates group + memberships
add_chat_member(chat_id uuid, user_id uuid)	Adds member (admin only)
accept_chat_request(request_id uuid)	Sets chat.status='active', creates chat_members
reject_chat_request(request_id uuid)	Sets chat.status='rejected', sets rejected_at
create_channel(name text, slug text, description text)	Creates channel + auto-follows owner
follow_channel(channel_id uuid)	Adds follower + increments count
create_community(name text)	Creates community + owner membership + auto-joins to community_chats
join_community(community_id uuid)	Adds membership + auto-joins chat_members of all community_chats
mark_chat_as_read(chat_id uuid)	Updates last_read_at + inserts receipts atomically
send_message(...)	Optional transactional wrapper if multi-table writes needed
delete_message_for_everyone(message_id uuid)	Enforces 1h rule server-side (RLS also enforces, belt and suspenders)
get_my_storage_usage()	Returns SUM(size_bytes) from file_uploads for current user
7. WHAT NOT TO INCLUDE IN THIS PROMPT
❌ Business-logic triggers (auto-receipts on message insert, last_message_*
updates, member_count increments, etc.) — go in #4b-2

❌ RPC implementations — go in #4b-2

❌ Realtime publication settings — go in #4b-2

❌ Cron jobs (story expiry cleanup, file_uploads orphan cleanup) — go in #4b-2

❌ Seed data beyond what's mentioned

❌ Frontend code, migrations runner config

8. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing the 6 locked decisions:

profiles_visible view for column-level privacy

Fair trade read receipts (bidirectional)

15-minute edit limit

1-hour delete-for-everyone limit

RPC-only writes for chats, chat_members (INSERT), chat_requests,
channels (INSERT), communities (INSERT), community_members (INSERT)

Community chats only visible to community members

Complete SQL migration file supabase/migrations/0002_rls_policies.sql:

ALTER TABLE ... ENABLE ROW LEVEL SECURITY; for all 21 tables

All 13 helper functions in dependency order

The profiles_visible view

All policies per table, in the order listed in section 4

All storage policies per bucket

GRANT EXECUTE ON FUNCTION ... TO authenticated; for each helper

A summary table listing every table, number of policies, and a
one-line rationale per table.

The list of reserved RPC names (from section 6) as a reference for
the next prompt.

A verification checklist the developer can run manually with the
authenticated role (via the Supabase SQL editor with SET LOCAL role authenticated; SET LOCAL request.jwt.claim.sub = '<uuid>';):

User A cannot SELECT * FROM chats where they're not a member

User A cannot SELECT * FROM messages from a chat they're not in

User A cannot INSERT INTO chats directly (fails with no policy)

User A can UPDATE messages SET content='x' only within 15 min of
creation

User A can UPDATE messages SET deleted_for_everyone=true only within
1 hour

User A cannot combine edit + delete-for-everyone in one UPDATE
(contradictory WITH CHECKs)

User A with read_receipts_enabled=false cannot SELECT other users'
receipts; User B (enabled) also cannot see A's receipts

User A cannot SELECT * FROM profiles WHERE id != auth.uid() directly;
can query profiles_visible but avatar_url is NULL when B has
profile_photo_visibility='nobody'

last_seen_at is NULL in profiles_visible when the owner set
presence_visible=false

calls INSERT fails when chat.status='pending_request'

Storage: user cannot upload to avatars/{other_user_id}/...

Storage: user cannot download chat-media/{chat_id}/... for a chat
they're not a member of

A short list of pitfalls to warn the developer:

Why security_invoker = false on profiles_visible is essential

Why security_barrier = true prevents data leaks via query pushdown

Why SECURITY DEFINER + SET search_path = public on all helpers
prevents privilege escalation

Why chat_members INSERT is RPC-only (prevents self-add to foreign
groups)

Why message_deletions INSERT has no time limit (hide-for-me is
instant), but messages UPDATE for delete-for-everyone has 1h limit

Why calls.chat_id NOT NULL + is_chat_active() check prevents
stranger calls

Why read receipts fair trade is bidirectional (not just hiding your
own)

Why the two messages UPDATE policies' WITH CHECK clauses are
mutually exclusive (blocks combined edit+delete)

Do not implement business triggers, RPCs, Realtime, or cron jobs.
```
