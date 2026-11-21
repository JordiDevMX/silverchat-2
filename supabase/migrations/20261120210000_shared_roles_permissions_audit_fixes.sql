-- CHG-006 Round 1 Guardian Audit Fixes:
-- 1. Restrict externally callable channel/group/community predicate functions so callers
--    cannot probe identities or roles of other users (channel identity privacy).
-- 2. Enforce the channel staff-follower invariant across direct channel_followers DELETE
--    policies and triggers as well as unfollow_channel RPC.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.is_channel_staff(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.channel_staff
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_channel_owner(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = p_channel_id AND owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_channel_follower(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.channel_followers
    WHERE channel_id = p_channel_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_owner(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = p_chat_id AND c.type = 'group' AND c.owner_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION private.is_group_owner_or_admin(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND (
    private.is_group_owner(p_chat_id, p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.chat_members cm
      JOIN public.chats c ON c.id = cm.chat_id
      WHERE cm.chat_id = p_chat_id
        AND c.type = 'group'
        AND cm.user_id = p_user_id
        AND cm.role = 'admin'
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.community_role_rank(p_community_id uuid, p_user_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN p_user_id IS NULL THEN 0
    WHEN EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id AND owner_id = p_user_id) THEN 4
    ELSE COALESCE((
      SELECT CASE role
        WHEN 'admin' THEN 3
        WHEN 'moderator' THEN 2
        WHEN 'member' THEN 1
        ELSE 0
      END
      FROM public.community_members
      WHERE community_id = p_community_id AND user_id = p_user_id
    ), 0)
  END;
$$;

-- Hardened public RLS predicates: never disclose status for any user other than auth.uid().
CREATE OR REPLACE FUNCTION public.is_channel_staff(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.is_channel_staff(p_channel_id, (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.is_channel_owner(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.is_channel_owner(p_channel_id, (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.is_channel_follower(p_channel_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.is_channel_follower(p_channel_id, (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.is_group_owner(p_chat_id, (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.is_group_owner_or_admin(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.is_group_owner_or_admin(p_chat_id, (SELECT auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.can_share_group_invite(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND public.is_chat_member(p_chat_id, (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_share_link OR private.is_group_owner_or_admin(p_chat_id, (SELECT auth.uid())))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_group_info(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND public.is_chat_member(p_chat_id, (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_edit_info OR private.is_group_owner_or_admin(p_chat_id, (SELECT auth.uid())))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_add_group_members(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND public.is_chat_member(p_chat_id, (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = p_chat_id
        AND c.type = 'group'
        AND (NOT c.only_admins_can_add_members OR private.is_group_owner_or_admin(p_chat_id, (SELECT auth.uid())))
    );
$$;

CREATE OR REPLACE FUNCTION public.community_role_rank(p_community_id uuid, p_user_id uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN public.auth_mfa_satisfied() AND p_user_id IS NOT NULL AND p_user_id = (SELECT auth.uid())
      THEN private.community_role_rank(p_community_id, (SELECT auth.uid()))
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_community_staff(p_community_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.community_role_rank(p_community_id, (SELECT auth.uid())) >= 2;
$$;

CREATE OR REPLACE FUNCTION public.is_community_admin_or_owner(p_community_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND private.community_role_rank(p_community_id, (SELECT auth.uid())) >= 3;
$$;

CREATE OR REPLACE FUNCTION public.can_write_community_chat(p_chat_id uuid, p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.auth_mfa_satisfied()
    AND p_user_id IS NOT NULL
    AND p_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.chats c
      JOIN public.community_members cm
        ON cm.community_id = c.community_id AND cm.user_id = (SELECT auth.uid())
      WHERE c.id = p_chat_id
        AND c.type = 'community_chat'
        AND (cm.silenced_until IS NULL OR cm.silenced_until <= now())
        AND (
          CASE
            WHEN c.system_role = 'announcements' THEN
              private.community_role_rank(c.community_id, (SELECT auth.uid())) >= 3
              OR (
                cm.role = 'moderator'
                AND EXISTS (
                  SELECT 1 FROM public.community_announcement_writers w
                  WHERE w.community_id = c.community_id AND w.user_id = (SELECT auth.uid())
                )
              )
            ELSE
              CASE c.write_policy
                WHEN 'owner_only' THEN private.community_role_rank(c.community_id, (SELECT auth.uid())) >= 4
                WHEN 'admins'     THEN private.community_role_rank(c.community_id, (SELECT auth.uid())) >= 3
                WHEN 'moderators' THEN private.community_role_rank(c.community_id, (SELECT auth.uid())) >= 2
                ELSE true
              END
          END
        )
    );
$$;

-- Update server-side cross-user callers to read internal private.* helpers.
CREATE OR REPLACE FUNCTION public.serialize_chat_message_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chat public.chats%ROWTYPE;
  v_cm public.community_members%ROWTYPE;
  v_allowed boolean;
BEGIN
  IF NEW.chat_id IS NULL OR NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT type, community_id INTO v_chat.type, v_chat.community_id
  FROM public.chats WHERE id = NEW.chat_id;

  IF v_chat.type IS NULL OR v_chat.type IN ('direct', 'self') THEN
    RETURN NEW;
  END IF;

  IF v_chat.type = 'group' THEN
    SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id FOR SHARE;
    IF v_chat.only_admins_can_send AND NOT private.is_group_owner_or_admin(NEW.chat_id, NEW.sender_id) THEN
      RAISE EXCEPTION 'Only admins can send messages in this chat' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_chat.type = 'community_chat' THEN
    PERFORM 1 FROM public.communities WHERE id = v_chat.community_id FOR SHARE;
    SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id FOR SHARE;
    SELECT * INTO v_cm
    FROM public.community_members
    WHERE community_id = v_chat.community_id AND user_id = NEW.sender_id
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Community membership required' USING ERRCODE = '42501';
    END IF;
    IF v_cm.silenced_until IS NOT NULL AND v_cm.silenced_until > now() THEN
      RAISE EXCEPTION 'You are silenced in this community' USING ERRCODE = '42501';
    END IF;

    v_allowed := CASE
      WHEN v_chat.system_role = 'announcements' THEN
        private.community_role_rank(v_chat.community_id, NEW.sender_id) >= 3
        OR (
          v_cm.role = 'moderator'
          AND EXISTS (
            SELECT 1 FROM public.community_announcement_writers w
            WHERE w.community_id = v_chat.community_id AND w.user_id = NEW.sender_id
          )
        )
      ELSE
        CASE v_chat.write_policy
          WHEN 'owner_only' THEN private.community_role_rank(v_chat.community_id, NEW.sender_id) >= 4
          WHEN 'admins'     THEN private.community_role_rank(v_chat.community_id, NEW.sender_id) >= 3
          WHEN 'moderators' THEN private.community_role_rank(v_chat.community_id, NEW.sender_id) >= 2
          ELSE true
        END
    END;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'Not allowed to send messages in this chat' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.appoint_community_moderator(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT private.community_role_rank(p_community_id, auth.uid()) >= 3 THEN
    RAISE EXCEPTION 'Community admin required' USING ERRCODE = '42501';
  END IF;
  v_target_rank := private.community_role_rank(p_community_id, p_user_id);
  IF v_target_rank = 0 THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target_rank >= 3 THEN RAISE EXCEPTION 'Cannot appoint an owner or admin as moderator'; END IF;
  UPDATE public.community_members SET role = 'moderator' WHERE community_id = p_community_id AND user_id = p_user_id;
  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'moderator_appointed');
END $$;

CREATE OR REPLACE FUNCTION public.silence_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_silenced_until timestamptz,
  p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF p_silenced_until IS NULL OR p_silenced_until <= now() THEN
    RAISE EXCEPTION 'Silence expiration must be in the future';
  END IF;
  IF p_reason IS NOT NULL AND length(p_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR SHARE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := private.community_role_rank(p_community_id, auth.uid());
  v_target_rank := private.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to silence this member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.community_members
  SET silenced_until = p_silenced_until, silenced_by = auth.uid(), silence_reason = nullif(btrim(p_reason), '')
  WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details, reason)
  VALUES (
    p_community_id, auth.uid(), p_user_id, 'member_silenced',
    jsonb_build_object('silenced_until', p_silenced_until),
    nullif(btrim(p_reason), '')
  );
END $$;

CREATE OR REPLACE FUNCTION public.unsilence_community_member(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR SHARE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := private.community_role_rank(p_community_id, auth.uid());
  v_target_rank := private.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank THEN
    RAISE EXCEPTION 'Not authorized to lift silence for this member' USING ERRCODE = '42501';
  END IF;

  UPDATE public.community_members
  SET silenced_until = NULL, silenced_by = NULL, silence_reason = NULL
  WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type)
  VALUES (p_community_id, auth.uid(), p_user_id, 'member_unsilenced');
END $$;

CREATE OR REPLACE FUNCTION public.expel_community_member(
  p_community_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL,
  p_delete_messages boolean DEFAULT false
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor_rank integer;
  v_target_rank integer;
  v_deleted_count integer := 0;
  v_clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  IF length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;

  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  PERFORM 1 FROM public.chats WHERE community_id = p_community_id ORDER BY id ASC FOR UPDATE;
  PERFORM 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;

  v_actor_rank := private.community_role_rank(p_community_id, auth.uid());
  v_target_rank := private.community_role_rank(p_community_id, p_user_id);
  IF v_actor_rank < 2 OR v_actor_rank <= v_target_rank OR p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to expel this member' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.community_bans (community_id, user_id, banned_by, reason)
  VALUES (p_community_id, p_user_id, auth.uid(), v_clean_reason)
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET banned_by = auth.uid(), reason = excluded.reason, created_at = now();

  IF coalesce(p_delete_messages, false) THEN
    UPDATE public.messages m
    SET deleted_at = now(), deleted_for_everyone = true
    FROM public.chats c
    WHERE m.chat_id = c.id
      AND c.community_id = p_community_id
      AND m.sender_id = p_user_id
      AND NOT m.deleted_for_everyone
      AND m.type <> 'system';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  DELETE FROM public.community_members WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, action_type, details, reason)
  VALUES (
    p_community_id, auth.uid(), p_user_id, 'member_expelled',
    jsonb_build_object('delete_messages', coalesce(p_delete_messages, false), 'deleted_count', v_deleted_count),
    v_clean_reason
  );
END $$;

CREATE OR REPLACE FUNCTION public.moderate_delete_community_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_msg public.messages%ROWTYPE;
  v_comm uuid;
  v_actor_rank integer;
  v_target_rank integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required' USING ERRCODE = '42501';
  END IF;
  SELECT m.*, c.community_id INTO v_msg
  FROM public.messages m
  JOIN public.chats c ON c.id = m.chat_id
  WHERE m.id = p_message_id AND c.type = 'community_chat'
  FOR UPDATE OF m;

  IF NOT FOUND OR v_msg.deleted_for_everyone OR v_msg.type = 'system' THEN
    RAISE EXCEPTION 'Message unavailable';
  END IF;

  SELECT community_id INTO v_comm FROM public.chats WHERE id = v_msg.chat_id;
  PERFORM 1 FROM public.communities WHERE id = v_comm FOR SHARE;
  v_actor_rank := private.community_role_rank(v_comm, auth.uid());
  v_target_rank := CASE WHEN v_msg.sender_id IS NULL THEN 0 ELSE private.community_role_rank(v_comm, v_msg.sender_id) END;

  IF v_actor_rank < 2 THEN
    RAISE EXCEPTION 'Community staff required' USING ERRCODE = '42501';
  END IF;
  IF v_msg.sender_id <> auth.uid() AND v_target_rank >= v_actor_rank THEN
    RAISE EXCEPTION 'Not authorized to delete this author''s message' USING ERRCODE = '42501';
  END IF;

  UPDATE public.messages SET deleted_at = now(), deleted_for_everyone = true WHERE id = p_message_id;

  INSERT INTO public.community_audit_logs (community_id, actor_id, target_user_id, target_chat_id, action_type, details)
  VALUES (
    v_comm, auth.uid(), v_msg.sender_id, v_msg.chat_id, 'message_deleted_by_staff',
    jsonb_build_object('message_id', p_message_id, 'author_departed', (v_target_rank = 0))
  );
END $$;

-- Enforce channel staff-follower invariant across direct channel_followers deletes too.
DROP POLICY IF EXISTS "channel_followers_delete_own" ON public.channel_followers;
CREATE POLICY "channel_followers_delete_own" ON public.channel_followers
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND public.auth_mfa_satisfied()
    AND NOT private.is_channel_staff(channel_id, (SELECT auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.mark_deleting_channel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM set_config('silverchat.deleting_channel', OLD.id::text, true);
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS channels_00_mark_deleting ON public.channels;
CREATE TRIGGER channels_00_mark_deleting
  BEFORE DELETE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.mark_deleting_channel();

CREATE OR REPLACE FUNCTION public.prevent_channel_staff_follower_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('silverchat.deleting_channel', true) IS DISTINCT FROM OLD.channel_id::text
     AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = OLD.channel_id)
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.user_id)
     AND private.is_channel_staff(OLD.channel_id, OLD.user_id) THEN
    RAISE EXCEPTION 'Channel staff cannot unfollow while in office' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS channel_followers_00_prevent_staff_delete ON public.channel_followers;
CREATE TRIGGER channel_followers_00_prevent_staff_delete
  BEFORE DELETE ON public.channel_followers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_channel_staff_follower_delete();

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'private.is_channel_staff(uuid,uuid)',
    'private.is_channel_owner(uuid,uuid)',
    'private.is_channel_follower(uuid,uuid)',
    'private.is_group_owner(uuid,uuid)',
    'private.is_group_owner_or_admin(uuid,uuid)',
    'private.community_role_rank(uuid,uuid)',
    'public.mark_deleting_channel()',
    'public.prevent_channel_staff_follower_delete()'
  ] LOOP
    EXECUTE 'ALTER FUNCTION ' || fn || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION ' || fn || ' FROM PUBLIC, anon, authenticated, service_role';
  END LOOP;
END $$;

COMMIT;
