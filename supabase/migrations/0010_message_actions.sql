-- Prompt 08b. Version 0009 is already used by device_fingerprint.
BEGIN;
ALTER TABLE public.messages
  ADD COLUMN media_peaks integer[] NULL,
  ADD COLUMN forwarded_from_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD CONSTRAINT messages_voice_peaks_valid CHECK (media_peaks IS NULL OR (
    type='audio' AND file_upload_id IS NOT NULL AND array_ndims(media_peaks)=1
    AND cardinality(media_peaks)=40 AND array_position(media_peaks,NULL) IS NULL
    AND 0 <= ALL(media_peaks) AND 100 >= ALL(media_peaks)
  ));
CREATE INDEX idx_messages_forwarded_from ON public.messages(forwarded_from_message_id)
  WHERE forwarded_from_message_id IS NOT NULL;
GRANT INSERT(media_peaks) ON public.messages TO authenticated;
-- Forward provenance and pin writes go through scoped RPCs, not broad UPDATE grants.
CREATE FUNCTION public.can_access_chat_message(p_message_id uuid,p_include_deleted boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.auth_mfa_satisfied() AND EXISTS (
  SELECT 1 FROM public.messages m WHERE m.id=p_message_id AND m.chat_id IS NOT NULL
   AND (p_include_deleted OR NOT m.deleted_for_everyone)
   AND NOT public.is_message_deleted_for_user(m.id,auth.uid())
   AND (public.is_chat_member(m.chat_id,auth.uid()) OR EXISTS (
    SELECT 1 FROM public.chat_requests r WHERE r.chat_id=m.chat_id AND r.recipient_id=auth.uid() AND r.status='pending'
   ))
 );
$$;

CREATE OR REPLACE FUNCTION public.validate_message_media_mentions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_upload uuid; v_type public.chat_type; source public.messages;
BEGIN
 IF NEW.chat_id IS NULL THEN RETURN NEW; END IF;
 SELECT type INTO v_type FROM public.chats WHERE id=NEW.chat_id;
 IF NEW.reply_to_message_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.messages m WHERE m.id=NEW.reply_to_message_id AND m.chat_id=NEW.chat_id
   AND public.can_access_chat_message(m.id) AND m.type<>'system'
 ) THEN RAISE EXCEPTION 'Reply target is unavailable in this chat'; END IF;
 IF NEW.mentions IS NOT NULL AND cardinality(NEW.mentions)>0 AND (
  v_type NOT IN ('group','community_chat') OR EXISTS (
   SELECT 1 FROM unnest(NEW.mentions) mention(user_id) WHERE mention.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.chat_members WHERE chat_id=NEW.chat_id AND user_id=mention.user_id
   )
  )
 ) THEN RAISE EXCEPTION 'Mentions must identify current group members'; END IF;
 IF NEW.forwarded_from_message_id IS NOT NULL THEN
  SELECT * INTO source FROM public.messages WHERE id=NEW.forwarded_from_message_id;
  IF NOT FOUND OR NOT public.can_access_chat_message(source.id) OR source.type='system'
    OR ROW(NEW.type,NEW.content,NEW.file_upload_id,NEW.media_thumbnail_upload_id,NEW.media_peaks,NEW.location_data,NEW.contact_data)
      IS DISTINCT FROM ROW(source.type,source.content,source.file_upload_id,source.media_thumbnail_upload_id,source.media_peaks,source.location_data,source.contact_data)
    OR NEW.reply_to_message_id IS NOT NULL OR NEW.mentions IS NOT NULL
  THEN RAISE EXCEPTION 'Forward source is unavailable or does not match'; END IF;
 ELSE
  FOREACH v_upload IN ARRAY ARRAY[NEW.file_upload_id,NEW.media_thumbnail_upload_id] LOOP
   IF v_upload IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.file_uploads f WHERE f.id=v_upload AND f.uploader_id=NEW.sender_id
      AND f.status='completed' AND f.bucket='chat-media' AND split_part(f.path,'/',1)=NEW.chat_id::text
   ) THEN RAISE EXCEPTION 'Media must be a completed upload owned by the sender in this chat'; END IF;
  END LOOP;
 END IF;
 IF NEW.media_thumbnail_upload_id IS NOT NULL AND (NEW.type<>'video' OR NEW.file_upload_id IS NULL)
 THEN RAISE EXCEPTION 'Only video messages may reference thumbnails'; END IF;
 IF NEW.media_peaks IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.file_uploads WHERE id=NEW.file_upload_id AND mime_type LIKE 'audio/%'
    AND duration_seconds>0 AND duration_seconds<=300
 ) THEN RAISE EXCEPTION 'Voice notes must have a duration of at most 5 minutes'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.check_pin_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_pinned_in_chat AND (TG_OP='INSERT' OR NOT OLD.is_pinned_in_chat) THEN
  -- Serialize contenders on the parent, including messages hidden by viewer RLS.
  PERFORM 1 FROM public.chats WHERE id=NEW.chat_id FOR UPDATE;
  IF NEW.chat_id IS NULL OR NEW.deleted_for_everyone OR NEW.type='system' THEN RAISE EXCEPTION 'This message cannot be pinned'; END IF;
  IF (SELECT count(*) FROM public.messages WHERE chat_id=NEW.chat_id AND is_pinned_in_chat
      AND NOT deleted_for_everyone AND deleted_at IS NULL AND id<>NEW.id)>=3
  THEN RAISE EXCEPTION 'Cannot pin more than 3 messages in this chat'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER messages_pin_limit BEFORE INSERT OR UPDATE ON public.messages
 FOR EACH ROW EXECUTE FUNCTION public.check_pin_limit();

