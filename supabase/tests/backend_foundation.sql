-- Run against a disposable Supabase DB, after 0001 -> 0002 -> 0003 -> 0004.
-- psql -X -v ON_ERROR_STOP=1 --file supabase/tests/backend_foundation.sql
-- All fixtures and helper functions roll back. No additional extensions needed.
BEGIN;
CREATE TEMP TABLE check_results(label text NOT NULL);
GRANT ALL ON check_results TO authenticated, anon;
CREATE FUNCTION pg_temp.assert_true(p_ok boolean, p_label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', p_label; END IF;
  INSERT INTO check_results VALUES (p_label);
END;
$$;
CREATE FUNCTION pg_temp.expect_error(p_sql text, p_state text, p_message text, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_failed boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> p_state OR SQLERRM !~ p_message THEN
      RAISE EXCEPTION 'Unexpected error for %: [%] %', p_label, SQLSTATE, SQLERRM;
    END IF;
    v_failed := true;
  END;
  PERFORM pg_temp.assert_true(v_failed, p_label);
END;
$$;

SELECT pg_temp.assert_true((SELECT count(*) = 22 FROM pg_tables WHERE schemaname = 'public'), '22 application tables including auth backup codes');
SELECT pg_temp.assert_true((SELECT count(*) = 13 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'), '13 explicitly specified enums');
SELECT pg_temp.assert_true((SELECT bool_and(rowsecurity) FROM pg_tables WHERE schemaname='public'), 'RLS on every table');
SELECT pg_temp.assert_true((SELECT count(*) = 9 FROM public.app_config), 'nine app_config seeds');
SELECT pg_temp.assert_true((SELECT count(*) = 4 FROM cron.job WHERE jobname IN ('cleanup_stale_calls','cleanup_expired_stories','cleanup_pending_uploads','cleanup_orphan_uploads')), 'four cron jobs');
SELECT pg_temp.assert_true((SELECT count(*)=5 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename IN ('messages','chat_members','calls','message_receipts','stories')), 'five Realtime tables');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.create_self_chat()','EXECUTE'), 'anonymous RPC access revoked');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.is_chat_member(uuid,uuid)','EXECUTE'), 'anonymous helper access revoked');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.profiles_visible','SELECT'), 'anonymous privacy view access revoked');

INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('11111111-1111-4111-8111-111111111111','backend-a@example.invalid','{"display_name":"Alice"}'),
 ('22222222-2222-4222-8222-222222222222','backend-b@example.invalid','{"display_name":"Bob"}'),
 ('33333333-3333-4333-8333-333333333333','backend-c@example.invalid','{"display_name":"Carol"}'),
 ('44444444-4444-4444-8444-444444444444','backend-d@example.invalid','{"display_name":"Dora"}');
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM public.user_settings WHERE user_id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444')), 'auth trigger creates settings');
SELECT pg_temp.assert_true((SELECT display_name='Alice' AND username='user_11111111' FROM public.profiles WHERE id='11111111-1111-4111-8111-111111111111'), 'auth trigger creates profile');
SELECT pg_temp.expect_error($q$INSERT INTO public.messages(content) VALUES ('no scope')$q$,'23514','messages_exactly_one_scope','message XOR rejects absent scope');
UPDATE public.profiles SET avatar_url='private-avatar',last_seen_at=now() WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE public.user_settings SET profile_photo_visibility='nobody',presence_visible=false WHERE user_id='22222222-2222-4222-8222-222222222222';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.profiles), 'profiles only exposes own row');
SELECT pg_temp.assert_true((SELECT avatar_url IS NULL AND last_seen_at IS NULL FROM public.profiles_visible WHERE id='22222222-2222-4222-8222-222222222222'), 'privacy view masks avatar and presence');
SELECT pg_temp.expect_error($q$INSERT INTO public.chats(type) VALUES ('group')$q$,'42501','permission denied','direct chat inserts prohibited');
SELECT set_config('test.direct',public.create_direct_chat_request('22222222-2222-4222-8222-222222222222','Hello Bob')::text,true);
SELECT pg_temp.assert_true(public.create_direct_chat_request('22222222-2222-4222-8222-222222222222','Retry')=current_setting('test.direct')::uuid,'duplicate direct request reuses chat');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.messages WHERE chat_id=current_setting('test.direct')::uuid),'request creates one initial message');
SELECT set_config('test.request',(SELECT id::text FROM public.chat_requests WHERE chat_id=current_setting('test.direct')::uuid AND status='pending'),true);
SELECT set_config('test.initial_message',(SELECT id::text FROM public.messages WHERE chat_id=current_setting('test.direct')::uuid),true);
SELECT pg_temp.expect_error(format('INSERT INTO public.calls(initiator_id,chat_id,livekit_room_name) VALUES (auth.uid(),%L,''pending-call'')',current_setting('test.direct')),'42501','row-level security','cannot call in pending chat');
INSERT INTO public.messages(chat_id,sender_id,content) VALUES (current_setting('test.direct')::uuid,auth.uid(),'Second pending message');
SELECT pg_temp.assert_true((SELECT last_message_preview='Second pending message' FROM public.chats WHERE id=current_setting('test.direct')::uuid),'message updates chat preview');
SELECT set_config('test.self',public.create_self_chat()::text,true);
SELECT pg_temp.assert_true(public.create_self_chat()=current_setting('test.self')::uuid,'self chat is idempotent');
WITH removed AS (DELETE FROM public.chat_members WHERE chat_id=current_setting('test.self')::uuid RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM removed),'cannot leave self chat');

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.chats WHERE id=current_setting('test.direct')::uuid),'outsider cannot see chat');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.messages WHERE chat_id=current_setting('test.direct')::uuid),'outsider cannot see messages');
SELECT pg_temp.expect_error(format('SELECT public.accept_chat_request(%L)',current_setting('test.request')),'P0001','current user','outsider cannot accept request');
SELECT pg_temp.expect_error(format('INSERT INTO public.message_reactions(message_id,user_id,emoji) VALUES (%L,auth.uid(),''x'')',current_setting('test.initial_message')),'42501','row-level security','outsider cannot react to hidden message');

SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.messages WHERE chat_id=current_setting('test.direct')::uuid),'pending recipient can read messages');
SELECT pg_temp.expect_error(format('INSERT INTO public.messages(chat_id,sender_id,content) VALUES (%L,auth.uid(),''not accepted'')',current_setting('test.direct')),'42501','row-level security','pending recipient cannot send');
SELECT public.accept_chat_request(current_setting('test.request')::uuid);
SELECT pg_temp.assert_true((SELECT status='active' FROM public.chats WHERE id=current_setting('test.direct')::uuid),'acceptance activates chat');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.message_receipts WHERE user_id=auth.uid()),'acceptance backfills pending receipts');
SELECT public.mark_chat_as_read(current_setting('test.direct')::uuid);
SELECT pg_temp.assert_true((SELECT bool_and(read_at IS NOT NULL) FROM public.message_receipts WHERE user_id=auth.uid()),'mark chat read updates receipts');
UPDATE public.user_settings SET read_receipts_enabled=false WHERE user_id=auth.uid();
INSERT INTO public.messages(chat_id,sender_id,content) VALUES (current_setting('test.direct')::uuid,auth.uid(),'Reply from Bob');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.message_receipts WHERE user_id<>auth.uid()),'disabled viewer cannot see others receipts');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.message_receipts WHERE user_id='22222222-2222-4222-8222-222222222222'),'enabled viewer cannot see disabled user receipts');
UPDATE public.messages SET content='Edited hello' WHERE id=current_setting('test.initial_message')::uuid;
SELECT pg_temp.assert_true((SELECT content='Edited hello' AND edited_at IS NOT NULL FROM public.messages WHERE id=current_setting('test.initial_message')::uuid),'edit inside 15 minutes works');
SELECT pg_temp.expect_error(format('UPDATE public.messages SET content=''combined'',deleted_at=now(),deleted_for_everyone=true WHERE id=%L',current_setting('test.initial_message')),'P0001','Cannot combine','combined edit and delete rejected');
SELECT pg_temp.expect_error(format('UPDATE public.chat_members SET role=''admin'' WHERE chat_id=%L AND user_id=auth.uid()',current_setting('test.direct')),'42501','permission denied','members cannot promote themselves');
RESET ROLE;
UPDATE public.messages SET created_at=now()-interval '30 minutes' WHERE id=current_setting('test.initial_message')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('UPDATE public.messages SET content=''late edit'' WHERE id=%L',current_setting('test.initial_message')),'P0001','15 minutes','late edit rejected despite permissive delete policy');
SELECT public.delete_message_for_everyone(current_setting('test.initial_message')::uuid);
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.messages WHERE id=current_setting('test.initial_message')::uuid),'deleted content hidden from recipient');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

SELECT set_config('test.rejected',public.create_direct_chat_request('33333333-3333-4333-8333-333333333333','Hello Carol')::text,true);
SELECT set_config('test.rejected_request',(SELECT id::text FROM public.chat_requests WHERE chat_id=current_setting('test.rejected')::uuid),true);
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT public.reject_chat_request(current_setting('test.rejected_request')::uuid);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT pg_temp.expect_error($q$SELECT public.create_direct_chat_request('33333333-3333-4333-8333-333333333333','Too soon')$q$,'P0001','Cooldown active','seven-day cooldown enforced');
RESET ROLE;
UPDATE public.chats SET rejected_at=now()-interval '8 days' WHERE id=current_setting('test.rejected')::uuid;
UPDATE public.chat_requests SET responded_at=now()-interval '8 days' WHERE id=current_setting('test.rejected_request')::uuid;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.create_direct_chat_request('33333333-3333-4333-8333-333333333333','After cooldown')=current_setting('test.rejected')::uuid,'retry reuses rejected chat');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.chat_requests WHERE chat_id=current_setting('test.rejected')::uuid),'retry preserves rejected history');

