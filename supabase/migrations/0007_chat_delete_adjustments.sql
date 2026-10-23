BEGIN;

ALTER TABLE public.chat_members
  ADD COLUMN manually_unread boolean NOT NULL DEFAULT false,
  ALTER COLUMN last_read_at DROP NOT NULL,
  ALTER COLUMN last_read_at DROP DEFAULT;
GRANT UPDATE(manually_unread) ON public.chat_members TO authenticated;

DROP POLICY chat_members_delete_own ON public.chat_members;
CREATE POLICY chat_members_delete_own ON public.chat_members
  FOR DELETE TO authenticated USING (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.chats WHERE id = chat_members.chat_id
        AND type IN ('direct', 'group', 'community_chat')
    )
  );
-- The restrictive MFA policy from 0004 continues to apply.
CREATE OR REPLACE FUNCTION public.mark_chat_as_unread(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_chat_member(p_chat_id, auth.uid()) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
  UPDATE public.chat_members SET manually_unread = true
    WHERE chat_id = p_chat_id AND user_id = auth.uid();
END;
$$;
CREATE OR REPLACE FUNCTION public.mark_chat_as_read(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_chat_member(p_chat_id, auth.uid()) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
  UPDATE public.chat_members SET last_read_at = now(), manually_unread = false
    WHERE chat_id = p_chat_id AND user_id = auth.uid();
  UPDATE public.message_receipts r SET read_at = now()
    WHERE r.user_id = auth.uid() AND r.read_at IS NULL AND EXISTS (
      SELECT 1 FROM public.messages m WHERE m.id = r.message_id AND m.chat_id = p_chat_id
    );
END;
$$;
CREATE FUNCTION public.delete_self_chat(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_chat public.chats%ROWTYPE;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_chat FROM public.chats WHERE id = p_chat_id FOR UPDATE;
  IF v_chat.type IS DISTINCT FROM 'self' THEN RAISE EXCEPTION 'delete_self_chat only works on self-chats'; END IF;
  IF v_chat.created_by IS DISTINCT FROM auth.uid() OR NOT public.is_chat_member(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.chats WHERE id = p_chat_id;
END;
$$;
CREATE FUNCTION public.delete_direct_chat_for_me(p_chat_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_type public.chat_type;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501'; END IF;
  SELECT type INTO v_type FROM public.chats WHERE id = p_chat_id FOR UPDATE;
  IF v_type IS DISTINCT FROM 'direct' THEN RAISE EXCEPTION 'delete_direct_chat_for_me only works on direct chats'; END IF;
  IF NOT public.is_chat_member(p_chat_id, auth.uid()) THEN RAISE EXCEPTION 'Chat membership required'; END IF;
  DELETE FROM public.chat_members WHERE chat_id = p_chat_id AND user_id = auth.uid();
END;
$$;

-- Restore only the canonical recipient of a new message in an accepted direct
-- chat. Run before auto-receipts, so the new message also gets an unread receipt.
-- The chat-row lock serializes this with delete_direct_chat_for_me().
CREATE FUNCTION public.restore_hidden_direct_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_chat public.chats%ROWTYPE; v_recipient uuid;
BEGIN
  IF NEW.chat_id IS NULL OR NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_chat FROM public.chats WHERE id = NEW.chat_id FOR UPDATE;
  IF v_chat.type <> 'direct' OR v_chat.status <> 'active' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = NEW.chat_id AND user_id = NEW.sender_id) THEN
    RETURN NEW;
  END IF;
  IF split_part(v_chat.direct_pair_key, '::', 1) = NEW.sender_id::text THEN
    v_recipient := split_part(v_chat.direct_pair_key, '::', 2)::uuid;
  ELSIF split_part(v_chat.direct_pair_key, '::', 2) = NEW.sender_id::text THEN
    v_recipient := split_part(v_chat.direct_pair_key, '::', 1)::uuid;
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.chat_members(chat_id, user_id)
    SELECT NEW.chat_id, id FROM public.profiles WHERE id = v_recipient
    ON CONFLICT (chat_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER messages_00_restore_direct_recipient AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.restore_hidden_direct_recipient();
REVOKE ALL ON FUNCTION public.restore_hidden_direct_recipient() FROM PUBLIC, anon, authenticated, service_role;

-- Opening an existing accepted direct chat from a profile restores only the
-- caller's membership. Pending requests must still be accepted by the recipient.
DO $$
DECLARE definition text; original text := E'  IF FOUND AND v_chat.status IN (''active'', ''pending_request'') THEN\n    RETURN v_chat.id;';
BEGIN
  definition := pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure);
  IF position(original IN definition) = 0 THEN RAISE EXCEPTION 'Unexpected create_direct_chat_request definition; migration stopped'; END IF;
  definition := replace(definition, original,
    E'  IF FOUND AND v_chat.status IN (''active'', ''pending_request'') THEN\n    IF v_chat.status = ''active'' THEN\n      INSERT INTO public.chat_members(chat_id,user_id) VALUES(v_chat.id,v_user) ON CONFLICT DO NOTHING;\n    END IF;\n    RETURN v_chat.id;');
  EXECUTE definition;
END;
$$;
DO $$
DECLARE signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY['mark_chat_as_unread(uuid)', 'mark_chat_as_read(uuid)',
    'delete_self_chat(uuid)', 'delete_direct_chat_for_me(uuid)'] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION public.' || signature || ' FROM PUBLIC, anon, service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.' || signature || ' TO authenticated';
  END LOOP;
END;
$$;
-- Empty initial requests have no message event. Publish requests as well, so
-- they appear immediately and acceptance/rejection updates both participants.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
COMMIT;
