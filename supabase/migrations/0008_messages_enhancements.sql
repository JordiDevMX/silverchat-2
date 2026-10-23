BEGIN;
ALTER TABLE public.messages
  ADD COLUMN mentions uuid[] NULL,
  ADD COLUMN media_thumbnail_upload_id uuid REFERENCES public.file_uploads(id) ON DELETE SET NULL;
CREATE INDEX idx_messages_mentions ON public.messages USING gin(mentions) WHERE mentions IS NOT NULL;
CREATE INDEX idx_messages_thumbnail ON public.messages(media_thumbnail_upload_id) WHERE media_thumbnail_upload_id IS NOT NULL;
-- UUID tie-breaker prevents dropping messages with identical server timestamps.
DROP INDEX public.idx_messages_chat;
CREATE INDEX idx_messages_chat ON public.messages(chat_id,created_at DESC,id DESC) WHERE chat_id IS NOT NULL;
GRANT INSERT(mentions,media_thumbnail_upload_id) ON public.messages TO authenticated;

-- Dimensions/duration already live on file_uploads. A thumbnail is a tracked
-- private upload, not an expiring signed URL persisted on the message.
CREATE FUNCTION public.validate_message_media_mentions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_upload uuid; v_type public.chat_type;
BEGIN
  IF NEW.chat_id IS NULL THEN RETURN NEW; END IF;
  SELECT type INTO v_type FROM public.chats WHERE id=NEW.chat_id;
  IF NEW.mentions IS NOT NULL AND cardinality(NEW.mentions)>0 THEN
    IF v_type NOT IN ('group','community_chat') OR EXISTS (
      SELECT 1 FROM unnest(NEW.mentions) AS mention(user_id)
      WHERE mention.user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.chat_members WHERE chat_id=NEW.chat_id AND user_id=mention.user_id
      )
    ) THEN RAISE EXCEPTION 'Mentions must identify current group members'; END IF;
  END IF;
  FOREACH v_upload IN ARRAY ARRAY[NEW.file_upload_id,NEW.media_thumbnail_upload_id] LOOP
    IF v_upload IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.file_uploads f WHERE f.id=v_upload
        AND f.uploader_id=NEW.sender_id AND f.status='completed' AND f.bucket='chat-media'
        AND split_part(f.path,'/',1)=NEW.chat_id::text
    ) THEN RAISE EXCEPTION 'Media must be a completed upload owned by the sender in this chat'; END IF;
  END LOOP;
  IF NEW.media_thumbnail_upload_id IS NOT NULL AND (NEW.type <> 'video' OR NEW.file_upload_id IS NULL) THEN
    RAISE EXCEPTION 'Only video messages may reference thumbnails';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_validate_media_mentions BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_message_media_mentions();
REVOKE ALL ON FUNCTION public.validate_message_media_mentions() FROM PUBLIC,anon,authenticated,service_role;

CREATE POLICY file_uploads_select_message_media ON public.file_uploads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m WHERE
    (m.file_upload_id=file_uploads.id OR m.media_thumbnail_upload_id=file_uploads.id)
    AND (public.is_chat_member(m.chat_id,auth.uid()) OR EXISTS (
      SELECT 1 FROM public.chat_requests r WHERE r.chat_id=m.chat_id AND r.recipient_id=auth.uid() AND r.status='pending'
    )))
);
CREATE POLICY chat_media_select_pending_request ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='chat-media' AND EXISTS (
    SELECT 1 FROM public.file_uploads f JOIN public.messages m
      ON m.file_upload_id=f.id OR m.media_thumbnail_upload_id=f.id
    JOIN public.chat_requests r ON r.chat_id=m.chat_id
    WHERE f.bucket=storage.objects.bucket_id AND f.path=storage.objects.name
      AND r.recipient_id=auth.uid() AND r.status='pending'
  )
);
-- Do not let client cleanup discard a referenced thumbnail, even after the
-- uploader leaves a chat and can no longer SELECT its message rows.
CREATE FUNCTION public.own_upload_is_referenced(p_upload_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT public.auth_mfa_satisfied() OR NOT EXISTS (
    SELECT 1 FROM public.file_uploads WHERE id=p_upload_id AND uploader_id=auth.uid()
  ) OR EXISTS (SELECT 1 FROM public.messages WHERE file_upload_id=p_upload_id OR media_thumbnail_upload_id=p_upload_id)
    OR EXISTS (SELECT 1 FROM public.stories WHERE file_upload_id=p_upload_id);
$$;
REVOKE ALL ON FUNCTION public.own_upload_is_referenced(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.own_upload_is_referenced(uuid) TO authenticated;
DROP POLICY file_uploads_delete_unreferenced ON public.file_uploads;
CREATE POLICY file_uploads_delete_unreferenced ON public.file_uploads FOR DELETE TO authenticated USING (
  uploader_id=auth.uid() AND NOT public.own_upload_is_referenced(id)
);
DROP POLICY chat_media_delete_uploader ON storage.objects;
CREATE POLICY chat_media_delete_uploader ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='chat-media' AND EXISTS (SELECT 1 FROM public.file_uploads f
    WHERE f.uploader_id=auth.uid() AND f.bucket='chat-media' AND f.path=name
      AND NOT public.own_upload_is_referenced(f.id))
);
SELECT cron.schedule('cleanup_orphan_uploads','0 3 * * *',$job$
  DELETE FROM public.file_uploads
  WHERE bucket <> 'avatars' AND status='completed' AND created_at < now()-interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM public.messages WHERE file_upload_id=file_uploads.id OR media_thumbnail_upload_id=file_uploads.id)
    AND NOT EXISTS (SELECT 1 FROM public.stories WHERE file_upload_id=file_uploads.id);
$job$);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
-- Profiles remain owner-only. UI presence polls profiles_visible (30s/60s).
-- Return redacted tombstones without granting access to retained deleted content.
-- This read-only RPC mirrors chat messages_select, including per-user deletion.
CREATE FUNCTION public.get_chat_messages(p_chat_id uuid, p_before_at timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL)
RETURNS SETOF public.messages LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public.messages;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RETURN; END IF;
  IF NOT (public.is_chat_member(p_chat_id,auth.uid()) OR EXISTS (
    SELECT 1 FROM public.chat_requests WHERE chat_id=p_chat_id AND recipient_id=auth.uid() AND status='pending'
  )) THEN RETURN; END IF;
  FOR m IN SELECT * FROM public.messages WHERE chat_id=p_chat_id
    AND NOT public.is_message_deleted_for_user(id,auth.uid())
    AND (p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id))
    ORDER BY created_at DESC,id DESC LIMIT 50
  LOOP
    IF m.deleted_for_everyone THEN
      m.content:=NULL; m.contact_data:=NULL; m.location_data:=NULL;
      m.file_upload_id:=NULL; m.media_thumbnail_upload_id:=NULL;
      m.mentions:=NULL; m.reply_to_message_id:=NULL; m.type:='text';
    END IF;
    RETURN NEXT m;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.get_chat_messages(uuid,timestamptz,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid,timestamptz,uuid) TO authenticated;

COMMIT;
