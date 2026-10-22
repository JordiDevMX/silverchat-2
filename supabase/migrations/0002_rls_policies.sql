-- SilverChat: Prompt 04b-1. All access is authenticated and deny-by-default.
-- Helper owners bypass RLS to avoid recursive membership policies.

CREATE OR REPLACE FUNCTION public.is_chat_member(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id);
$$;
ALTER FUNCTION public.is_chat_member(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_admin(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = p_user_id AND role = 'admin');
$$;
ALTER FUNCTION public.is_chat_admin(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_chat_admin(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_blocked(p_blocker uuid, p_blocked uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = p_blocker AND blocked_id = p_blocked);
$$;
ALTER FUNCTION public.is_blocked(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_blocked(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_blocked(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_blocked_either_way(p_user_a uuid, p_user_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE (blocker_id = p_user_a AND blocked_id = p_user_b) OR (blocker_id = p_user_b AND blocked_id = p_user_a));
$$;
ALTER FUNCTION public.is_blocked_either_way(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_blocked_either_way(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_blocked_either_way(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_contact(p_user_a uuid, p_user_b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chats WHERE type = 'direct' AND status = 'active' AND direct_pair_key = LEAST(p_user_a::text, p_user_b::text) || '::' || GREATEST(p_user_a::text, p_user_b::text));
$$;
ALTER FUNCTION public.is_contact(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_contact(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_contact(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_read_receipts_enabled(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT read_receipts_enabled FROM public.user_settings WHERE user_id = p_user_id), true);
$$;
ALTER FUNCTION public.has_read_receipts_enabled(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_read_receipts_enabled(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_read_receipts_enabled(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_avatar(p_owner uuid, p_viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_owner = p_viewer THEN true
    WHEN public.is_blocked_either_way(p_owner, p_viewer) THEN false
    ELSE COALESCE((
      SELECT CASE
        WHEN profile_photo_visibility = 'everyone' THEN true
        WHEN profile_photo_visibility = 'nobody' THEN false
        WHEN profile_photo_visibility = 'contacts' THEN public.is_contact(p_owner, p_viewer)
        WHEN profile_photo_visibility = 'contacts_except' THEN
          public.is_contact(p_owner, p_viewer) AND NOT (p_viewer = ANY(profile_photo_exclusions))
        ELSE false END
      FROM public.user_settings WHERE user_id = p_owner
    ), true)
  END;
$$;
ALTER FUNCTION public.can_view_avatar(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_view_avatar(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_avatar(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_story(p_owner uuid, p_viewer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_owner = p_viewer THEN true
    WHEN public.is_blocked_either_way(p_owner, p_viewer) THEN false
    ELSE COALESCE((
      SELECT CASE
        WHEN story_visibility = 'everyone' THEN true
        WHEN story_visibility = 'nobody' THEN false
        WHEN story_visibility = 'contacts' THEN public.is_contact(p_owner, p_viewer)
        WHEN story_visibility = 'contacts_except' THEN
          public.is_contact(p_owner, p_viewer) AND NOT (p_viewer = ANY(story_exclusions))
        ELSE false END
      FROM public.user_settings WHERE user_id = p_owner
    ), true)
  END;
$$;
ALTER FUNCTION public.can_view_story(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_view_story(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_story(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_channel_follower(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channel_followers WHERE channel_id = p_channel_id AND user_id = p_user_id);
$$;
ALTER FUNCTION public.is_channel_follower(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_channel_follower(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_channel_follower(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_channel_owner(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id AND owner_id = p_user_id);
$$;
ALTER FUNCTION public.is_channel_owner(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_channel_owner(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_channel_owner(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_community_member(p_community_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id);
$$;
ALTER FUNCTION public.is_community_member(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_community_member(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_message_deleted_for_user(p_message_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.message_deletions WHERE message_id = p_message_id AND user_id = p_user_id);
$$;
ALTER FUNCTION public.is_message_deleted_for_user(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_message_deleted_for_user(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_message_deleted_for_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_chat_active(p_chat_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chats WHERE id = p_chat_id AND status = 'active');
$$;
ALTER FUNCTION public.is_chat_active(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_chat_active(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_chat_active(uuid) TO authenticated;


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
ALTER VIEW public.profiles_visible OWNER TO postgres;
REVOKE ALL ON public.profiles_visible FROM PUBLIC, anon, service_role;
GRANT SELECT ON public.profiles_visible TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_settings_select_own" ON public.user_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_settings_update_own" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chats_select_member" ON public.chats
  FOR SELECT TO authenticated
  USING (is_chat_member(id, auth.uid()));

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

ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_members_select" ON public.chat_members
  FOR SELECT TO authenticated
  USING (is_chat_member(chat_id, auth.uid()));

CREATE POLICY "chat_members_update_own" ON public.chat_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_members_delete_own" ON public.chat_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "message_receipts_insert_own" ON public.message_receipts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_receipts_update_own" ON public.message_receipts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

ALTER TABLE public.message_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_deletions_select_own" ON public.message_deletions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "message_deletions_insert_own" ON public.message_deletions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER TABLE public.chat_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_requests_select_participant" ON public.chat_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_select_own" ON public.user_blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());

CREATE POLICY "user_blocks_insert_own" ON public.user_blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "user_blocks_delete_own" ON public.user_blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own" ON public.reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid());

CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

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

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select_authenticated" ON public.channels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "channels_update_owner" ON public.channels
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "channels_delete_owner" ON public.channels
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

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

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "communities_select" ON public.communities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "communities_update_owner" ON public.communities
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "communities_delete_owner" ON public.communities
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "community_members_select" ON public.community_members
  FOR SELECT TO authenticated
  USING (is_community_member(community_id, auth.uid()));

CREATE POLICY "community_members_update_own" ON public.community_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "community_members_delete_own" ON public.community_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select" ON public.calls
  FOR SELECT TO authenticated
  USING (
    is_chat_member(chat_id, auth.uid())
    AND is_chat_active(chat_id)
  );

CREATE POLICY "calls_insert_active_member" ON public.calls
  FOR INSERT TO authenticated
  WITH CHECK (
    is_chat_member(chat_id, auth.uid())
    AND is_chat_active(chat_id)
    AND initiator_id = auth.uid()
  );

CREATE POLICY "calls_update_participant" ON public.calls
  FOR UPDATE TO authenticated
  USING (
    is_chat_member(chat_id, auth.uid())
    AND (initiator_id = auth.uid() OR is_chat_member(chat_id, auth.uid()))
  )
  WITH CHECK (is_chat_member(chat_id, auth.uid()));

ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "file_uploads_insert_own" ON public.file_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "file_uploads_update_own" ON public.file_uploads
  FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "file_uploads_delete_unreferenced" ON public.file_uploads
  FOR DELETE TO authenticated
  USING (
    uploader_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM messages WHERE file_upload_id = file_uploads.id)
    AND NOT EXISTS (SELECT 1 FROM stories WHERE file_upload_id = file_uploads.id)
  );

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_config_select_authenticated" ON public.app_config
  FOR SELECT TO authenticated USING (true);

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

-- Explicit privileges complement row policies: a row-level UPDATE policy
-- does not prevent changing IDs, roles, counters, or server timestamps.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles','user_settings','devices','chats','chat_members','messages',
    'message_receipts','message_reactions','message_deletions','chat_requests',
    'user_blocks','reports','stories','story_views','channels','channel_followers',
    'communities','community_members','calls','file_uploads','app_config'
  ] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT UPDATE(username,display_name,first_name,last_name,avatar_url,bio,social_links,last_seen_at)
  ON public.profiles TO authenticated;
GRANT UPDATE(theme,accent,language,profile_photo_visibility,profile_photo_exclusions,
  presence_visible,story_visibility,story_exclusions,read_receipts_enabled,
  notifications_enabled,notification_sound_enabled,notification_previews_enabled)
  ON public.user_settings TO authenticated;
GRANT INSERT(user_id,device_name,device_type,user_agent,push_subscription),
  UPDATE(device_name,device_type,user_agent,last_active_at,push_subscription), DELETE
  ON public.devices TO authenticated;
GRANT UPDATE(name,description,avatar_url) ON public.chats TO authenticated;
GRANT UPDATE(last_read_at,pinned_at,favorited_at,archived_at,muted_until), DELETE
  ON public.chat_members TO authenticated;
GRANT INSERT(id,chat_id,channel_id,sender_id,type,content,reply_to_message_id,
  file_upload_id,location_data,contact_data),
  UPDATE(content,edited_at,deleted_at,deleted_for_everyone)
  ON public.messages TO authenticated;
GRANT INSERT(message_id,user_id,delivered_at,read_at), UPDATE(delivered_at,read_at)
  ON public.message_receipts TO authenticated;
GRANT INSERT(message_id,user_id,emoji), DELETE ON public.message_reactions TO authenticated;
GRANT INSERT(message_id,user_id) ON public.message_deletions TO authenticated;
GRANT INSERT(blocker_id,blocked_id), DELETE ON public.user_blocks TO authenticated;
GRANT INSERT(reporter_id,reported_user_id,reported_chat_id,reported_message_id,reason,description)
  ON public.reports TO authenticated;
GRANT INSERT(id,user_id,media_type,file_upload_id,text_content,background_color,caption),
  UPDATE(text_content,background_color,caption,expires_at), DELETE
  ON public.stories TO authenticated;
GRANT INSERT(story_id,viewer_id) ON public.story_views TO authenticated;
GRANT UPDATE(name,slug,description,avatar_url), DELETE ON public.channels TO authenticated;
GRANT INSERT(channel_id,user_id), UPDATE(last_read_at), DELETE
  ON public.channel_followers TO authenticated;
GRANT UPDATE(name,description,avatar_url), DELETE ON public.communities TO authenticated;
-- There are no mutable per-user fields on community_members in this phase.
-- Retain its specified UPDATE policy, but do not grant role/identity writes.
GRANT DELETE ON public.community_members TO authenticated;
GRANT INSERT(id,initiator_id,chat_id,type,livekit_room_name),
  UPDATE(status,answered_at,ended_at,duration_seconds) ON public.calls TO authenticated;
GRANT INSERT(id,uploader_id,bucket,path,original_filename,mime_type,size_bytes,
  width,height,duration_seconds,hash_sha256),
  UPDATE(status,completed_at,width,height,duration_seconds,hash_sha256), DELETE
  ON public.file_uploads TO authenticated;

-- SECURITY INVOKER intentionally: distinguish direct client writes from
-- trusted SECURITY DEFINER RPCs. Permissive UPDATE policies are OR-combined,
-- so the roadmap's two WITH CHECK expressions alone do not enforce its rules.
CREATE OR REPLACE FUNCTION public.guard_message_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF OLD.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the sender can change a message';
  END IF;
  IF OLD.deleted_at IS NOT NULL OR OLD.deleted_for_everyone THEN
    RAISE EXCEPTION 'Message is already deleted';
  END IF;
  IF NEW.deleted_for_everyone IS DISTINCT FROM OLD.deleted_for_everyone
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    IF NOT NEW.deleted_for_everyone OR NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Set deleted_at and deleted_for_everyone together';
    END IF;
    IF (to_jsonb(NEW) - ARRAY['deleted_at','deleted_for_everyone'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['deleted_at','deleted_for_everyone']) THEN
      RAISE EXCEPTION 'Cannot combine editing with delete-for-everyone';
    END IF;
    IF now() - OLD.created_at >= interval '1 hour' THEN
      RAISE EXCEPTION 'Delete-for-everyone is limited to one hour';
    END IF;
    NEW.deleted_at := now();
  ELSE
    IF (to_jsonb(NEW) - ARRAY['content','edited_at'])
       IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['content','edited_at']) THEN
      RAISE EXCEPTION 'Only content and edited_at can change during an edit';
    END IF;
    IF now() - OLD.created_at >= interval '15 minutes' THEN
      RAISE EXCEPTION 'Message editing is limited to 15 minutes';
    END IF;
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_message_update() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER messages_before_update_guard BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_update();

-- Deleted content must not remain readable by its recipients. The sender
-- retains access to their own row so direct soft-delete UPDATE/RETURNING works.
CREATE POLICY messages_hide_deleted_from_recipients ON public.messages
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT deleted_for_everyone OR sender_id = auth.uid());

-- The base own-row INSERT rules must also validate the referenced scope.
-- These restrictive policies are ANDed with the original policies above.
CREATE POLICY receipts_insert_accessible_message ON public.message_receipts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m WHERE m.id = message_id
      AND public.is_chat_member(m.chat_id, auth.uid())
  ));
CREATE POLICY reactions_insert_accessible_message ON public.message_reactions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id));
CREATE POLICY deletions_insert_accessible_message ON public.message_deletions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id));
CREATE POLICY story_views_insert_visible_story ON public.story_views
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id));

-- Reserved RPC contract, implemented in 0003: create_direct_chat_request,
-- create_self_chat, create_group_chat, add_chat_member, accept_chat_request,
-- reject_chat_request, create_channel, follow_channel, create_community,
-- join_community, mark_chat_as_read, delete_message_for_everyone,
-- get_my_storage_usage. 04b-2 supersedes 04b-1's provisional create_chat name.
