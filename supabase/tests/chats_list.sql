-- Local only. Fixtures and all state changes roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM) = 0 THEN RAISE EXCEPTION 'Unexpected failure: %',SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Statement unexpectedly succeeded: %',statement;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('e1111111-1111-4111-8111-111111111111','chats-alice@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','chats-bob@example.test','{}'),
 ('e3333333-3333-4333-8333-333333333333','chats-carol@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.create_direct_chat_request('e2222222-2222-4222-8222-222222222222','Hello') AS direct \gset
SELECT public.create_self_chat() AS self \gset
SELECT pg_temp.assert_true((SELECT pinned_at IS NULL FROM public.chat_members WHERE chat_id=:'self'),'Self chat is not auto-pinned');
DELETE FROM public.chat_members WHERE chat_id=:'self';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.chat_members WHERE chat_id=:'self'),'Self membership cannot be deleted directly');
SELECT id AS request FROM public.chat_requests WHERE chat_id=:'direct' \gset
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.chats WHERE id=:'direct'),'Pending recipient cannot SELECT parent chat');
SELECT pg_temp.assert_true((SELECT content='Hello' FROM public.messages WHERE chat_id=:'direct' ORDER BY created_at LIMIT 1),'Pending recipient can read first message for request preview');
SELECT public.accept_chat_request(:'request');
SELECT public.mark_chat_as_read(:'direct');
SELECT public.mark_chat_as_unread(:'direct');
SELECT pg_temp.assert_true((SELECT manually_unread FROM public.chat_members WHERE chat_id=:'direct' AND user_id=auth.uid()),'Manual unread survives read receipts');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.message_receipts WHERE user_id=auth.uid() AND read_at IS NULL),'Manual unread does not fabricate unread receipts');
SELECT public.mark_chat_as_read(:'direct');
SELECT pg_temp.assert_true((SELECT NOT manually_unread FROM public.chat_members WHERE chat_id=:'direct' AND user_id=auth.uid()),'Mark read clears manual flag');
SELECT public.delete_direct_chat_for_me(:'direct');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.chats WHERE id=:'direct'),'Hidden chat is inaccessible');
SELECT pg_temp.rejects(format('SELECT public.mark_chat_as_unread(%L)',:'direct'),'membership required');
SELECT pg_temp.rejects(format('SELECT public.delete_self_chat(%L)',:'self'),'Not authorized');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'direct',auth.uid(),'Come back') RETURNING id AS message \gset
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.chats WHERE id=:'direct'),'New incoming message restores direct chat');
SELECT pg_temp.assert_true((SELECT read_at IS NULL FROM public.message_receipts WHERE message_id=:'message' AND user_id=auth.uid()),'Restored membership receives new unread receipt');
SELECT public.delete_direct_chat_for_me(:'direct');
SELECT public.create_direct_chat_request('e1111111-1111-4111-8111-111111111111','');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.chats WHERE id=:'direct'),'Opening accepted chat restores own membership');
INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),'e1111111-1111-4111-8111-111111111111');
SELECT public.delete_direct_chat_for_me(:'direct');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content) VALUES(%L,auth.uid(),''blocked'')',:'direct'),'blocked');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.chat_members WHERE chat_id=:'direct'),'Blocked message cannot restore recipient');
RESET ROLE;
DELETE FROM public.user_blocks WHERE blocker_id='e2222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
SELECT public.create_group_chat('Group',ARRAY['e2222222-2222-4222-8222-222222222222'::uuid,'e3333333-3333-4333-8333-333333333333'::uuid]) AS group_id \gset
RESET ROLE;
UPDATE public.chat_members SET joined_at=now()-interval '1 day' WHERE chat_id=:'group_id' AND user_id='e2222222-2222-4222-8222-222222222222';
SET LOCAL ROLE authenticated;
DELETE FROM public.chat_members WHERE chat_id=:'group_id' AND user_id=auth.uid();
RESET ROLE;
SELECT pg_temp.assert_true((SELECT role='admin' FROM public.chat_members WHERE chat_id=:'group_id' AND user_id='e2222222-2222-4222-8222-222222222222'),'Leaving last admin promotes oldest member');
SET LOCAL ROLE authenticated;
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'self',auth.uid(),'note');
SELECT public.delete_self_chat(:'self');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.chats WHERE id=:'self'),'Self chat fully deleted');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE chat_id=:'self'),'Self messages cascade deleted');
-- MFA guards apply even though the new RPCs run SECURITY DEFINER.
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES
 ('e4444444-4444-4444-8444-444444444444','e1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.mark_chat_as_read(%L)',:'direct'),'MFA required');
SELECT pg_temp.rejects(format('SELECT public.mark_chat_as_unread(%L)',:'direct'),'MFA required');
SELECT pg_temp.rejects(format('SELECT public.delete_direct_chat_for_me(%L)',:'direct'),'MFA required');
SELECT pg_temp.rejects(format('SELECT public.delete_self_chat(%L)',:'self'),'MFA required');
RESET ROLE;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.delete_self_chat(uuid)','execute'),'Anonymous RPC denied');
SELECT pg_temp.assert_true(NOT has_function_privilege('service_role','public.delete_direct_chat_for_me(uuid)','execute'),'Service role cannot invoke user deletion RPC');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='chat_requests'),'Requests published for empty initial request events');
ROLLBACK;
