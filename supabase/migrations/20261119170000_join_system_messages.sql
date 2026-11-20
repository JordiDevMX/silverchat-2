BEGIN;

CREATE OR REPLACE FUNCTION public.handle_chat_member_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_chat_type public.chat_type;
  v_member_name text;
BEGIN
  SELECT type INTO v_chat_type
  FROM public.chats
  WHERE id = NEW.chat_id;

  IF v_chat_type IS NULL OR v_chat_type NOT IN ('group', 'community_chat') THEN
    RETURN NEW;
  END IF;

  -- Skip initial members inserted during chat creation (same transaction as existing rows).
  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_members cm
    WHERE cm.chat_id = NEW.chat_id
      AND pg_catalog.age(cm.xmin) > 0
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(display_name), ''), NULLIF(btrim(username), ''), 'Member')
  INTO v_member_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  v_member_name := COALESCE(v_member_name, 'Member');

  INSERT INTO public.messages (chat_id, sender_id, type, content)
  VALUES (NEW.chat_id, NULL, 'system', pg_catalog.format('''%s'' joined the chat', v_member_name));

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_chat_member_insert() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_chat_member_insert() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS chat_members_after_insert ON public.chat_members;
CREATE TRIGGER chat_members_after_insert
  AFTER INSERT ON public.chat_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_chat_member_insert();

COMMIT;