SELECT set_config('test.group',public.create_group_chat('Group',ARRAY['22222222-2222-4222-8222-222222222222'::uuid])::text,true);
SELECT public.add_chat_member(current_setting('test.group')::uuid,'33333333-3333-4333-8333-333333333333');
DELETE FROM public.chat_members WHERE chat_id=current_setting('test.group')::uuid AND user_id=auth.uid();
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.chat_members WHERE chat_id=current_setting('test.group')::uuid AND role='admin'),'leaving last admin promotes a member');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DELETE FROM public.chat_members WHERE chat_id=current_setting('test.group')::uuid AND user_id=auth.uid();
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DELETE FROM public.chat_members WHERE chat_id=current_setting('test.group')::uuid AND user_id=auth.uid();
RESET ROLE;
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.chats WHERE id=current_setting('test.group')::uuid),'last group member leaving removes chat');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.channel',public.create_channel('Channel','backend-test-channel','Test')::text,true);
SELECT pg_temp.assert_true((SELECT follower_count=1 FROM public.channels WHERE id=current_setting('test.channel')::uuid),'channel owner auto-follows');
INSERT INTO public.messages(channel_id,sender_id,content) VALUES (current_setting('test.channel')::uuid,auth.uid(),'Channel post');
SELECT set_config('test.channel_message',(SELECT last_message_id::text FROM public.channels WHERE id=current_setting('test.channel')::uuid),true);
SELECT public.delete_message_for_everyone(current_setting('test.channel_message')::uuid);
SELECT pg_temp.assert_true((SELECT last_message_preview='This message was deleted' FROM public.channels WHERE id=current_setting('test.channel')::uuid),'channel deletion updates preview');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT public.follow_channel(current_setting('test.channel')::uuid);
SELECT public.follow_channel(current_setting('test.channel')::uuid);
SELECT pg_temp.assert_true((SELECT follower_count=2 FROM public.channels WHERE id=current_setting('test.channel')::uuid),'follow is idempotent and counter accurate');
SELECT pg_temp.expect_error(format('INSERT INTO public.messages(channel_id,sender_id,content) VALUES (%L,auth.uid(),''follower post'')',current_setting('test.channel')),'42501','row-level security','follower cannot publish');
DELETE FROM public.channel_followers WHERE channel_id=current_setting('test.channel')::uuid AND user_id=auth.uid();
SELECT pg_temp.assert_true((SELECT follower_count=1 FROM public.channels WHERE id=current_setting('test.channel')::uuid),'unfollow decrements counter');
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.community',public.create_community('Community','Test')::text,true);
RESET ROLE;
INSERT INTO public.chats(type,community_id,name) VALUES ('community_chat',current_setting('test.community')::uuid,'Community room');
SELECT set_config('test.community_chat',(SELECT id::text FROM public.chats WHERE community_id=current_setting('test.community')::uuid),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT public.join_community(current_setting('test.community')::uuid);
SELECT public.join_community(current_setting('test.community')::uuid);
SELECT pg_temp.assert_true(public.is_chat_member(current_setting('test.community_chat')::uuid,auth.uid()),'joining community auto-joins community chats');
SELECT pg_temp.assert_true((SELECT member_count=2 FROM public.communities WHERE id=current_setting('test.community')::uuid),'community join idempotent and count accurate');
DELETE FROM public.community_members WHERE community_id=current_setting('test.community')::uuid AND user_id=auth.uid();
SELECT pg_temp.assert_true(NOT public.is_chat_member(current_setting('test.community_chat')::uuid,auth.uid()),'leaving community removes chat membership');
SELECT pg_temp.assert_true((SELECT member_count=1 FROM public.communities WHERE id=current_setting('test.community')::uuid),'community leave decrements count');

INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes)
 VALUES (auth.uid(),'avatars',auth.uid()::text||'/test.webp','test.webp','image/webp',1234);
SELECT pg_temp.assert_true(public.get_my_storage_usage()=0,'pending files excluded from storage usage');
UPDATE public.file_uploads SET status='completed',completed_at=now() WHERE uploader_id=auth.uid();
SELECT pg_temp.assert_true(public.get_my_storage_usage()=1234,'storage usage sums completed own files');
INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES (auth.uid(),'44444444-4444-4444-8444-444444444444');
SELECT pg_temp.expect_error($q$SELECT public.create_direct_chat_request('44444444-4444-4444-8444-444444444444','Blocked')$q$,'P0001','blocked','blocked direct request denied');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.profiles_visible WHERE id='44444444-4444-4444-8444-444444444444'),'blocked profile hidden');
RESET ROLE;

