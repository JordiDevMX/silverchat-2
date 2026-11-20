-- Partial indexes supporting RLS lookups on file_uploads and storage.objects
-- for chat-media, channel-media, and story-media reads.
CREATE INDEX IF NOT EXISTS idx_messages_file_upload
  ON public.messages(file_upload_id)
  WHERE file_upload_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stories_file_upload
  ON public.stories(file_upload_id)
  WHERE file_upload_id IS NOT NULL;
