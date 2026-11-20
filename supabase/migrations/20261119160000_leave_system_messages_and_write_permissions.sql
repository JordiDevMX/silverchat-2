BEGIN;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS only_admins_can_send boolean NOT NULL DEFAULT false;

ALTER TABLE public.chats
  DROP CONSTRAINT IF EXISTS chats_only_admins_can_send_group_check;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_only_admins_can_send_group_check
  CHECK (NOT only_admins_can_send OR type IN ('group', 'community_chat'));

DROP POLICY IF EXISTS "messages_insert" ON public.messages;

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        chat_id IS NOT NULL
        AND public.is_chat_member(chat_id, auth.uid())
        AND (
          public.is_chat_active(chat_id)
          OR EXISTS (
            SELECT 1 FROM public.chat_requests cr
            WHERE cr.chat_id = messages.chat_id
              AND cr.sender_id = auth.uid()
              AND cr.status = 'pending'
          )
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.chats c
            WHERE c.id = messages.chat_id
              AND c.only_admins_can_send
          )
          OR public.is_chat_admin(messages.chat_id, auth.uid())
        )
      )
      OR
      (channel_id IS NOT NULL AND public.is_channel_owner(channel_id, auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.forward_chat_message(
  p_message_id uuid,
  p_chat_ids uuid[],
  p_message_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.messages;
  target uuid;
  i integer;
  existing public.messages;
  v_only_admins boolean;
  v_role public.chat_member_role;
BEGIN
  IF NOT public.can_access_chat_message(p_message_id) THEN
    RAISE EXCEPTION 'Message unavailable';
  END IF;
  IF cardinality(p_chat_ids) IS NULL OR cardinality(p_chat_ids) < 1 OR cardinality(p_chat_ids) > 5
    OR cardinality(p_message_ids) IS DISTINCT FROM cardinality(p_chat_ids)
    OR array_position(p_chat_ids, NULL) IS NOT NULL OR array_position(p_message_ids, NULL) IS NOT NULL
    OR (SELECT count(DISTINCT x) FROM unnest(p_chat_ids) x) <> cardinality(p_chat_ids)
    OR (SELECT count(DISTINCT x) FROM unnest(p_message_ids) x) <> cardinality(p_message_ids)
  THEN
    RAISE EXCEPTION 'Select between 1 and 5 distinct chats';
  END IF;

  PERFORM 1 FROM public.chats WHERE id = ANY(p_chat_ids) ORDER BY id FOR UPDATE;

  SELECT * INTO source
  FROM public.messages
  WHERE id = p_message_id AND NOT deleted_for_everyone AND type <> 'system'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message unavailable';
  END IF;

  FOR i IN 1..cardinality(p_chat_ids) LOOP
    target := p_chat_ids[i];
    SELECT c.only_admins_can_send, cm.role
    INTO v_only_admins, v_role
    FROM public.chats c
    JOIN public.chat_members cm ON cm.chat_id = c.id
    WHERE c.id = target
      AND c.status = 'active'
      AND cm.user_id = auth.uid()
      AND cm.archived_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active unarchived chat membership required';
    END IF;
    IF v_only_admins AND v_role <> 'admin' THEN
      RAISE EXCEPTION 'Only admins can send messages in this chat';
    END IF;

    SELECT * INTO existing FROM public.messages WHERE id = p_message_ids[i];
    IF FOUND THEN
      IF existing.sender_id IS DISTINCT FROM auth.uid()
        OR existing.chat_id IS DISTINCT FROM target
        OR existing.forwarded_from_message_id IS DISTINCT FROM p_message_id
      THEN
        RAISE EXCEPTION 'Forward identifier already used';
      END IF;
    ELSE
      INSERT INTO public.messages (
        id, chat_id, sender_id, type, content, file_upload_id,
        media_thumbnail_upload_id, media_peaks, location_data,
        contact_data, forwarded_from_message_id
      )
      VALUES (
        p_message_ids[i], target, auth.uid(), source.type, source.content,
        source.file_upload_id, source.media_thumbnail_upload_id, source.media_peaks,
        source.location_data, source.contact_data, source.id
      );
    END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION public.forward_chat_message(uuid, uuid[], uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.forward_chat_message(uuid, uuid[], uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.forward_chat_message(uuid, uuid[], uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.update_group_info(uuid, text, text, text);

CREATE FUNCTION public.update_group_info(
  p_chat_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_only_admins_can_send boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'group' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Group admin required';
  END IF;
  IF p_name IS NOT NULL AND (length(btrim(p_name)) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Group name must be between 1 and 100 characters';
  END IF;
  IF length(p_description) > 500 THEN
    RAISE EXCEPTION 'Group description must be 500 characters or less';
  END IF;
  IF p_avatar_url IS NOT NULL AND p_avatar_url <> '' AND (
    p_avatar_url !~ ('^chat-' || p_chat_id::text || '/group-[a-zA-Z0-9-]+\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_avatar_url)
  ) THEN
    RAISE EXCEPTION 'Group photo must be uploaded to this chat';
  END IF;

  UPDATE public.chats
  SET
    name = coalesce(p_name, name),
    description = coalesce(p_description, description),
    avatar_url = CASE
      WHEN p_avatar_url IS NULL THEN avatar_url
      ELSE nullif(p_avatar_url, '')
    END,
    only_admins_can_send = coalesce(p_only_admins_can_send, only_admins_can_send),
    updated_at = now()
  WHERE id = p_chat_id;
END;
$$;

ALTER FUNCTION public.update_group_info(uuid, text, text, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_group_info(uuid, text, text, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_group_info(uuid, text, text, text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.create_community_chat(uuid, text, text);

CREATE FUNCTION public.create_community_chat(
  p_community_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_only_admins_can_send boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_id uuid;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required';
  END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only community admins can create chats';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Chat name is required';
  END IF;
  IF length(p_name) > 100 THEN
    RAISE EXCEPTION 'Chat name must be 100 characters or less';
  END IF;
  IF length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  INSERT INTO public.chats (type, status, name, description, community_id, created_by, only_admins_can_send)
  VALUES (
    'community_chat',
    'active',
    trim(p_name),
    p_description,
    p_community_id,
    auth.uid(),
    coalesce(p_only_admins_can_send, false)
  )
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT v_chat_id, cm.user_id,
    CASE WHEN cm.role = 'admin' THEN 'admin'::public.chat_member_role
         ELSE 'member'::public.chat_member_role END
  FROM public.community_members cm
  WHERE cm.community_id = p_community_id
  ON CONFLICT DO NOTHING;

  RETURN v_chat_id;
END;
$$;

ALTER FUNCTION public.create_community_chat(uuid, text, text, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_community_chat(uuid, text, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_community_chat(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_chat_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_type public.chat_type;
  remaining_members int;
  remaining_admins int;
  oldest_member uuid;
  v_member_name text;
  v_content text;
BEGIN
  SELECT type INTO v_chat_type
  FROM public.chats
  WHERE id = OLD.chat_id;

  IF v_chat_type IS NULL OR v_chat_type NOT IN ('group', 'community_chat') THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*) INTO remaining_members
  FROM public.chat_members
  WHERE chat_id = OLD.chat_id;

  IF v_chat_type = 'group' THEN
    IF remaining_members = 0 THEN
      DELETE FROM public.chats WHERE id = OLD.chat_id;
      RETURN OLD;
    END IF;

    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO remaining_admins
      FROM public.chat_members
      WHERE chat_id = OLD.chat_id AND role = 'admin';

      IF remaining_admins = 0 THEN
        SELECT user_id INTO oldest_member
        FROM public.chat_members
        WHERE chat_id = OLD.chat_id
        ORDER BY joined_at ASC, user_id ASC
        LIMIT 1;

        IF oldest_member IS NOT NULL THEN
          UPDATE public.chat_members
          SET role = 'admin'
          WHERE chat_id = OLD.chat_id AND user_id = oldest_member;
        END IF;
      END IF;
    END IF;
  END IF;

  IF remaining_members > 0 THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Member')
    INTO v_member_name
    FROM public.profiles
    WHERE id = OLD.user_id;

    v_member_name := COALESCE(v_member_name, 'Member');
    v_content := CASE
      WHEN auth.uid() IS NOT NULL AND auth.uid() <> OLD.user_id THEN
        format('''%s'' was removed from the chat', v_member_name)
      ELSE
        format('''%s'' left the chat', v_member_name)
    END;

    INSERT INTO public.messages (chat_id, sender_id, type, content)
    VALUES (OLD.chat_id, NULL, 'system', v_content);
  END IF;

  RETURN OLD;
END;
$$;

ALTER FUNCTION public.handle_chat_member_delete() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_chat_member_delete() FROM PUBLIC, anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
  END IF;
END $$;

COMMIT;
