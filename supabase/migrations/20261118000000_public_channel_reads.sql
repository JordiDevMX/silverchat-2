-- Public channels are readable by any authenticated user without following.
-- Writes (posting, reacting, deleting) remain owner/follower gated.

DROP POLICY IF EXISTS "messages_select" ON public.messages;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (
      chat_id IS NOT NULL
      AND (
        public.is_chat_member(chat_id, (SELECT auth.uid()))
        OR EXISTS (
          SELECT 1 FROM public.chat_requests cr
          WHERE cr.chat_id = messages.chat_id
            AND cr.recipient_id = (SELECT auth.uid())
            AND cr.status = 'pending'
        )
      )
      AND NOT public.is_message_deleted_for_user(id, (SELECT auth.uid()))
    )
    OR
    (
      channel_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = messages.channel_id
      )
    )
  );

DROP POLICY IF EXISTS "message_reactions_select" ON public.message_reactions;

CREATE POLICY "message_reactions_select" ON public.message_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND (
          (m.chat_id IS NOT NULL AND public.is_chat_member(m.chat_id, (SELECT auth.uid())))
          OR (
            m.channel_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.channels c
              WHERE c.id = m.channel_id
            )
          )
        )
    )
  );

CREATE POLICY "file_uploads_select_public_channel" ON public.file_uploads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      WHERE m.channel_id IS NOT NULL
        AND (m.file_upload_id = file_uploads.id OR m.media_thumbnail_upload_id = file_uploads.id)
    )
  );

DROP POLICY IF EXISTS "channel_media_select_follower" ON storage.objects;

CREATE POLICY "channel_media_select_public" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'channel-media'
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = (split_part(storage.objects.name, '/', 1))::uuid
      )
      ELSE false
    END
  );
