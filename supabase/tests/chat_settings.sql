-- Local-only validation; fixtures are rolled back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF; RETURN; END;
 RAISE EXCEPTION 'Unexpected success: %',statement;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('c1111111-1111-4111-8111-111111111111','settings-owner@example.test','{}'),
 ('c2222222-2222-4222-8222-222222222222','settings-admin@example.test','{}'),
 ('c3333333-3333-4333-8333-333333333333','settings-member@example.test','{}'),
 ('c4444444-4444-4444-8444-444444444444','settings-blocked@example.test','{}'),
 ('c5555555-5555-4555-8555-555555555555','settings-outsider@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.create_group_chat('Settings tests',ARRAY['c2222222-2222-4222-8222-222222222222'::uuid]) AS grp \gset
SELECT public.create_self_chat() AS self_id \gset
INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),'c4444444-4444-4444-8444-444444444444');
SELECT pg_temp.assert_true(public.add_chat_members(:'grp',ARRAY['c2222222-2222-4222-8222-222222222222','c3333333-3333-4333-8333-333333333333','c4444444-4444-4444-8444-444444444444']::uuid[])=1,'Duplicate members and blocked users are skipped');
SELECT pg_temp.rejects(format('SELECT public.add_chat_members(%L,array_fill(auth.uid(),ARRAY[51]))',:'grp'),'1 and 50');
SELECT pg_temp.rejects(format('SELECT public.add_chat_members(%L,ARRAY[auth.uid()])',:'self_id'),'Group admin required');
SELECT public.promote_chat_admin(:'grp','c2222222-2222-4222-8222-222222222222');
SELECT public.update_group_info(:'grp','Renamed group','A description');
SELECT pg_temp.assert_true((SELECT name='Renamed group' AND description='A description' FROM public.chats WHERE id=:'grp'),'Admin saves group fields');
SELECT pg_temp.rejects(format('SELECT public.update_group_info(%L,''   '')',:'grp'),'between 1 and 100');
SELECT pg_temp.rejects(format('SELECT public.update_group_info(%L,NULL,repeat(''a'',501))',:'grp'),'500 characters');
SELECT pg_temp.rejects(format('SELECT public.update_group_info(%L,NULL,NULL,''https://example.test/photo'')',:'grp'),'uploaded to this chat');
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'grp',auth.uid(),'Keep for other members') RETURNING id AS msg \gset
SELECT pg_temp.assert_true(public.clear_chat_for_me(:'grp')=1,'Clear inserts only personal deletions');
SELECT pg_temp.assert_true(public.clear_chat_for_me(:'grp')=0,'Clear is idempotent');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_chat_messages(:'grp')),'Cleared history hidden for caller');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.message_receipts WHERE user_id=auth.uid() AND read_at IS NULL),'Caller unread receipts cleared');
RESET ROLE;
INSERT INTO storage.buckets(id,name,public) VALUES('avatars','avatars',false) ON CONFLICT(id) DO NOTHING;
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('avatars','chat-'||:'grp'||'/group-123.webp',auth.uid());
SELECT public.update_group_info(:'grp',NULL,NULL,'chat-'||:'grp'||'/group-123.webp');
SELECT pg_temp.assert_true((SELECT avatar_url='chat-'||:'grp'||'/group-123.webp' FROM public.chats WHERE id=:'grp'),'Group avatar persisted');
INSERT INTO public.reports(reporter_id,reported_user_id,reason,description) VALUES(auth.uid(),'c3333333-3333-4333-8333-333333333333','other','Test reason');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.get_chat_messages(:'grp')),'Clear never removes another member history');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='avatars' AND name='chat-'||:'grp'||'/group-123.webp'),'Members can sign group avatar');
SELECT pg_temp.rejects(format('INSERT INTO storage.objects(bucket_id,name,owner) VALUES(''avatars'',%L,auth.uid())','chat-'||:'grp'||'/group-member.webp'),'row-level security');
SELECT pg_temp.rejects(format('SELECT public.update_group_info(%L,''attacker'')',:'grp'),'Group admin required');
SELECT pg_temp.rejects(format('SELECT public.promote_chat_admin(%L,auth.uid())',:'grp'),'Group admin required');
SELECT pg_temp.rejects(format('SELECT public.remove_chat_member(%L,''c1111111-1111-4111-8111-111111111111'')',:'grp'),'Group admin required');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.reports WHERE reported_user_id=auth.uid()),'Reported user cannot read report');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.demote_chat_admin(%L,''c1111111-1111-4111-8111-111111111111'')',:'grp'),'Cannot demote the group creator');
SELECT pg_temp.rejects(format('SELECT public.remove_chat_member(%L,''c1111111-1111-4111-8111-111111111111'')',:'grp'),'Cannot remove the group creator');
SELECT public.demote_chat_admin(:'grp',auth.uid());
SELECT pg_temp.assert_true((SELECT role='member' FROM public.chat_members WHERE chat_id=:'grp' AND user_id=auth.uid()),'Noncreator admin demotion');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.demote_chat_admin(%L,auth.uid())',:'grp'),'At least one admin');
SELECT public.remove_chat_member(:'grp','c3333333-3333-4333-8333-333333333333');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.chat_members WHERE chat_id=:'grp'),'Admin removes ordinary member');
DELETE FROM public.chat_members WHERE chat_id=:'grp' AND user_id=auth.uid();
RESET ROLE;
SELECT pg_temp.assert_true((SELECT role='admin' FROM public.chat_members WHERE chat_id=:'grp' AND user_id='c2222222-2222-4222-8222-222222222222'),'Existing leave trigger promotes remaining oldest member');
SELECT set_config('request.jwt.claims','{"sub":"c5555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.clear_chat_for_me(%L)',:'grp'),'Chat membership required');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='avatars' AND name='chat-'||:'grp'||'/group-123.webp'),'Outsider cannot read group avatar');
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES(gen_random_uuid(),'c2222222-2222-4222-8222-222222222222','totp','verified',now(),now());
SELECT set_config('request.jwt.claims','{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.add_chat_members(%L,ARRAY[''c3333333-3333-4333-8333-333333333333''::uuid])',:'grp'),'MFA required');
SELECT pg_temp.rejects(format('SELECT public.clear_chat_for_me(%L)',:'grp'),'Chat membership required');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
DELETE FROM public.chat_members WHERE chat_id=:'grp' AND user_id=auth.uid();
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.chats WHERE id=:'grp'),'Last member leaving deletes group');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.clear_chat_for_me(uuid)','execute'),'Anonymous execution denied');
ROLLBACK;
