-- SilverChat: Prompt 04b-2. Atomic RPCs and database lifecycle.

-- 1. Policy amendments and channel last-message FK.

DROP POLICY IF EXISTS "messages_select" ON public.messages;

CREATE POLICY "messages_select" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (
      chat_id IS NOT NULL
      AND (
        is_chat_member(chat_id, auth.uid())
        OR EXISTS (
          SELECT 1 FROM chat_requests cr
          WHERE cr.chat_id = messages.chat_id
            AND cr.recipient_id = auth.uid()
            AND cr.status = 'pending'
        )
      )
      AND NOT is_message_deleted_for_user(id, auth.uid())
    )
    OR
    (
      channel_id IS NOT NULL AND (
        is_channel_follower(channel_id, auth.uid())
        OR is_channel_owner(channel_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.messages;

CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        chat_id IS NOT NULL
        AND is_chat_member(chat_id, auth.uid())
        AND (
          is_chat_active(chat_id)
          OR EXISTS (
            SELECT 1 FROM chat_requests cr
            WHERE cr.chat_id = messages.chat_id
              AND cr.sender_id = auth.uid()
              AND cr.status = 'pending'
          )
        )
      )
      OR
      (channel_id IS NOT NULL AND is_channel_owner(channel_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "chat_members_delete_own" ON public.chat_members;

CREATE POLICY "chat_members_delete_own" ON public.chat_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM chats
      WHERE id = chat_members.chat_id
        AND type IN ('group', 'community_chat')
    )
  );

ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS last_message_id uuid NULL
    REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_channels_last_message
  ON public.channels(last_message_id)
  WHERE last_message_id IS NOT NULL;

-- 2. Preview helper; 3. Seven trigger functions (the spec summary says six).

CREATE OR REPLACE FUNCTION public.compute_message_preview(m public.messages)
RETURNS text
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN m.deleted_for_everyone THEN 'This message was deleted'
    WHEN m.type = 'text' THEN LEFT(COALESCE(m.content, ''), 100)
    WHEN m.type = 'image' THEN
      '📷 Photo' || CASE WHEN m.content IS NOT NULL
        THEN ' — ' || LEFT(m.content, 80) ELSE '' END
    WHEN m.type = 'video' THEN
      '🎥 Video' || CASE WHEN m.content IS NOT NULL
        THEN ' — ' || LEFT(m.content, 80) ELSE '' END
    WHEN m.type = 'audio' THEN '🎤 Audio'
    WHEN m.type = 'file' THEN
      '📄 ' || COALESCE(
        (SELECT original_filename FROM public.file_uploads
         WHERE id = m.file_upload_id), 'File')
    WHEN m.type = 'sticker' THEN '🎨 Sticker'
    WHEN m.type = 'location' THEN '📍 Location'
    WHEN m.type = 'contact' THEN '👤 Contact'
    WHEN m.type = 'system' THEN COALESCE(m.content, '')
    ELSE COALESCE(m.content, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Auto-receipts for chat members
  IF NEW.chat_id IS NOT NULL THEN
    INSERT INTO public.message_receipts (message_id, user_id, delivered_at)
    SELECT NEW.id, cm.user_id, now()
    FROM public.chat_members cm
    WHERE cm.chat_id = NEW.chat_id
      AND (NEW.sender_id IS NULL OR cm.user_id <> NEW.sender_id)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;

  -- 2. Update chat denormalized fields
  IF NEW.chat_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.chats
    SET last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_preview = compute_message_preview(NEW)
    WHERE id = NEW.chat_id;
  END IF;

  -- 3. Update channel denormalized fields
  IF NEW.channel_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.channels
    SET last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_preview = compute_message_preview(NEW)
    WHERE id = NEW.channel_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_message_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Preview update on delete-for-everyone
  IF NEW.deleted_for_everyone = true AND OLD.deleted_for_everyone = false THEN
    IF NEW.chat_id IS NOT NULL THEN
      UPDATE public.chats
      SET last_message_preview = 'This message was deleted'
      WHERE id = NEW.chat_id AND last_message_id = NEW.id;
    ELSIF NEW.channel_id IS NOT NULL THEN
      UPDATE public.channels
      SET last_message_preview = 'This message was deleted'
      WHERE id = NEW.channel_id AND last_message_id = NEW.id;
    END IF;
  END IF;

  -- Preview update on edit (only if edited message was the last)
  IF NEW.edited_at IS NOT NULL AND OLD.edited_at IS DISTINCT FROM NEW.edited_at THEN
    IF NEW.chat_id IS NOT NULL THEN
      UPDATE public.chats
      SET last_message_preview = compute_message_preview(NEW)
      WHERE id = NEW.chat_id AND last_message_id = NEW.id;
    ELSIF NEW.channel_id IS NOT NULL THEN
      UPDATE public.channels
      SET last_message_preview = compute_message_preview(NEW)
      WHERE id = NEW.channel_id AND last_message_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_community_member_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.communities
  SET member_count = member_count + 1
  WHERE id = NEW.community_id;

  -- Auto-join all chats of this community
  INSERT INTO public.chat_members (chat_id, user_id)
  SELECT c.id, NEW.user_id
  FROM public.chats c
  WHERE c.community_id = NEW.community_id
  ON CONFLICT (chat_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_community_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.communities
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = OLD.community_id;

  DELETE FROM public.chat_members
  WHERE user_id = OLD.user_id
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = OLD.community_id
    );

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_channel_follower_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET follower_count = follower_count + 1
  WHERE id = NEW.channel_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_channel_follower_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = OLD.channel_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_chat_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_members int;
  remaining_admins int;
  oldest_member uuid;
BEGIN
  -- Only applies to group / community_chat
  IF EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = OLD.chat_id AND type IN ('group', 'community_chat')
  ) THEN
    SELECT COUNT(*) INTO remaining_members
    FROM public.chat_members WHERE chat_id = OLD.chat_id;

    -- Last member leaves → cascade delete chat
    IF remaining_members = 0 THEN
      DELETE FROM public.chats WHERE id = OLD.chat_id;
      RETURN OLD;
    END IF;

    -- Last admin leaves → promote oldest member
    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO remaining_admins
      FROM public.chat_members
      WHERE chat_id = OLD.chat_id AND role = 'admin';

      IF remaining_admins = 0 THEN
        SELECT user_id INTO oldest_member
        FROM public.chat_members
        WHERE chat_id = OLD.chat_id
        ORDER BY joined_at ASC
        LIMIT 1;

        IF oldest_member IS NOT NULL THEN
          UPDATE public.chat_members
          SET role = 'admin'
          WHERE chat_id = OLD.chat_id AND user_id = oldest_member;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();

CREATE TRIGGER messages_after_update
  AFTER UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION handle_message_update();

CREATE TRIGGER community_members_after_insert
  AFTER INSERT ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION handle_community_member_insert();

CREATE TRIGGER community_members_after_delete
  AFTER DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION handle_community_member_delete();

CREATE TRIGGER channel_followers_after_insert
  AFTER INSERT ON public.channel_followers
  FOR EACH ROW EXECUTE FUNCTION handle_channel_follower_insert();

CREATE TRIGGER channel_followers_after_delete
  AFTER DELETE ON public.channel_followers
  FOR EACH ROW EXECUTE FUNCTION handle_channel_follower_delete();

CREATE TRIGGER chat_members_after_delete
  AFTER DELETE ON public.chat_members
  FOR EACH ROW EXECUTE FUNCTION handle_chat_member_delete();

-- 4. RPCs. Validate identity inside SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.create_direct_chat_request(
  p_target_user_id uuid, p_initial_content text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pair text;
  v_chat public.chats%ROWTYPE;
  v_rejected_at timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_target_user_id IS NULL OR p_target_user_id = v_user THEN
    RAISE EXCEPTION 'Choose another user; use create_self_chat for yourself';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user does not exist';
  END IF;
  IF public.is_blocked_either_way(v_user, p_target_user_id) THEN
    RAISE EXCEPTION 'Cannot message a blocked user';
  END IF;
  v_pair := LEAST(v_user::text, p_target_user_id::text) || '::' ||
            GREATEST(v_user::text, p_target_user_id::text);
  -- Serializes concurrent first creation even when no chat row exists yet.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pair, 0));
  SELECT * INTO v_chat FROM public.chats WHERE direct_pair_key = v_pair FOR UPDATE;
  IF FOUND AND v_chat.status IN ('active', 'pending_request') THEN
    RETURN v_chat.id;
  END IF;
  IF p_initial_content IS NULL OR btrim(p_initial_content) = '' THEN
    RAISE EXCEPTION 'Initial message cannot be empty';
  END IF;
  IF v_chat.id IS NOT NULL THEN
    -- Consult history as well as the denormalized timestamp. Neither is
    -- client-writable; retrying never removes past request rows.
    SELECT GREATEST(v_chat.rejected_at, max(responded_at)) INTO v_rejected_at
    FROM public.chat_requests WHERE chat_id = v_chat.id AND status = 'rejected';
    IF v_rejected_at > now() - interval '7 days' THEN
      RAISE EXCEPTION 'Cooldown active: try again in % days',
        ceil(extract(epoch FROM (v_rejected_at + interval '7 days' - now())) / 86400);
    END IF;
    UPDATE public.chats SET status = 'pending_request', rejected_at = NULL,
      created_by = v_user WHERE id = v_chat.id;
    -- A reverse-direction retry must still have only the requesting member.
    DELETE FROM public.chat_members WHERE chat_id = v_chat.id AND user_id <> v_user;
    INSERT INTO public.chat_members(chat_id, user_id) VALUES (v_chat.id, v_user)
      ON CONFLICT (chat_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO public.chats(type, status, direct_pair_key, created_by)
      VALUES ('direct', 'pending_request', v_pair, v_user) RETURNING * INTO v_chat;
    INSERT INTO public.chat_members(chat_id, user_id) VALUES (v_chat.id, v_user);
  END IF;
  INSERT INTO public.chat_requests(chat_id, sender_id, recipient_id)
    VALUES (v_chat.id, v_user, p_target_user_id);
  INSERT INTO public.messages(chat_id, sender_id, content)
    VALUES (v_chat.id, v_user, p_initial_content);
  RETURN v_chat.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_self_chat() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_chat_id uuid; v_pair text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  v_pair := 'self::' || v_user::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pair, 0));
  SELECT id INTO v_chat_id FROM public.chats WHERE direct_pair_key = v_pair;
  IF v_chat_id IS NOT NULL THEN RETURN v_chat_id; END IF;
  INSERT INTO public.chats(type, status, direct_pair_key, created_by)
    VALUES ('self', 'active', v_pair, v_user) RETURNING id INTO v_chat_id;
  INSERT INTO public.chat_members(chat_id, user_id) VALUES (v_chat_id, v_user);
  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_chat(p_name text, p_member_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_chat_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Group name is required'; END IF;
  IF p_member_ids IS NULL OR cardinality(p_member_ids) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'Choose 1 to 255 members excluding the creator';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id) WHERE id IS NULL OR id = v_user)
     OR (SELECT count(DISTINCT id) FROM unnest(p_member_ids) AS u(id)) <> cardinality(p_member_ids) THEN
    RAISE EXCEPTION 'Members must be distinct, non-null users excluding the creator';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id)
             WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)) THEN
    RAISE EXCEPTION 'A selected member does not exist';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_member_ids) AS u(id)
             WHERE public.is_blocked_either_way(v_user, u.id)) THEN
    RAISE EXCEPTION 'Cannot add a member blocked in either direction';
  END IF;
  INSERT INTO public.chats(type, name, created_by)
    VALUES ('group', btrim(p_name), v_user) RETURNING id INTO v_chat_id;
  INSERT INTO public.chat_members(chat_id, user_id, role) VALUES (v_chat_id, v_user, 'admin');
  INSERT INTO public.chat_members(chat_id, user_id)
    SELECT v_chat_id, id FROM unnest(p_member_ids) AS u(id);
  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_chat_member(p_chat_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_type public.chat_type;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT type INTO v_type FROM public.chats WHERE id = p_chat_id FOR UPDATE;
  IF NOT FOUND OR v_type <> 'group' THEN RAISE EXCEPTION 'Chat must be a group'; END IF;
  IF NOT public.is_chat_admin(p_chat_id, v_user) THEN RAISE EXCEPTION 'Chat admin required'; END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;
  IF public.is_chat_member(p_chat_id, p_user_id) THEN RAISE EXCEPTION 'User is already a member'; END IF;
  IF (SELECT count(*) FROM public.chat_members WHERE chat_id = p_chat_id) >= 256 THEN
    RAISE EXCEPTION 'Group has reached its 256-member limit';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = p_chat_id
             AND public.is_blocked_either_way(p_user_id, user_id)) THEN
    RAISE EXCEPTION 'User is blocked by or has blocked an existing member';
  END IF;
  INSERT INTO public.chat_members(chat_id, user_id) VALUES (p_chat_id, p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_request public.chat_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_request.recipient_id <> v_user THEN
    RAISE EXCEPTION 'Pending request for the current user not found';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = v_request.chat_id FOR UPDATE;
  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.status <> 'pending' OR NOT EXISTS (
    SELECT 1 FROM public.chats WHERE id = v_request.chat_id AND status = 'pending_request'
  ) THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  IF public.is_blocked_either_way(v_request.sender_id, v_user) THEN
    RAISE EXCEPTION 'Cannot accept a request while either user is blocked';
  END IF;
  UPDATE public.chat_requests SET status = 'accepted', responded_at = now() WHERE id = p_request_id;
  UPDATE public.chats SET status = 'active', rejected_at = NULL WHERE id = v_request.chat_id;
  INSERT INTO public.chat_members(chat_id, user_id) VALUES (v_request.chat_id, v_user)
    ON CONFLICT (chat_id, user_id) DO NOTHING;
  -- Backfill receipts for messages sent before recipient membership existed.
  INSERT INTO public.message_receipts(message_id, user_id, delivered_at)
    SELECT id, v_user, now() FROM public.messages
    WHERE chat_id = v_request.chat_id AND sender_id IS DISTINCT FROM v_user
    ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_chat_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_request public.chat_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_request.recipient_id <> v_user THEN
    RAISE EXCEPTION 'Pending request for the current user not found';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = v_request.chat_id FOR UPDATE;
  SELECT * INTO v_request FROM public.chat_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.status <> 'pending' OR NOT EXISTS (
    SELECT 1 FROM public.chats WHERE id = v_request.chat_id AND status = 'pending_request'
  ) THEN RAISE EXCEPTION 'Request is no longer pending'; END IF;
  UPDATE public.chat_requests SET status = 'rejected', responded_at = now() WHERE id = p_request_id;
  UPDATE public.chats SET status = 'rejected', rejected_at = now() WHERE id = v_request.chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_channel(p_name text, p_slug text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_channel_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Channel name is required'; END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9-]{3,50}$' THEN
    RAISE EXCEPTION 'Slug must contain 3 to 50 lowercase letters, digits or hyphens';
  END IF;
  BEGIN
    INSERT INTO public.channels(name, slug, description, owner_id)
      VALUES (btrim(p_name), p_slug, p_description, v_user) RETURNING id INTO v_channel_id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Channel slug is already taken';
  END;
  INSERT INTO public.channel_followers(channel_id, user_id) VALUES (v_channel_id, v_user);
  RETURN v_channel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.follow_channel(p_channel_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = p_channel_id) THEN
    RAISE EXCEPTION 'Channel does not exist';
  END IF;
  INSERT INTO public.channel_followers(channel_id, user_id) VALUES (p_channel_id, v_user)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_community(p_name text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_community_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'Community name is required'; END IF;
  INSERT INTO public.communities(name, description, owner_id)
    VALUES (btrim(p_name), p_description, v_user) RETURNING id INTO v_community_id;
  INSERT INTO public.community_members(community_id, user_id, role)
    VALUES (v_community_id, v_user, 'admin');
  RETURN v_community_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id) THEN
    RAISE EXCEPTION 'Community does not exist';
  END IF;
  INSERT INTO public.community_members(community_id, user_id) VALUES (p_community_id, v_user)
    ON CONFLICT (community_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_chat_member(p_chat_id, v_user) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
  UPDATE public.chat_members SET last_read_at = now() WHERE chat_id = p_chat_id AND user_id = v_user;
  UPDATE public.message_receipts r SET read_at = now()
    WHERE r.user_id = v_user AND r.read_at IS NULL AND EXISTS (
      SELECT 1 FROM public.messages m WHERE m.id = r.message_id AND m.chat_id = p_chat_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_message_for_everyone(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_message public.messages%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_message FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND OR v_message.sender_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Only the sender can delete this message';
  END IF;
  IF v_message.deleted_at IS NOT NULL OR v_message.deleted_for_everyone THEN
    RAISE EXCEPTION 'Message is already deleted';
  END IF;
  IF now() - v_message.created_at >= interval '1 hour' THEN
    RAISE EXCEPTION 'Delete-for-everyone is limited to one hour';
  END IF;
  UPDATE public.messages SET deleted_at = now(), deleted_for_everyone = true WHERE id = p_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_storage_usage() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_bytes bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT COALESCE(sum(size_bytes), 0)::bigint INTO v_bytes
    FROM public.file_uploads WHERE uploader_id = v_user AND status = 'completed';
  RETURN v_bytes;
END;
$$;

-- Revoke PUBLIC defaults as well as granting authenticated execution.
DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'create_direct_chat_request(uuid,text)', 'create_self_chat()',
    'create_group_chat(text,uuid[])', 'add_chat_member(uuid,uuid)',
    'accept_chat_request(uuid)', 'reject_chat_request(uuid)',
    'create_channel(text,text,text)', 'follow_channel(uuid)',
    'create_community(text,text)', 'join_community(uuid)',
    'mark_chat_as_read(uuid)', 'delete_message_for_everyone(uuid)', 'get_my_storage_usage()'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.' || signature || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || signature || ' FROM PUBLIC, anon, service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || signature || ' TO authenticated';
  END LOOP;
  FOREACH signature IN ARRAY ARRAY[
    'compute_message_preview(public.messages)', 'handle_new_message()', 'handle_message_update()',
    'handle_community_member_insert()', 'handle_community_member_delete()',
    'handle_channel_follower_insert()', 'handle_channel_follower_delete()', 'handle_chat_member_delete()'
  ] LOOP
    EXECUTE 'ALTER FUNCTION public.' || signature || ' OWNER TO postgres';
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || signature || ' FROM PUBLIC, anon, authenticated, service_role';
  END LOOP;
END;
$$;

-- 5. Realtime; tolerate a table already enabled through the dashboard.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['messages','chat_members','calls','message_receipts','stories'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;

-- 6. Housekeeping; Supabase's default pg_cron timezone is UTC.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('cleanup_stale_calls', '* * * * *', $$
  UPDATE public.calls SET status = 'missed', ended_at = now()
  WHERE status = 'ringing' AND started_at < now() - interval '60 seconds';
$$);
SELECT cron.schedule('cleanup_expired_stories', '0 * * * *', $$
  DELETE FROM public.stories WHERE expires_at < now() - interval '1 hour';
$$);
SELECT cron.schedule('cleanup_pending_uploads', '15 * * * *', $$
  DELETE FROM public.file_uploads
  WHERE status = 'pending' AND created_at < now() - interval '1 hour';
$$);
SELECT cron.schedule('cleanup_orphan_uploads', '0 3 * * *', $$
  DELETE FROM public.file_uploads
  WHERE status = 'completed' AND created_at < now() - interval '7 days'
    AND NOT EXISTS (SELECT 1 FROM public.messages WHERE file_upload_id = file_uploads.id)
    AND NOT EXISTS (SELECT 1 FROM public.stories WHERE file_upload_id = file_uploads.id);
$$);
-- Known MVP limits: jobs remove DB metadata, not Storage objects.
-- Deleted message content remains in Postgres; a GDPR purge is deferred.
