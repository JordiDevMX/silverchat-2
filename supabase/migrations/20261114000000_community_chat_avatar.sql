BEGIN;

-- Community membership synchronizes the owner's and moderators' chat admin role.
CREATE FUNCTION public.update_community_chat_avatar(p_chat_id uuid, p_avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'Authentication and MFA required';
  END IF;
  PERFORM 1 FROM public.chats WHERE id = p_chat_id AND type = 'community_chat' FOR UPDATE;
  IF NOT FOUND OR NOT public.is_chat_admin(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Community chat admin required';
  END IF;
  IF p_avatar_url IS NULL OR (p_avatar_url <> '' AND (
    p_avatar_url !~ ('^chat-' || p_chat_id::text || '/group-[a-zA-Z0-9-]+\.webp$')
    OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'avatars' AND name = p_avatar_url)
  )) THEN
    RAISE EXCEPTION 'Photo must be uploaded to this chat';
  END IF;
  UPDATE public.chats SET avatar_url = nullif(p_avatar_url, ''), updated_at = now()
  WHERE id = p_chat_id;
END $$;

REVOKE ALL ON FUNCTION public.update_community_chat_avatar(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_community_chat_avatar(uuid, text) TO authenticated;
COMMIT;