CREATE FUNCTION public.set_message_pin(p_message_id uuid,p_pin boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_chat uuid;
BEGIN
 IF NOT public.can_access_chat_message(p_message_id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 SELECT chat_id INTO v_chat FROM public.messages WHERE id=p_message_id;
 PERFORM 1 FROM public.chats WHERE id=v_chat AND status='active' AND public.is_chat_member(id,auth.uid()) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active chat membership required'; END IF;
 UPDATE public.messages SET is_pinned_in_chat=p_pin WHERE id=p_message_id AND NOT deleted_for_everyone AND type<>'system';
 IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable'; END IF;
END $$;

CREATE FUNCTION public.validate_message_edit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.content IS DISTINCT FROM OLD.content AND current_user='authenticated' THEN
  IF OLD.type NOT IN ('text','image','video') OR (OLD.type='text' AND btrim(coalesce(NEW.content,''))='')
    OR (OLD.type IN ('image','video') AND length(NEW.content)>500)
  THEN RAISE EXCEPTION 'This message content cannot be edited'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER messages_validate_edit BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_message_edit();

CREATE FUNCTION public.delete_chat_message_for_me(p_message_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.can_access_chat_message(p_message_id,true) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 INSERT INTO public.message_deletions(message_id,user_id) VALUES(p_message_id,auth.uid()) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.set_message_reaction(p_message_id uuid,p_emoji text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_chat uuid;
BEGIN
 IF NOT public.can_access_chat_message(p_message_id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 SELECT chat_id INTO v_chat FROM public.messages WHERE id=p_message_id AND type<>'system' AND NOT deleted_for_everyone FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_member(v_chat,auth.uid()) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
 IF p_emoji IS NULL THEN DELETE FROM public.message_reactions WHERE message_id=p_message_id AND user_id=auth.uid();
 ELSE
  IF length(p_emoji)<1 OR length(p_emoji)>32 THEN RAISE EXCEPTION 'Invalid reaction'; END IF;
  INSERT INTO public.message_reactions(message_id,user_id,emoji) VALUES(p_message_id,auth.uid(),p_emoji)
    ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=EXCLUDED.emoji,created_at=now();
 END IF;
END $$;
DROP POLICY reactions_insert_accessible_message ON public.message_reactions;
CREATE POLICY reactions_insert_accessible_message ON public.message_reactions AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.messages m WHERE m.id=message_id AND NOT m.deleted_for_everyone AND m.type<>'system' AND public.is_chat_member(m.chat_id,auth.uid())));

-- Atomic batch, with caller-provided UUIDs for idempotent retry after a lost response.
CREATE FUNCTION public.forward_chat_message(p_message_id uuid,p_chat_ids uuid[],p_message_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source public.messages; target uuid; i integer; existing public.messages;
BEGIN
 IF NOT public.can_access_chat_message(p_message_id) THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 IF cardinality(p_chat_ids) IS NULL OR cardinality(p_chat_ids)<1 OR cardinality(p_chat_ids)>5
   OR cardinality(p_message_ids) IS DISTINCT FROM cardinality(p_chat_ids)
   OR array_position(p_chat_ids,NULL) IS NOT NULL OR array_position(p_message_ids,NULL) IS NOT NULL
   OR (SELECT count(DISTINCT x) FROM unnest(p_chat_ids)x)<>cardinality(p_chat_ids)
   OR (SELECT count(DISTINCT x) FROM unnest(p_message_ids)x)<>cardinality(p_message_ids)
 THEN RAISE EXCEPTION 'Select between 1 and 5 distinct chats'; END IF;
 -- Take all parent locks in one order before message rows / denormalized updates.
 PERFORM 1 FROM public.chats WHERE id=ANY(p_chat_ids) ORDER BY id FOR UPDATE;
 SELECT * INTO source FROM public.messages WHERE id=p_message_id AND NOT deleted_for_everyone AND type<>'system' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Message unavailable'; END IF;
 FOR i IN 1..cardinality(p_chat_ids) LOOP
  target:=p_chat_ids[i];
  IF NOT EXISTS(SELECT 1 FROM public.chats c JOIN public.chat_members cm ON cm.chat_id=c.id
     WHERE c.id=target AND c.status='active' AND cm.user_id=auth.uid() AND cm.archived_at IS NULL)
  THEN RAISE EXCEPTION 'Active unarchived chat membership required'; END IF;
  SELECT * INTO existing FROM public.messages WHERE id=p_message_ids[i];
  IF FOUND THEN
   IF existing.sender_id IS DISTINCT FROM auth.uid() OR existing.chat_id IS DISTINCT FROM target OR existing.forwarded_from_message_id IS DISTINCT FROM p_message_id
   THEN RAISE EXCEPTION 'Forward identifier already used'; END IF;
  ELSE
   INSERT INTO public.messages(id,chat_id,sender_id,type,content,file_upload_id,media_thumbnail_upload_id,media_peaks,location_data,contact_data,forwarded_from_message_id)
    VALUES(p_message_ids[i],target,auth.uid(),source.type,source.content,source.file_upload_id,source.media_thumbnail_upload_id,source.media_peaks,source.location_data,source.contact_data,source.id);
  END IF;
 END LOOP;
END $$;

-- Forwarded media keeps its original path/uploader; access follows a visible reference.
CREATE POLICY chat_media_select_shared_reference ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='chat-media' AND EXISTS (
  SELECT 1 FROM public.file_uploads f JOIN public.messages m ON m.file_upload_id=f.id OR m.media_thumbnail_upload_id=f.id
   WHERE f.bucket=storage.objects.bucket_id AND f.path=storage.objects.name
    AND NOT m.deleted_for_everyone AND public.can_access_chat_message(m.id)
 )
);

-- Preserve 08a redaction when the composite message type gains new payload fields.
CREATE OR REPLACE FUNCTION public.get_chat_messages(p_chat_id uuid,p_before_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.messages;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RETURN; END IF;
 IF NOT (public.is_chat_member(p_chat_id,auth.uid()) OR EXISTS (
  SELECT 1 FROM public.chat_requests WHERE chat_id=p_chat_id AND recipient_id=auth.uid() AND status='pending'
 )) THEN RETURN; END IF;
 FOR m IN SELECT * FROM public.messages WHERE chat_id=p_chat_id AND NOT public.is_message_deleted_for_user(id,auth.uid())
  AND (p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id)) ORDER BY created_at DESC,id DESC LIMIT 50
 LOOP
  IF m.deleted_for_everyone THEN
   m.content:=NULL;m.contact_data:=NULL;m.location_data:=NULL;m.file_upload_id:=NULL;m.media_thumbnail_upload_id:=NULL;
   m.mentions:=NULL;m.reply_to_message_id:=NULL;m.type:='text';m.media_peaks:=NULL;m.forwarded_from_message_id:=NULL;
  END IF;
  RETURN NEXT m;
 END LOOP;
END $$;
DO $$ DECLARE fn text; tab text; BEGIN
 FOREACH fn IN ARRAY ARRAY['can_access_chat_message(uuid,boolean)','set_message_pin(uuid,boolean)','delete_chat_message_for_me(uuid)','set_message_reaction(uuid,text)','forward_chat_message(uuid,uuid[],uuid[])'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM PUBLIC,anon,service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||fn||' TO authenticated';
 END LOOP;
 FOREACH fn IN ARRAY ARRAY['check_pin_limit()','validate_message_edit()'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION public.'||fn||' FROM PUBLIC,anon,authenticated,service_role';
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['message_reactions','message_deletions'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tab)
  THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tab); END IF;
 END LOOP;
END $$;
COMMIT;
