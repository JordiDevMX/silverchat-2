BEGIN;
ALTER TABLE public.profiles ADD COLUMN username_changed_at timestamptz,
  ADD COLUMN scheduled_deletion_at timestamptz;
CREATE INDEX idx_profiles_pending_deletion ON public.profiles(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;
ALTER TABLE public.devices ADD COLUMN device_fingerprint text;
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_user_agent_unique;
ALTER TABLE public.devices ADD CONSTRAINT devices_user_fingerprint_unique UNIQUE(user_id, device_fingerprint);
CREATE INDEX idx_devices_fingerprint ON public.devices(user_id, device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;
GRANT INSERT(device_fingerprint), UPDATE(device_fingerprint) ON public.devices TO authenticated;
-- Timestamp columns are deliberately excluded from authenticated UPDATE grants.
CREATE FUNCTION public.validate_username_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF NEW.username ~ '^user_[a-f0-9]{8}$' THEN
      RAISE EXCEPTION 'Username cannot match the placeholder pattern';
    END IF;
    IF OLD.username_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION 'Username can only be changed once every 30 days. Next change available on %',
        (OLD.username_changed_at + interval '30 days')::date;
    END IF;
    NEW.username_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_username_change_validation BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username_change();

CREATE FUNCTION public.check_blocked_on_message_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pair text;
BEGIN
  SELECT direct_pair_key INTO v_pair FROM public.chats WHERE id = NEW.chat_id AND type = 'direct';
  -- Pending requests have only one chat_member. The canonical pair covers both participants.
  IF v_pair IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE b.blocker_id::text = ANY(string_to_array(v_pair, '::'))
      AND b.blocked_id::text = ANY(string_to_array(v_pair, '::'))
  ) THEN RAISE EXCEPTION 'Cannot send message: user is blocked'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_block_check BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_blocked_on_message_insert();
REVOKE ALL ON FUNCTION public.validate_username_change(), public.check_blocked_on_message_insert()
  FROM PUBLIC, anon, authenticated;

-- A narrowly scoped management view: profiles_visible intentionally hides blocked users.
-- Do not expose their photo, presence, bio or links through this exception.
CREATE VIEW public.profiles_blocked WITH (security_barrier = true, security_invoker = false) AS
SELECT p.id, p.username, p.display_name, upper(CASE
    WHEN nullif(btrim(p.first_name), '') IS NOT NULL AND nullif(btrim(p.last_name), '') IS NOT NULL
      THEN left(btrim(p.first_name), 1) || left(btrim(p.last_name), 1)
    WHEN nullif(btrim(p.first_name), '') IS NOT NULL
      THEN left(btrim(p.first_name), 1) || right(btrim(p.first_name), 1)
    WHEN btrim(p.display_name) ~ '[[:space:]]'
      THEN left(btrim(p.display_name), 1) || left(regexp_replace(btrim(p.display_name), '^.*[[:space:]]', ''), 1)
    ELSE left(coalesce(nullif(btrim(p.display_name), ''), p.username), 2)
  END) AS avatar_initials FROM public.user_blocks b
JOIN public.profiles p ON p.id = b.blocked_id
WHERE b.blocker_id = auth.uid() AND public.auth_mfa_satisfied();
ALTER VIEW public.profiles_blocked OWNER TO postgres;
REVOKE ALL ON public.profiles_blocked FROM PUBLIC, anon, service_role;
GRANT SELECT ON public.profiles_blocked TO authenticated;

-- Computed initials keep avatars consistent without exposing first/last-name fields.
CREATE OR REPLACE VIEW public.profiles_visible
WITH (security_invoker = false, security_barrier = true) AS
SELECT p.id, p.username, p.display_name, p.bio,
  CASE WHEN public.can_view_avatar(p.id, auth.uid()) THEN p.avatar_url ELSE NULL END AS avatar_url,
  CASE WHEN s.presence_visible = true THEN p.last_seen_at ELSE NULL END AS last_seen_at,
  p.social_links, p.created_at, p.updated_at,
  upper(CASE
    WHEN nullif(btrim(p.first_name), '') IS NOT NULL AND nullif(btrim(p.last_name), '') IS NOT NULL
      THEN left(btrim(p.first_name), 1) || left(btrim(p.last_name), 1)
    WHEN nullif(btrim(p.first_name), '') IS NOT NULL
      THEN left(btrim(p.first_name), 1) || right(btrim(p.first_name), 1)
    WHEN btrim(p.display_name) ~ '[[:space:]]'
      THEN left(btrim(p.display_name), 1) || left(regexp_replace(btrim(p.display_name), '^.*[[:space:]]', ''), 1)
    ELSE left(coalesce(nullif(btrim(p.display_name), ''), p.username), 2)
  END) AS avatar_initials
FROM public.profiles p LEFT JOIN public.user_settings s ON s.user_id = p.id
WHERE public.auth_mfa_satisfied() AND NOT public.is_blocked_either_way(p.id, auth.uid());

-- Opening a profile conversation may create a request without inventing a message.
-- Preserve the existing MFA guard, block check, advisory lock and rejection cooldown.
DO $$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure);
  definition := replace(definition,
    E'  IF p_initial_content IS NULL OR btrim(p_initial_content) = '''' THEN\n    RAISE EXCEPTION ''Initial message cannot be empty'';\n  END IF;',
    E'  IF p_initial_content IS NULL THEN RAISE EXCEPTION ''Initial content must not be null''; END IF;');
  definition := replace(definition,
    E'  INSERT INTO public.messages(chat_id, sender_id, content)\n    VALUES (v_chat.id, v_user, p_initial_content);',
    E'  IF btrim(p_initial_content) <> '''' THEN\n    INSERT INTO public.messages(chat_id, sender_id, content)\n      VALUES (v_chat.id, v_user, p_initial_content);\n  END IF;');
  IF position('Initial message cannot be empty' IN definition) > 0
     OR position('IF btrim(p_initial_content)' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected create_direct_chat_request definition; migration stopped';
  END IF;
  EXECUTE definition;
END;
$$;
-- Avatar metadata remains the deletion/accounting source of truth. Avatars have
-- no messages/stories FK, so the old orphan job incorrectly discarded live photos.
SELECT cron.schedule('cleanup_orphan_uploads', '0 3 * * *', $job$
  DELETE FROM public.file_uploads
  WHERE bucket <> 'avatars' AND status = 'completed' AND created_at < now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM public.messages WHERE file_upload_id = file_uploads.id)
    AND NOT EXISTS (SELECT 1 FROM public.stories WHERE file_upload_id = file_uploads.id);
$job$);
COMMIT;
