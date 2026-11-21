-- Call the hardened public.is_channel_staff wrapper in RLS USING so authenticated
-- evaluation does not hit schema `private` privileges directly.

BEGIN;

DROP POLICY IF EXISTS "channel_followers_delete_own" ON public.channel_followers;
CREATE POLICY "channel_followers_delete_own" ON public.channel_followers
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.auth_mfa_satisfied()
    AND NOT public.is_channel_staff(channel_id, (SELECT auth.uid()))
  );

COMMIT;
