-- Prompt 10. Version 0011 belongs to contact profiles/chat settings.
-- Apply after 0001–0011. Do not edit previously deployed migrations.
BEGIN;
ALTER TABLE public.messages ADD COLUMN reply_to_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL;
ALTER TABLE public.channel_followers ADD COLUMN muted_until timestamptz;
-- Persist private video thumbnails by upload ID, never by expiring signed URL.
ALTER TABLE public.stories ADD COLUMN media_thumbnail_upload_id uuid REFERENCES public.file_uploads(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_reply_to_story ON public.messages(reply_to_story_id) WHERE reply_to_story_id IS NOT NULL;
-- now() is not immutable, so it cannot appear in a partial index predicate.
CREATE INDEX idx_stories_active ON public.stories(user_id,expires_at,created_at DESC);
CREATE INDEX idx_stories_thumbnail ON public.stories(media_thumbnail_upload_id) WHERE media_thumbnail_upload_id IS NOT NULL;
CREATE INDEX idx_messages_channel_cursor ON public.messages(channel_id,created_at DESC,id DESC) WHERE channel_id IS NOT NULL;
GRANT INSERT(reply_to_story_id) ON public.messages TO authenticated;
GRANT UPDATE(muted_until) ON public.channel_followers TO authenticated;
-- Creation must go through the serialized limit/validation RPC. No story editing in MVP.
REVOKE INSERT(id,user_id,media_type,file_upload_id,text_content,background_color,caption),
 UPDATE(text_content,background_color,caption,expires_at) ON public.stories FROM authenticated;

CREATE FUNCTION public.create_story(
 p_media_type public.story_media_type, p_file_upload_id uuid DEFAULT NULL,
 p_text_content text DEFAULT NULL, p_background_color text DEFAULT NULL,
 p_caption text DEFAULT NULL, p_thumbnail_upload_id uuid DEFAULT NULL, p_story_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; f public.file_uploads;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 -- Serialize concurrent creations for the same user before counting active stories.
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 -- A stable client UUID makes retries safe after a response is lost.
 IF p_story_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.stories WHERE id=p_story_id AND user_id=auth.uid()) THEN RETURN p_story_id; END IF;
 IF (SELECT count(*) FROM public.stories WHERE user_id=auth.uid() AND expires_at>now())>=10
 THEN RAISE EXCEPTION 'You can have up to 10 active stories'; END IF;
 IF p_media_type IS NULL THEN RAISE EXCEPTION 'Story media type required'; END IF;
 IF length(p_caption)>500 THEN RAISE EXCEPTION 'Caption must be 500 characters or less'; END IF;
 IF p_media_type='text' THEN
  IF btrim(coalesce(p_text_content,''))='' OR length(p_text_content)>200 THEN RAISE EXCEPTION 'Text must contain 1 to 200 characters'; END IF;
  IF p_file_upload_id IS NOT NULL OR p_thumbnail_upload_id IS NOT NULL THEN RAISE EXCEPTION 'Text stories cannot include media'; END IF;
  IF p_background_color IS NULL OR NOT (p_background_color ~ '^#[0-9a-fA-F]{6}$' OR
   p_background_color ~ '^linear-gradient\(135deg, #[0-9a-fA-F]{6} 0%, #[0-9a-fA-F]{6} 100%\)$')
  THEN RAISE EXCEPTION 'Choose a valid story background'; END IF;
 ELSE
  SELECT * INTO f FROM public.file_uploads WHERE id=p_file_upload_id AND uploader_id=auth.uid()
   AND status='completed' AND bucket='story-media' AND split_part(path,'/',1)=auth.uid()::text;
  IF NOT FOUND OR (p_media_type='image' AND f.mime_type NOT LIKE 'image/%')
   OR (p_media_type='video' AND (f.mime_type NOT LIKE 'video/%' OR f.duration_seconds IS NULL OR f.duration_seconds NOT BETWEEN 1 AND 15))
  THEN RAISE EXCEPTION 'A completed story upload is required; videos must be at most 15 seconds'; END IF;
  IF p_text_content IS NOT NULL OR p_background_color IS NOT NULL THEN RAISE EXCEPTION 'Media stories use captions'; END IF;
  IF p_thumbnail_upload_id IS NOT NULL AND (p_media_type<>'video' OR NOT EXISTS (
   SELECT 1 FROM public.file_uploads WHERE id=p_thumbnail_upload_id AND uploader_id=auth.uid() AND status='completed'
    AND bucket='story-media' AND split_part(path,'/',1)=auth.uid()::text AND mime_type LIKE 'image/%'
  )) THEN RAISE EXCEPTION 'Invalid story thumbnail'; END IF;
 END IF;
 INSERT INTO public.stories(id,user_id,media_type,file_upload_id,text_content,background_color,caption,media_thumbnail_upload_id)
 VALUES(coalesce(p_story_id,gen_random_uuid()),auth.uid(),p_media_type,p_file_upload_id,p_text_content,p_background_color,p_caption,p_thumbnail_upload_id) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE FUNCTION public.mark_story_viewed(p_story_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 SELECT user_id INTO v_owner FROM public.stories WHERE id=p_story_id AND expires_at>now() FOR SHARE;
 IF NOT FOUND OR v_owner=auth.uid() THEN RETURN; END IF;
 IF NOT public.can_view_story(v_owner,auth.uid()) THEN RAISE EXCEPTION 'Story unavailable'; END IF;
 INSERT INTO public.story_views(story_id,viewer_id) VALUES(p_story_id,auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.delete_story(p_story_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 DELETE FROM public.stories WHERE id=p_story_id AND user_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized to delete this story'; END IF;
END $$;

CREATE FUNCTION public.get_story_viewers(p_story_id uuid)
RETURNS TABLE(viewer_id uuid,username text,display_name text,avatar_url text,viewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT sv.viewer_id,p.username,p.display_name,p.avatar_url,sv.viewed_at
 FROM public.story_views sv JOIN public.profiles_visible p ON p.id=sv.viewer_id
 WHERE sv.story_id=p_story_id AND public.auth_mfa_satisfied() AND EXISTS(
  SELECT 1 FROM public.stories WHERE id=p_story_id AND user_id=auth.uid())
 ORDER BY sv.viewed_at DESC,sv.viewer_id;
$$;

CREATE FUNCTION public.unfollow_channel(p_channel_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 DELETE FROM public.channel_followers WHERE channel_id=p_channel_id AND user_id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.create_channel(p_name text,p_slug text,p_description text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 IF btrim(coalesce(p_name,''))='' OR length(p_name)>100 THEN RAISE EXCEPTION 'Channel name must contain 1 to 100 characters'; END IF;
 IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{3,50}$' THEN RAISE EXCEPTION 'Slug must contain 3 to 50 lowercase letters, digits or hyphens'; END IF;
 IF length(p_description)>500 THEN RAISE EXCEPTION 'Description must be 500 characters or less'; END IF;
 BEGIN
  INSERT INTO public.channels(name,slug,description,owner_id) VALUES(btrim(p_name),p_slug,p_description,auth.uid()) RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Channel slug is already taken'; END;
 INSERT INTO public.channel_followers(channel_id,user_id) VALUES(v_id,auth.uid());
 RETURN v_id;
END $$;

CREATE FUNCTION public.update_channel_info(p_channel_id uuid,p_name text DEFAULT NULL,p_slug text DEFAULT NULL,p_description text DEFAULT NULL,p_avatar_url text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() OR NOT public.is_channel_owner(p_channel_id,auth.uid()) THEN RAISE EXCEPTION 'Only the channel owner can update it'; END IF;
 IF p_name IS NOT NULL AND (btrim(p_name)='' OR length(p_name)>100) THEN RAISE EXCEPTION 'Channel name must contain 1 to 100 characters'; END IF;
 IF p_slug IS NOT NULL AND p_slug !~ '^[a-z0-9-]{3,50}$' THEN RAISE EXCEPTION 'Slug must contain 3 to 50 lowercase letters, digits or hyphens'; END IF;
 IF length(p_description)>500 THEN RAISE EXCEPTION 'Description must be 500 characters or less'; END IF;
 IF p_avatar_url IS NOT NULL AND p_avatar_url<>'' AND (p_avatar_url !~ ('^chat-'||p_channel_id::text||'/channel-[a-zA-Z0-9-]+\.webp$') OR NOT EXISTS (
  SELECT 1 FROM storage.objects WHERE bucket_id='avatars' AND name=p_avatar_url
 )) THEN RAISE EXCEPTION 'Upload the photo to this channel first'; END IF;
 BEGIN
  UPDATE public.channels SET name=coalesce(p_name,name),slug=coalesce(p_slug,slug),description=coalesce(p_description,description),
   avatar_url=CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE nullif(p_avatar_url,'') END WHERE id=p_channel_id;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Channel slug is already taken'; END;
END $$;
REVOKE UPDATE(name,slug,description,avatar_url) ON public.channels FROM authenticated;

-- Story references may only be attached to a direct message to the visible story owner.
CREATE FUNCTION public.validate_novedades_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_owner uuid; v_upload uuid;
BEGIN
 IF NEW.reply_to_story_id IS NOT NULL THEN
  SELECT user_id INTO v_owner FROM public.stories WHERE id=NEW.reply_to_story_id AND expires_at>now()
   AND public.can_view_story(user_id,NEW.sender_id);
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.chats WHERE id=NEW.chat_id AND type='direct'
   AND direct_pair_key=least(v_owner,NEW.sender_id)::text||'::'||greatest(v_owner,NEW.sender_id)::text)
  THEN RAISE EXCEPTION 'Story reply target is unavailable'; END IF;
 END IF;
 IF NEW.channel_id IS NOT NULL THEN
  IF NEW.reply_to_message_id IS NOT NULL OR NEW.reply_to_story_id IS NOT NULL OR NEW.mentions IS NOT NULL
   THEN RAISE EXCEPTION 'Channels do not support replies or mentions'; END IF;
  FOREACH v_upload IN ARRAY ARRAY[NEW.file_upload_id,NEW.media_thumbnail_upload_id] LOOP
   IF v_upload IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.file_uploads WHERE id=v_upload
    AND uploader_id=NEW.sender_id AND status='completed' AND bucket='channel-media' AND split_part(path,'/',1)=NEW.channel_id::text)
   THEN RAISE EXCEPTION 'Media must be uploaded to this channel'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER messages_validate_novedades BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_novedades_message();
REVOKE ALL ON FUNCTION public.validate_novedades_message() FROM PUBLIC,anon,authenticated,service_role;

-- Extend existing action authorization to followed/owned channels, retaining chat behavior.
CREATE OR REPLACE FUNCTION public.can_access_chat_message(p_message_id uuid,p_include_deleted boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.auth_mfa_satisfied() AND EXISTS(
  SELECT 1 FROM public.messages m WHERE m.id=p_message_id AND (p_include_deleted OR NOT m.deleted_for_everyone)
   AND NOT public.is_message_deleted_for_user(m.id,auth.uid()) AND (
    (m.chat_id IS NOT NULL AND (public.is_chat_member(m.chat_id,auth.uid()) OR EXISTS(
     SELECT 1 FROM public.chat_requests r WHERE r.chat_id=m.chat_id AND r.recipient_id=auth.uid() AND r.status='pending')))
    OR (m.channel_id IS NOT NULL AND (public.is_channel_follower(m.channel_id,auth.uid()) OR public.is_channel_owner(m.channel_id,auth.uid())))
 ));
$$;
CREATE OR REPLACE FUNCTION public.set_message_reaction(p_message_id uuid,p_emoji text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.messages;
BEGIN
 IF NOT public.can_access_chat_message(p_message_id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 SELECT * INTO m FROM public.messages WHERE id=p_message_id AND type<>'system' AND NOT deleted_for_everyone FOR UPDATE;
 IF NOT FOUND OR (m.chat_id IS NOT NULL AND NOT public.is_chat_member(m.chat_id,auth.uid())) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
 IF p_emoji IS NULL THEN DELETE FROM public.message_reactions WHERE message_id=p_message_id AND user_id=auth.uid();
 ELSE
  IF length(p_emoji)<1 OR length(p_emoji)>32 THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  IF m.channel_id IS NOT NULL AND p_emoji NOT IN ('👍','❤️','😂','😮','😢','🙏','🔥','🎉') THEN RAISE EXCEPTION 'Choose one of the eight channel reactions'; END IF;
  INSERT INTO public.message_reactions(message_id,user_id,emoji) VALUES(p_message_id,auth.uid(),p_emoji)
   ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji,created_at=now();
 END IF;
END $$;
DROP POLICY message_reactions_select ON public.message_reactions;
CREATE POLICY message_reactions_select ON public.message_reactions FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.messages m WHERE m.id=message_id AND
 ((m.chat_id IS NOT NULL AND public.is_chat_member(m.chat_id,auth.uid())) OR
  (m.channel_id IS NOT NULL AND (public.is_channel_owner(m.channel_id,auth.uid()) OR public.is_channel_follower(m.channel_id,auth.uid())))))
);
DROP POLICY reactions_insert_accessible_message ON public.message_reactions;
CREATE POLICY reactions_insert_accessible_message ON public.message_reactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 EXISTS(SELECT 1 FROM public.messages m WHERE m.id=message_id AND NOT m.deleted_for_everyone AND m.type<>'system' AND
  ((m.chat_id IS NOT NULL AND public.is_chat_member(m.chat_id,auth.uid())) OR
   (m.channel_id IS NOT NULL AND emoji IN ('👍','❤️','😂','😮','😢','🙏','🔥','🎉') AND (public.is_channel_follower(m.channel_id,auth.uid()) OR public.is_channel_owner(m.channel_id,auth.uid())))))
);
CREATE POLICY messages_hide_personal_deletions ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT public.is_message_deleted_for_user(id,auth.uid()));

DROP POLICY story_views_select ON public.story_views;
CREATE POLICY story_views_select ON public.story_views FOR SELECT TO authenticated USING(viewer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.stories s WHERE s.id=story_id AND s.user_id=auth.uid()));
-- Direct inserts obey the same non-owner/visible-story rule as the RPC.
DROP POLICY story_views_insert_visible_story ON public.story_views;
CREATE POLICY story_views_insert_visible_story ON public.story_views AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.stories s WHERE s.id=story_id AND s.user_id<>auth.uid()));

CREATE OR REPLACE FUNCTION public.own_upload_is_referenced(p_upload_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT public.auth_mfa_satisfied() OR NOT EXISTS(SELECT 1 FROM public.file_uploads WHERE id=p_upload_id AND uploader_id=auth.uid())
  OR EXISTS(SELECT 1 FROM public.messages WHERE file_upload_id=p_upload_id OR media_thumbnail_upload_id=p_upload_id)
  OR EXISTS(SELECT 1 FROM public.stories WHERE file_upload_id=p_upload_id OR media_thumbnail_upload_id=p_upload_id);
$$;
CREATE POLICY file_uploads_select_novedades_thumbnail ON public.file_uploads FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.stories s WHERE s.media_thumbnail_upload_id=file_uploads.id) OR
 EXISTS(SELECT 1 FROM public.messages m WHERE m.channel_id IS NOT NULL AND m.media_thumbnail_upload_id=file_uploads.id)
);
-- Channel avatar read access follows public channel discovery; writes require ownership.
CREATE POLICY avatars_select_channel ON storage.objects FOR SELECT TO authenticated USING(bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN EXISTS(SELECT 1 FROM public.channels WHERE id=substring(split_part(storage.objects.name,'/',1) from 6)::uuid) ELSE false END);
CREATE POLICY avatars_insert_channel ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='avatars' AND CASE WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_channel_owner(substring(split_part(name,'/',1) from 6)::uuid,auth.uid()) ELSE false END);
CREATE POLICY avatars_update_channel ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='avatars' AND CASE WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_channel_owner(substring(split_part(name,'/',1) from 6)::uuid,auth.uid()) ELSE false END) WITH CHECK(bucket_id='avatars' AND CASE WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_channel_owner(substring(split_part(name,'/',1) from 6)::uuid,auth.uid()) ELSE false END);
CREATE POLICY avatars_delete_channel ON storage.objects FOR DELETE TO authenticated USING(bucket_id='avatars' AND CASE WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_channel_owner(substring(split_part(name,'/',1) from 6)::uuid,auth.uid()) ELSE false END) ;
CREATE POLICY channel_media_select_forwarded ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='channel-media' AND EXISTS(SELECT 1 FROM public.file_uploads f JOIN public.messages m ON m.file_upload_id=f.id OR m.media_thumbnail_upload_id=f.id
 WHERE f.bucket=storage.objects.bucket_id AND f.path=storage.objects.name AND NOT m.deleted_for_everyone AND public.can_access_chat_message(m.id))
);
DO $$ DECLARE fn text; BEGIN
 FOREACH fn IN ARRAY ARRAY[
  'create_story(public.story_media_type,uuid,text,text,text,uuid,uuid)','mark_story_viewed(uuid)',
  'delete_story(uuid)','get_story_viewers(uuid)','unfollow_channel(uuid)',
  'update_channel_info(uuid,text,text,text,text)','create_channel(text,text,text)'
 ] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM PUBLIC,anon,service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||fn||' TO authenticated';
 END LOOP;
END $$;
CREATE POLICY story_media_select_active ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (
 bucket_id <> 'story-media' OR EXISTS (
  SELECT 1 FROM public.file_uploads f WHERE f.bucket=storage.objects.bucket_id AND f.path=storage.objects.name
   AND (f.uploader_id=auth.uid() OR EXISTS(SELECT 1 FROM public.stories s
     WHERE s.expires_at>now() AND (s.file_upload_id=f.id OR s.media_thumbnail_upload_id=f.id)))
 )
);
SELECT cron.schedule('cleanup_orphan_uploads','0 3 * * *',$job$
 DELETE FROM public.file_uploads
 WHERE bucket <> 'avatars' AND status='completed' AND created_at < now()-interval '7 days'
 AND NOT EXISTS(SELECT 1 FROM public.messages WHERE file_upload_id=file_uploads.id OR media_thumbnail_upload_id=file_uploads.id)
 AND NOT EXISTS(SELECT 1 FROM public.stories WHERE file_upload_id=file_uploads.id OR media_thumbnail_upload_id=file_uploads.id);
$job$);
COMMIT;
