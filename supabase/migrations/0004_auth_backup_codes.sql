BEGIN;

CREATE TABLE public.two_factor_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_hash)
);
CREATE INDEX idx_backup_codes_user_unused ON public.two_factor_backup_codes(user_id)
  WHERE used_at IS NULL;
ALTER TABLE public.two_factor_backup_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.two_factor_backup_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT(user_id, code_hash) ON public.two_factor_backup_codes TO authenticated;
GRANT ALL ON public.two_factor_backup_codes TO service_role;
CREATE POLICY backup_codes_select_own ON public.two_factor_backup_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND auth.jwt()->>'aal' = 'aal2');
CREATE POLICY backup_codes_insert_own ON public.two_factor_backup_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND auth.jwt()->>'aal' = 'aal2');
-- No client UPDATE/DELETE. Recovery and replacement are service-role-only.
ALTER TABLE public.devices ADD CONSTRAINT devices_user_agent_unique UNIQUE(user_id, user_agent);
GRANT INSERT(last_active_at) ON public.devices TO authenticated;

-- A route guard alone cannot protect direct REST/Storage calls with an AAL1 JWT.
CREATE FUNCTION public.auth_mfa_satisfied() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    auth.jwt()->>'aal' = 'aal2' OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors WHERE user_id = auth.uid() AND status = 'verified'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.auth_mfa_satisfied() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_mfa_satisfied() TO authenticated;
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('CREATE POLICY mfa_assurance_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.auth_mfa_satisfied())) WITH CHECK ((SELECT public.auth_mfa_satisfied()))', item.tablename);
  END LOOP;
END;
$$;
CREATE POLICY mfa_assurance_required ON storage.objects AS RESTRICTIVE
  FOR ALL TO authenticated USING ((SELECT public.auth_mfa_satisfied()))
  WITH CHECK ((SELECT public.auth_mfa_satisfied()));

-- Definer RPCs and the privacy view bypass table RLS, so gate them explicitly.
DO $$
DECLARE signature text; definition text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'create_direct_chat_request(uuid,text)', 'create_self_chat()',
    'create_group_chat(text,uuid[])', 'add_chat_member(uuid,uuid)',
    'accept_chat_request(uuid)', 'reject_chat_request(uuid)',
    'create_channel(text,text,text)', 'follow_channel(uuid)',
    'create_community(text,text)', 'join_community(uuid)',
    'mark_chat_as_read(uuid)', 'delete_message_for_everyone(uuid)', 'get_my_storage_usage()'
  ] LOOP
    definition := pg_get_functiondef(('public.' || signature)::regprocedure);
    IF position('IF v_user IS NULL THEN' IN definition) = 0 THEN
      RAISE EXCEPTION 'Expected identity guard missing in %', signature;
    END IF;
    definition := replace(definition, 'IF v_user IS NULL THEN',
      'IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION ''MFA required'' USING ERRCODE = ''42501''; END IF; IF v_user IS NULL THEN');
    EXECUTE definition;
  END LOOP;
END;
$$;
-- Boolean RLS helpers are callable over RPC too; do not leak metadata before MFA.
DO $$
DECLARE signature text; definition text; source text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'is_chat_member(uuid,uuid)', 'is_chat_admin(uuid,uuid)',
    'is_blocked(uuid,uuid)', 'is_blocked_either_way(uuid,uuid)',
    'is_contact(uuid,uuid)', 'has_read_receipts_enabled(uuid)',
    'can_view_avatar(uuid,uuid)', 'can_view_story(uuid,uuid)',
    'is_channel_follower(uuid,uuid)', 'is_channel_owner(uuid,uuid)',
    'is_community_member(uuid,uuid)', 'is_message_deleted_for_user(uuid,uuid)',
    'is_chat_active(uuid)'
  ] LOOP
    SELECT pg_get_functiondef(p.oid), p.prosrc INTO definition, source
      FROM pg_proc p WHERE p.oid = ('public.' || signature)::regprocedure;
    EXECUTE replace(definition, source,
      'SELECT public.auth_mfa_satisfied() AND (' || regexp_replace(source, ';[[:space:]]*$', '') || ')');
  END LOOP;
END;
$$;
CREATE OR REPLACE VIEW public.profiles_visible
WITH (security_invoker = false, security_barrier = true) AS
SELECT p.id, p.username, p.display_name, p.bio,
  CASE WHEN public.can_view_avatar(p.id, auth.uid()) THEN p.avatar_url ELSE NULL END AS avatar_url,
  CASE WHEN s.presence_visible = true THEN p.last_seen_at ELSE NULL END AS last_seen_at,
  p.social_links, p.created_at, p.updated_at
FROM public.profiles p LEFT JOIN public.user_settings s ON s.user_id = p.id
WHERE public.auth_mfa_satisfied() AND NOT public.is_blocked_either_way(p.id, auth.uid());

-- A single UPDATE wins concurrent redemption; require a live challenge owned by this user.
CREATE FUNCTION public.consume_backup_code(p_user_id uuid, p_code_hash text, p_challenge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.mfa_challenges c JOIN auth.mfa_factors f ON f.id = c.factor_id
    WHERE c.id = p_challenge_id AND f.user_id = p_user_id AND f.status = 'verified'
      AND c.created_at > now() - interval '5 minutes' AND c.verified_at IS NULL
  ) THEN RETURN false; END IF;
  UPDATE public.two_factor_backup_codes SET used_at = now()
    WHERE user_id = p_user_id AND code_hash = p_code_hash AND used_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_backup_code(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_backup_code(uuid,text,uuid) TO service_role;

-- Transactional replacement: a failed insert never destroys the old set.
CREATE FUNCTION public.replace_backup_codes(p_user_id uuid, p_hashes text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF cardinality(p_hashes) <> 10 OR (SELECT count(DISTINCT h) FROM unnest(p_hashes) h) <> 10
    OR EXISTS (SELECT 1 FROM unnest(p_hashes) h WHERE h IS NULL OR h !~ '^[a-f0-9]{64}$')
  THEN RAISE EXCEPTION 'Expected ten distinct SHA-256 hashes'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  DELETE FROM public.two_factor_backup_codes WHERE user_id = p_user_id;
  INSERT INTO public.two_factor_backup_codes(user_id,code_hash)
    SELECT p_user_id, h FROM unnest(p_hashes) h;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_backup_codes(uuid,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_backup_codes(uuid,text[]) TO service_role;
COMMIT;
