-- Apply this file manually via Supabase SQL Editor for remote.

CREATE OR REPLACE FUNCTION public.get_story_viewers(p_story_id uuid)
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
  SELECT
    sv.viewer_id,
    p.username,
    p.display_name,
    CASE
      WHEN public.can_view_avatar(p.id, auth.uid()) THEN p.avatar_url
      ELSE NULL
    END AS avatar_url,
    sv.viewed_at
  FROM public.story_views sv
  JOIN public.profiles p ON p.id = sv.viewer_id
  LEFT JOIN public.user_settings us ON us.user_id = p.id
  WHERE sv.story_id = p_story_id
    AND EXISTS (
      SELECT 1 FROM public.stories
      WHERE id = p_story_id AND user_id = auth.uid()
    )
    AND NOT public.is_blocked_either_way(p.id, auth.uid())
  ORDER BY sv.viewed_at DESC;
$$;

-- Supporting index
CREATE INDEX IF NOT EXISTS idx_story_views_story_viewed
  ON public.story_views(story_id, viewed_at DESC);
