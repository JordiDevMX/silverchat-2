-- TASK-012 corrective migration — backfills the content of migrations 0005 and
-- 0006 on the Production project.
--
-- Production's ledger recorded 0005 and 0006 as applied, but their objects
-- were never created there: 12 discrepancies listed in
-- docs/migration-equivalence-2026-11-11.md. This migration creates exactly
-- those objects and brings the function body to the text 0005 produces.
--
-- Idempotent: every statement is a no-op where the object already exists,
-- so this file is harmless in an environment that applied 0005/0006 normally
-- (staging, or any database built from the full series). It is additive
-- apart from the create_direct_chat_request body, which is set to the same
-- text 0005 writes.
--
-- Deliberately NOT repeated here, because Production already has them:
--   - 0005's devices changes (device_fingerprint column, the fingerprint
--     unique constraint and its index) — present through 0009;
--   - 0005's cron.schedule('cleanup_orphan_uploads', ...) — 0005's job
--     definition is superseded by 0012's, which Production already runs.
--
-- Recovery: every statement below is reversible. To undo it, drop
--   drop trigger if exists messages_block_check on public.messages;
--   drop trigger if exists profiles_username_change_validation on public.profiles;
--   drop function if exists public.check_blocked_on_message_insert();
--   drop function if exists public.validate_username_change();
--   drop function if exists public.schedule_account_deletion();
--   drop function if exists public.cancel_account_deletion();
--   drop index if exists idx_profiles_pending_deletion;
--   drop view if exists public.profiles_blocked;
--   alter table public.profiles
--     drop column if exists username_changed_at,
--     drop column if exists scheduled_deletion_at;
-- and restore create_direct_chat_request from the definition captured before
-- this migration ran (Production's pre-reconciliation dump).

BEGIN;

-- ---------------------------------------------------------------------------
-- 0005 — profile settings
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion ON public.profiles(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_username_change() RETURNS trigger
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

DROP TRIGGER IF EXISTS profiles_username_change_validation ON public.profiles;
CREATE TRIGGER profiles_username_change_validation BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_username_change();

CREATE OR REPLACE FUNCTION public.check_blocked_on_message_insert() RETURNS trigger
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

DROP TRIGGER IF EXISTS messages_block_check ON public.messages;
CREATE TRIGGER messages_block_check BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.check_blocked_on_message_insert();

REVOKE ALL ON FUNCTION public.validate_username_change(), public.check_blocked_on_message_insert()
  FROM PUBLIC, anon, authenticated;

-- A narrowly scoped management view: profiles_visible intentionally hides blocked users.
-- Do not expose their photo, presence, bio or links through this exception.
CREATE OR REPLACE VIEW public.profiles_blocked WITH (security_barrier = true, security_invoker = false) AS
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
  IF position('Initial content must not be null' IN definition) > 0 THEN
    -- Already rewritten by 0005; nothing to do.
    RETURN;
  END IF;
  IF position('Initial message cannot be empty' IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected create_direct_chat_request definition; migration stopped';
  END IF;
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

-- ---------------------------------------------------------------------------
-- 0006 — account deletion RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.schedule_account_deletion() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scheduled timestamptz;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  SELECT scheduled_deletion_at INTO v_scheduled FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_scheduled IS NULL THEN
    v_scheduled := now() + interval '30 days';
    UPDATE public.profiles SET scheduled_deletion_at = v_scheduled WHERE id = auth.uid();
  END IF;
  RETURN v_scheduled;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scheduled timestamptz;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  SELECT scheduled_deletion_at INTO v_scheduled FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  -- The full thirty-day grace period is cancellable. After the deadline, Storage
  -- and Auth deletion may already be running across services; never promise a
  -- successful cancellation while personal files are being irreversibly removed.
  IF v_scheduled <= clock_timestamp() THEN
    RAISE EXCEPTION 'The 30-day grace period has ended; account deletion is in progress';
  END IF;
  UPDATE public.profiles SET scheduled_deletion_at = NULL WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_account_deletion(), public.cancel_account_deletion()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_account_deletion(), public.cancel_account_deletion()
  TO authenticated;

COMMIT;
