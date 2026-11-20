-- Restrict reporting strictly to public spaces (public channels and visible profiles)
-- and add reported_channel_id support.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS reported_channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_reports_reported_channel
  ON public.reports (reported_channel_id)
  WHERE reported_channel_id IS NOT NULL;

REVOKE INSERT ON public.reports FROM authenticated;
GRANT INSERT (reporter_id, reported_user_id, reported_channel_id, reason, description)
  ON public.reports TO authenticated;

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;

CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND reported_chat_id IS NULL
    AND reported_message_id IS NULL
    AND reason IN ('spam', 'harassment', 'inappropriate', 'other')
    AND char_length(coalesce(description, '')) <= 500
    AND (reason <> 'other' OR char_length(btrim(coalesce(description, ''))) > 0)
    AND (
      (
        reported_channel_id IS NOT NULL
        AND reported_user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.channels c
          WHERE c.id = reported_channel_id
            AND c.owner_id IS DISTINCT FROM (SELECT auth.uid())
        )
      )
      OR
      (
        reported_user_id IS NOT NULL
        AND reported_channel_id IS NULL
        AND reported_user_id <> (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.profiles_visible p
          WHERE p.id = reported_user_id
        )
      )
    )
  );