-- Storage policies are exercised as database RLS (no object API is mocked).
INSERT INTO storage.buckets(id,name,public) VALUES
 ('avatars','avatars',false),('chat-media','chat-media',false)
ON CONFLICT (id) DO NOTHING;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars',auth.uid()::text||'/backend-test.webp');
SELECT pg_temp.expect_error($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('avatars','22222222-2222-4222-8222-222222222222/forbidden.webp')$q$,'42501','row-level security','cannot upload another users avatar');
INSERT INTO storage.objects(bucket_id,name) VALUES ('chat-media',current_setting('test.direct')||'/backend-test/file.webp');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name=current_setting('test.direct')||'/backend-test/file.webp'),'outsider cannot read chat storage');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='chat-media' AND name=current_setting('test.direct')||'/backend-test/file.webp'),'member can read chat storage');

-- Edit/delete expiry and constraints are tested independently of happy paths.
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
INSERT INTO public.messages(chat_id,sender_id,content) VALUES (current_setting('test.self')::uuid,auth.uid(),'Too old');
SELECT set_config('test.old_message',(SELECT last_message_id::text FROM public.chats WHERE id=current_setting('test.self')::uuid),true);
RESET ROLE;
UPDATE public.messages SET created_at=now()-interval '2 hours' WHERE id=current_setting('test.old_message')::uuid;
SELECT pg_temp.expect_error(format('INSERT INTO public.messages(chat_id,channel_id) VALUES (%L,%L)',current_setting('test.self'),current_setting('test.channel')),'23514','messages_exactly_one_scope','message XOR rejects both scopes');
SELECT pg_temp.expect_error($q$INSERT INTO public.chats(type,direct_pair_key) VALUES ('self','self::11111111-1111-4111-8111-111111111111')$q$,'23505','direct_pair_key','duplicate pair key rejected');
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_error(format('SELECT public.delete_message_for_everyone(%L)',current_setting('test.old_message')),'P0001','one hour','late delete RPC rejected');
WITH changed AS (UPDATE public.messages SET deleted_for_everyone=true,deleted_at=now() WHERE id=current_setting('test.old_message')::uuid RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'late direct delete changes no rows');

-- Account deletion must not conflict with the calls initiator FK.
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
SELECT set_config('test.dora_self',public.create_self_chat()::text,true);
INSERT INTO public.calls(initiator_id,chat_id,livekit_room_name) VALUES (auth.uid(),current_setting('test.dora_self')::uuid,'backend-test-deleted-initiator');
RESET ROLE;
DELETE FROM auth.users WHERE id='44444444-4444-4444-8444-444444444444';
SELECT pg_temp.assert_true((SELECT initiator_id IS NULL FROM public.calls WHERE livekit_room_name='backend-test-deleted-initiator'),'account deletion nulls call initiator');

-- Execute the actual scheduled commands against expired fixtures, inside
-- this transaction. This tests the cleanup SQL without waiting for the clock.
UPDATE public.calls SET started_at=now()-interval '2 minutes' WHERE livekit_room_name='backend-test-deleted-initiator';
INSERT INTO public.stories(id,user_id,media_type,text_content,expires_at)
 VALUES ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','text','Expired',now()-interval '2 hours');
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes,created_at,status)
 VALUES ('11111111-1111-4111-8111-111111111111','avatars','backend-old-pending','pending.webp','image/webp',100,now()-interval '2 hours','pending'),
        ('11111111-1111-4111-8111-111111111111','avatars','backend-old-orphan','orphan.webp','image/webp',100,now()-interval '8 days','completed');
DO $$
DECLARE job record;
BEGIN
 FOR job IN SELECT command FROM cron.job WHERE jobname IN
 ('cleanup_stale_calls','cleanup_expired_stories','cleanup_pending_uploads','cleanup_orphan_uploads')
 LOOP EXECUTE job.command; END LOOP;
END;
$$;
SELECT pg_temp.assert_true((SELECT status='missed' AND ended_at IS NOT NULL FROM public.calls WHERE livekit_room_name='backend-test-deleted-initiator'),'cron marks stale ringing calls missed');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.stories WHERE id='55555555-5555-4555-8555-555555555555'),'cron removes expired stories');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.file_uploads WHERE path='backend-old-pending'),'cron removes pending uploads');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM public.file_uploads WHERE path='backend-old-orphan'),'cron removes orphan metadata');

SELECT count(*) AS passed_checks FROM check_results;
ROLLBACK;
