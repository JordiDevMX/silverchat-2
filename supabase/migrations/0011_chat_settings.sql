-- Prompt 09: 0010 is already deployed. Apply this file after 0001–0010.
BEGIN;
CREATE FUNCTION public.add_chat_members(p_chat_id uuid,p_user_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid; v_added integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type IN ('group','community_chat') FOR UPDATE;
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
REVOKE ALL ON FUNCTION public.add_chat_members(uuid,uuid[]) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.add_chat_members(uuid,uuid[]) TO authenticated;

CREATE FUNCTION public.remove_chat_member(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type IN ('group','community_chat') FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'Use Leave group to remove yourself'; END IF;
 IF EXISTS(SELECT 1 FROM public.chats WHERE id=p_chat_id AND created_by=p_user_id) THEN RAISE EXCEPTION 'Cannot remove the group creator'; END IF;
 DELETE FROM public.chat_members WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.remove_chat_member(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.remove_chat_member(uuid,uuid) TO authenticated;

CREATE FUNCTION public.promote_chat_admin(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type IN ('group','community_chat') FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 UPDATE public.chat_members SET role='admin' WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.promote_chat_admin(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.promote_chat_admin(uuid,uuid) TO authenticated;

CREATE FUNCTION public.demote_chat_admin(p_chat_id uuid,p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type IN ('group','community_chat') FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_user_id<>auth.uid() AND EXISTS(SELECT 1 FROM public.chats WHERE id=p_chat_id AND created_by=p_user_id) THEN RAISE EXCEPTION 'Cannot demote the group creator'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.chat_members WHERE chat_id=p_chat_id AND user_id<>p_user_id AND role='admin') THEN RAISE EXCEPTION 'At least one admin must remain'; END IF;
 UPDATE public.chat_members SET role='member' WHERE chat_id=p_chat_id AND user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member unavailable'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.demote_chat_admin(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.demote_chat_admin(uuid,uuid) TO authenticated;

CREATE FUNCTION public.update_group_info(p_chat_id uuid,p_name text DEFAULT NULL,p_description text DEFAULT NULL,p_avatar_url text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$

BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
 PERFORM 1 FROM public.chats WHERE id=p_chat_id AND type IN ('group','community_chat') FOR UPDATE;
 IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Group admin required'; END IF;
 IF p_name IS NOT NULL AND (length(btrim(p_name))<1 OR length(p_name)>100) THEN RAISE EXCEPTION 'Group name must be between 1 and 100 characters'; END IF;
 IF length(p_description)>500 THEN RAISE EXCEPTION 'Group description must be 500 characters or less'; END IF;
 -- Empty avatar URL removes the photo; NULL means no change.
 IF p_avatar_url IS NOT NULL AND p_avatar_url<>'' AND (p_avatar_url !~ ('^chat-'||p_chat_id::text||'/group-[a-zA-Z0-9-]+\.webp$')
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='avatars' AND name=p_avatar_url)) THEN RAISE EXCEPTION 'Group photo must be uploaded to this chat'; END IF;
 UPDATE public.chats SET name=coalesce(p_name,name),description=coalesce(p_description,description),
  avatar_url=CASE WHEN p_avatar_url IS NULL THEN avatar_url ELSE nullif(p_avatar_url,'') END,updated_at=now() WHERE id=p_chat_id;
END $$;
REVOKE ALL ON FUNCTION public.update_group_info(uuid,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.update_group_info(uuid,text,text,text) TO authenticated;

CREATE FUNCTION public.clear_chat_for_me(p_chat_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() OR NOT public.is_chat_member(p_chat_id,auth.uid()) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
 INSERT INTO public.message_deletions(message_id,user_id) SELECT id,auth.uid() FROM public.messages WHERE chat_id=p_chat_id ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.chat_members SET last_read_at=now(),manually_unread=false WHERE chat_id=p_chat_id AND user_id=auth.uid();
 UPDATE public.message_receipts r SET read_at=now() WHERE user_id=auth.uid() AND read_at IS NULL AND EXISTS(SELECT 1 FROM public.messages m WHERE m.id=r.message_id AND m.chat_id=p_chat_id);
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.clear_chat_for_me(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.clear_chat_for_me(uuid) TO authenticated;

CREATE INDEX idx_messages_chat_media ON public.messages(chat_id,created_at DESC,id DESC) WHERE type IN ('image','video') AND deleted_at IS NULL;
CREATE INDEX idx_messages_chat_files ON public.messages(chat_id,created_at DESC,id DESC) WHERE type='file' AND deleted_at IS NULL;

-- Group avatar paths are private: members read; admins upload/manage.
-- CASE guards casts so non-UUID group folders do not break personal avatar policies.
DROP POLICY avatars_select_visible ON storage.objects;
CREATE POLICY avatars_select_visible ON storage.objects FOR SELECT TO authenticated USING (bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.can_view_avatar(split_part(name,'/',1)::uuid,auth.uid())
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_chat_member(substring(split_part(name,'/',1) from 6)::uuid,auth.uid())
 ELSE false END);
DROP POLICY avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid=auth.uid()
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_chat_admin(substring(split_part(name,'/',1) from 6)::uuid,auth.uid())
 ELSE false END);
DROP POLICY avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid=auth.uid()
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_chat_admin(substring(split_part(name,'/',1) from 6)::uuid,auth.uid())
 ELSE false END) WITH CHECK (bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid=auth.uid()
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_chat_admin(substring(split_part(name,'/',1) from 6)::uuid,auth.uid())
 ELSE false END);
DROP POLICY avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated USING (bucket_id='avatars' AND CASE
 WHEN split_part(name,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN split_part(name,'/',1)::uuid=auth.uid()
 WHEN split_part(name,'/',1) ~ '^chat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN public.is_chat_admin(substring(split_part(name,'/',1) from 6)::uuid,auth.uid())
 ELSE false END);
COMMIT;
