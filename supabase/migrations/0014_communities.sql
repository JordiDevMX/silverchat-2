-- Apply this file manually via Supabase SQL Editor for remote.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_community(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community_id uuid;
  v_general_chat_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Community name is required';
  END IF;
  IF length(p_name) > 100 THEN
    RAISE EXCEPTION 'Community name must be 100 characters or less';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  INSERT INTO public.communities (name, description, owner_id)
  VALUES (trim(p_name), p_description, auth.uid())
  RETURNING id INTO v_community_id;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (v_community_id, auth.uid(), 'admin');

  -- Auto-create "General" chat
  INSERT INTO public.chats (type, status, name, community_id, created_by)
  VALUES ('community_chat', 'active', 'General', v_community_id, auth.uid())
  RETURNING id INTO v_general_chat_id;

  -- Owner auto-joins the General chat
  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (v_general_chat_id, auth.uid(), 'admin');

  RETURN v_community_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_community(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_community(text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 2. CREATE COMMUNITY CHAT (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_community_chat(
  p_community_id uuid,
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_id uuid;
  v_is_admin boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
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

  IF length(p_description) > 500 THEN RAISE EXCEPTION 'Description must be 500 characters or less'; END IF;
  INSERT INTO public.chats (type, status, name, description, community_id, created_by)
  VALUES ('community_chat', 'active', trim(p_name), p_description, p_community_id, auth.uid())
  RETURNING id INTO v_chat_id;

  -- Add all current community members to the new chat
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
REVOKE ALL ON FUNCTION public.create_community_chat(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_community_chat(uuid, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 3. LEAVE COMMUNITY
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.leave_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = auth.uid();
  -- Trigger handle_community_member_delete does the rest
END;
$$;
REVOKE ALL ON FUNCTION public.leave_community(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.leave_community(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 4. MUTE COMMUNITY (bulk mute all chats)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.mute_community(
  p_community_id uuid,
  p_muted_until timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT public.is_community_member(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this community';
  END IF;

  UPDATE public.chat_members
  SET muted_until = p_muted_until
  WHERE user_id = auth.uid()
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = p_community_id
    );
END;
$$;
REVOKE ALL ON FUNCTION public.mute_community(uuid, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.mute_community(uuid, timestamptz) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 5. UPDATE COMMUNITY INFO (admin only)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_community_info(
  p_community_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can update info';
  END IF;

  IF p_name IS NOT NULL AND (length(btrim(p_name)) < 1 OR length(p_name) > 100) THEN
    RAISE EXCEPTION 'Name must be 1-100 characters';
  END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN
    RAISE EXCEPTION 'Description must be 500 characters or less';
  END IF;

  IF p_avatar_url IS NOT NULL AND p_avatar_url <> '' AND (
    p_avatar_url !~ ('^community-' || p_community_id::text || '/community-[a-zA-Z0-9-]+\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_avatar_url)
  ) THEN RAISE EXCEPTION 'Community photo must be uploaded to this community'; END IF;
  UPDATE public.communities
  SET
    name = COALESCE(btrim(p_name), name),
    description = COALESCE(p_description, description),
    avatar_url = CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE nullif(p_avatar_url, '') END,
    updated_at = now()
  WHERE id = p_community_id;
END;
$$;
REVOKE ALL ON FUNCTION public.update_community_info(uuid, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_community_info(uuid, text, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. REMOVE MEMBER (admin only, not owner)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.remove_community_member(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can remove members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot remove the community owner';
  END IF;

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_community_member(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.remove_community_member(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 7. PROMOTE / DEMOTE COMMUNITY ADMIN
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.promote_community_admin(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can promote';
  END IF;

  UPDATE public.community_members
  SET role = 'admin'
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_community_admin(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.promote_community_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.demote_community_admin(
  p_community_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = auth.uid()
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only community admins can demote';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = p_user_id
  ) AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot demote the community owner';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id <> p_user_id AND role = 'admin') THEN RAISE EXCEPTION 'At least one admin must remain'; END IF;
  UPDATE public.community_members
  SET role = 'member'
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.demote_community_admin(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demote_community_admin(uuid, uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 8. DELETE COMMUNITY (owner only, hard delete)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_community(p_community_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the owner can delete this community';
  END IF;

  DELETE FROM public.communities WHERE id = p_community_id;
  -- CASCADE deletes community_members, chats, messages, chat_members
END;
$$;
REVOKE ALL ON FUNCTION public.delete_community(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_community(uuid) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 9. OVERRIDE handle_community_member_delete (add succession)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_community_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_was_owner boolean;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  -- 1. Decrement member count
  UPDATE public.communities
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = OLD.community_id;

  -- 2. Remove user from all community chats
  DELETE FROM public.chat_members
  WHERE user_id = OLD.user_id
    AND chat_id IN (
      SELECT id FROM public.chats WHERE community_id = OLD.community_id
    );

  -- 3. Check if the departing user was the owner
  SELECT (owner_id = OLD.user_id) INTO v_was_owner
  FROM public.communities
  WHERE id = OLD.community_id;

  IF v_was_owner THEN
    -- Count remaining members
    SELECT COUNT(*) INTO v_remaining_count
    FROM public.community_members
    WHERE community_id = OLD.community_id;

    IF v_remaining_count = 0 THEN
      -- Last member left → delete community (cascades everything)
      DELETE FROM public.communities WHERE id = OLD.community_id;
      RETURN OLD;
    END IF;

    -- Find successor: oldest admin first, then oldest member
    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = OLD.community_id
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      joined_at ASC, user_id ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities
      SET owner_id = v_next_owner
      WHERE id = OLD.community_id;

      UPDATE public.community_members
      SET role = 'admin'
      WHERE community_id = OLD.community_id AND user_id = v_next_owner;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Ensure the trigger still points to the new version
DROP TRIGGER IF EXISTS community_members_after_delete ON public.community_members;
CREATE TRIGGER community_members_after_delete
  AFTER DELETE ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_community_member_delete();

-- ═══════════════════════════════════════════════════════════════
-- 10. TRIGGER: HANDLE OWNER ACCOUNT DELETION
--     (fires BEFORE DELETE on profiles to run succession before FK nulls out)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_profile_deletion_community_succession()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community RECORD;
  v_next_owner uuid;
  v_remaining_count int;
BEGIN
  -- Handle each community where the departing user was owner
  FOR v_community IN
    SELECT id FROM public.communities WHERE owner_id = OLD.id ORDER BY id FOR UPDATE
  LOOP
    SELECT COUNT(*) INTO v_remaining_count
    FROM public.community_members
    WHERE community_id = v_community.id AND user_id <> OLD.id;

    IF v_remaining_count = 0 THEN
      DELETE FROM public.communities WHERE id = v_community.id;
      CONTINUE;
    END IF;

    SELECT user_id INTO v_next_owner
    FROM public.community_members
    WHERE community_id = v_community.id AND user_id <> OLD.id
    ORDER BY
      CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
      joined_at ASC, user_id ASC
    LIMIT 1;

    IF v_next_owner IS NOT NULL THEN
      UPDATE public.communities
      SET owner_id = v_next_owner
      WHERE id = v_community.id;

      UPDATE public.community_members
      SET role = 'admin'
      WHERE community_id = v_community.id AND user_id = v_next_owner;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS profiles_before_delete_community_succession ON public.profiles;
CREATE TRIGGER profiles_before_delete_community_succession
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_deletion_community_succession();


REVOKE ALL ON FUNCTION public.handle_community_member_delete(), public.handle_profile_deletion_community_succession() FROM PUBLIC, anon, authenticated, service_role;

-- Admin additions use one RPC per selected member; retain the existing self-join signature.
CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND user_id = auth.uid() AND role = 'admin') THEN RAISE EXCEPTION 'Community admin required'; END IF;
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community_id AND public.is_blocked_either_way(user_id, p_user_id)) THEN RAISE EXCEPTION 'Member unavailable'; END IF;
  INSERT INTO public.community_members(community_id, user_id) VALUES(p_community_id, p_user_id) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.join_community(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_community(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_community(p_community_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  PERFORM 1 FROM public.communities WHERE id = p_community_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community unavailable'; END IF;
  INSERT INTO public.community_members(community_id, user_id) VALUES(p_community_id, auth.uid()) ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.join_community(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_community(uuid) TO authenticated;

-- Community roles remain authoritative for message moderation in every child chat.
CREATE OR REPLACE FUNCTION public.sync_community_chat_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.chat_members SET role = NEW.role
  WHERE user_id = NEW.user_id AND chat_id IN (SELECT id FROM public.chats WHERE community_id = NEW.community_id);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_community_chat_roles() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER community_members_after_role_update AFTER UPDATE OF role ON public.community_members
FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role) EXECUTE FUNCTION public.sync_community_chat_roles();

-- Only the community lifecycle may remove memberships from its child chats.
DROP POLICY chat_members_delete_own ON public.chat_members;
CREATE POLICY chat_members_delete_own ON public.chat_members FOR DELETE TO authenticated
USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chats WHERE id = chat_id AND type IN ('direct', 'group')));
REVOKE UPDATE(name, description, avatar_url), DELETE ON public.communities FROM authenticated;
REVOKE DELETE ON public.community_members FROM authenticated;

-- Community avatar reads require membership; writes require community administration.
CREATE POLICY avatars_select_community ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id = 'avatars' AND CASE WHEN split_part(name, '/', 1) ~ '^community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN public.is_community_member(substring(split_part(name, '/', 1) from 11)::uuid, auth.uid()) ELSE false END);
CREATE POLICY avatars_insert_community ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND CASE WHEN split_part(name, '/', 1) ~ '^community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN EXISTS (SELECT 1 FROM public.community_members WHERE community_id = substring(split_part(name, '/', 1) from 11)::uuid AND user_id = auth.uid() AND role = 'admin') ELSE false END);
CREATE POLICY avatars_update_community ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND CASE WHEN split_part(name, '/', 1) ~ '^community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN EXISTS (SELECT 1 FROM public.community_members WHERE community_id = substring(split_part(name, '/', 1) from 11)::uuid AND user_id = auth.uid() AND role = 'admin') ELSE false END) WITH CHECK (bucket_id = 'avatars' AND CASE WHEN split_part(name, '/', 1) ~ '^community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN EXISTS (SELECT 1 FROM public.community_members WHERE community_id = substring(split_part(name, '/', 1) from 11)::uuid AND user_id = auth.uid() AND role = 'admin') ELSE false END);
CREATE POLICY avatars_delete_community ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND CASE WHEN split_part(name, '/', 1) ~ '^community-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN EXISTS (SELECT 1 FROM public.community_members WHERE community_id = substring(split_part(name, '/', 1) from 11)::uuid AND user_id = auth.uid() AND role = 'admin') ELSE false END);

-- Membership/info changes for a community must use its own RPCs.
CREATE OR REPLACE FUNCTION public.add_chat_members(p_chat_id uuid,p_user_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid; v_added integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type = 'group' FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF cardinality(p_user_ids) IS NULL OR cardinality(p_user_ids) NOT BETWEEN 1 AND 50 OR array_ndims(p_user_ids)<>1 OR array_position(p_user_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Select between 1 and 50 members'; END IF;
 FOR v_uid IN SELECT DISTINCT id FROM unnest(p_user_ids) id ORDER BY id LOOP
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid)
    AND NOT EXISTS(SELECT 1 FROM public.chat_members WHERE chat_id=p_chat_id AND user_id=v_uid)
    AND NOT EXISTS(SELECT 1 FROM public.chat_members WHERE chat_id=p_chat_id AND public.is_blocked_either_way(user_id,v_uid)) THEN
   INSERT INTO public.chat_members(chat_id,user_id,role) VALUES(p_chat_id,v_uid,'member') ON CONFLICT DO NOTHING;
   IF FOUND THEN v_added:=v_added+1; END IF;
  END IF;
 END LOOP;
 RETURN v_added;
END $$;

-- Membership/info changes for a community must use its own RPCs.
CREATE OR REPLACE FUNCTION public.remove_chat_member(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type = 'group' FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'Use Leave group to remove yourself'; END IF;
 IF EXISTS(SELECT 1 FROM public.chats WHERE id=p_chat_id AND created_by=p_user_id) THEN RAISE EXCEPTION 'Cannot remove the group creator'; END IF;
 DELETE FROM public.chat_members WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;

-- Membership/info changes for a community must use its own RPCs.
CREATE OR REPLACE FUNCTION public.promote_chat_admin(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type = 'group' FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 UPDATE public.chat_members SET role='admin' WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;

-- Membership/info changes for a community must use its own RPCs.
CREATE OR REPLACE FUNCTION public.demote_chat_admin(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type = 'group' FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_user_id<>auth.uid() AND EXISTS(SELECT 1 FROM public.chats WHERE id=p_chat_id AND created_by=p_user_id) THEN RAISE EXCEPTION 'Cannot demote the group creator'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.chat_members WHERE chat_id=p_chat_id AND user_id<>p_user_id AND role='admin') THEN RAISE EXCEPTION 'At least one admin must remain'; END IF;
 UPDATE public.chat_members SET role='member' WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;

-- Membership/info changes for a community must use its own RPCs.
CREATE OR REPLACE FUNCTION public.update_group_info(p_chat_id uuid,p_name text DEFAULT NULL,p_description text DEFAULT NULL,p_avatar_url text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type = 'group' FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_name IS NOT NULL AND (length(btrim(p_name))<1 OR length(p_name)>100) THEN RAISE EXCEPTION 'Group name must be between 1 and 100 characters'; END IF;
 IF length(p_description)>500 THEN RAISE EXCEPTION 'Group description must be 500 characters or less'; END IF;
 -- Empty avatar URL removes the photo; NULL means no change.
 IF p_avatar_url IS NOT NULL AND p_avatar_url<>'' AND (p_avatar_url !~ ('^chat-'||p_chat_id::text||'/group-[a-zA-Z0-9-]+\.webp$')
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='avatars' AND name=p_avatar_url)) THEN RAISE EXCEPTION 'Group photo must be uploaded to this chat'; END IF;
 UPDATE public.chats SET name=coalesce(p_name,name),description=coalesce(p_description,description),
  avatar_url=CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE nullif(p_avatar_url,'') END,updated_at=now() WHERE id=p_chat_id;
END $$;

-- Community succession is handled at community scope, never independently per chat.
CREATE OR REPLACE FUNCTION public.handle_chat_member_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remaining_members int;
  remaining_admins int;
  oldest_member uuid;
BEGIN
  -- Only applies to group / community_chat
  IF EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = OLD.chat_id AND type = 'group'
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

  RETURN OLD;
END;
$$;
COMMIT;
