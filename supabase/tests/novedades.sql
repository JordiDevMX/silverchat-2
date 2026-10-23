-- Local transaction fixtures; never run against production.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(v boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF; RETURN; END; RAISE EXCEPTION 'Unexpected success: %',statement; END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('d1111111-1111-4111-8111-111111111111','stories-owner@example.test','{}'),
 ('d2222222-2222-4222-8222-222222222222','stories-follower@example.test','{}'),
 ('d3333333-3333-4333-8333-333333333333','stories-outsider@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.user_settings SET story_visibility='everyone' WHERE user_id=auth.uid();
SELECT public.create_story('text',NULL,'First story','#123456') AS story \gset
SELECT pg_temp.assert_true((SELECT expires_at-created_at=interval '24 hours' FROM public.stories WHERE id=:'story'),'Stories expire in 24 hours');
SELECT pg_temp.rejects('SELECT public.create_story(''text'',NULL,'''',''#123456'')','1 to 200');
SELECT pg_temp.rejects('SELECT public.create_story(''text'',NULL,repeat(''x'',201),''#123456'')','1 to 200');
SELECT pg_temp.rejects('SELECT public.create_story(''text'',NULL,''x'',''url(https://example.test)'')','valid story background');
SELECT pg_temp.rejects('INSERT INTO public.stories(user_id,media_type,text_content) VALUES(auth.uid(),''text'',''bypass'')','permission denied');
SELECT pg_temp.assert_true(public.create_story('text',NULL,'First story','#123456',NULL,NULL,:'story')=:'story','Story retry is idempotent');
SELECT public.mark_story_viewed(:'story');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.story_views WHERE story_id=:'story'),'Owner views are not counted');
SELECT public.create_channel('Novedades tests','novedades-tests','Description') AS channel \gset
SELECT pg_temp.assert_true((SELECT follower_count=1 FROM public.channels WHERE id=:'channel'),'Owner auto-follows');
SELECT pg_temp.rejects('SELECT public.create_channel(''Channel'',''novedades-tests'','''')','slug is already taken');
SELECT pg_temp.rejects('SELECT public.create_channel(repeat(''a'',101),''another-channel'','''')','1 to 100');
INSERT INTO public.messages(channel_id,sender_id,type,content) VALUES(:'channel',auth.uid(),'text','Channel broadcast') RETURNING id AS post \gset
SELECT public.update_channel_info(:'channel','Renamed channel',NULL,'Updated');
SELECT pg_temp.rejects(format('SELECT public.update_channel_info(%L,NULL,''BAD SLUG'')',:'channel'),'Slug must');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.mark_story_viewed(:'story');
SELECT public.mark_story_viewed(:'story');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.story_views WHERE story_id=:'story'),'Views are idempotent');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_story_viewers(:'story')),'Viewers list is owner only');
SELECT pg_temp.rejects(format('SELECT public.delete_story(%L)',:'story'),'Not authorized');
SELECT public.follow_channel(:'channel');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.messages WHERE id=:'post'),'Follower can read channel');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(channel_id,sender_id,type,content) VALUES(%L,auth.uid(),''text'',''comment'')',:'channel'),'row-level security');
SELECT public.set_message_reaction(:'post','👍');
SELECT public.set_message_reaction(:'post','❤️');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.message_reactions WHERE message_id=:'post' AND emoji='❤️'),'Channel reaction replaces previous');
SELECT pg_temp.rejects(format('SELECT public.set_message_reaction(%L,''🤖'')',:'post'),'eight channel reactions');
SELECT pg_temp.rejects(format('SELECT public.update_channel_info(%L,''Attacker'')',:'channel'),'Only the channel owner');
UPDATE public.channel_followers SET muted_until='9999-12-31T23:59:59Z',last_read_at=now() WHERE channel_id=:'channel' AND user_id=auth.uid();
SELECT pg_temp.assert_true((SELECT muted_until>now() FROM public.channel_followers WHERE channel_id=:'channel' AND user_id=auth.uid()),'Follower can mute their subscription');
SELECT public.create_direct_chat_request('d1111111-1111-4111-8111-111111111111','') AS direct \gset
INSERT INTO public.messages(chat_id,sender_id,type,content,reply_to_story_id) VALUES(:'direct',auth.uid(),'text','Story reply',:'story') RETURNING id AS reply \gset
SELECT public.create_self_chat() AS self \gset
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,type,content,reply_to_story_id) VALUES(%L,auth.uid(),''text'',''wrong scope'',%L)',:'self',:'story'),'Story reply target');
SELECT public.unfollow_channel(:'channel');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE id=:'post'),'Unfollow removes message access');
SELECT pg_temp.rejects(format('SELECT public.set_message_reaction(%L,''👍'')',:'post'),'Message unavailable');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.get_story_viewers(:'story')),'Owner can retrieve viewers');
UPDATE public.user_settings SET story_visibility='nobody' WHERE user_id=auth.uid();
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.mark_story_viewed(%L)',:'story'),'Story unavailable');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.stories WHERE id=:'story'),'Story privacy enforced');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.delete_story(:'story');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT reply_to_story_id IS NULL FROM public.messages WHERE id=:'reply'),'Hard delete preserves reply text and nulls story FK');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.story_views WHERE story_id=:'story'),'Hard delete cascades views');
SET LOCAL ROLE authenticated;
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes,duration_seconds) VALUES(auth.uid(),'story-media',auth.uid()||'/video/story.mp4','story.mp4','video/mp4',100,16) RETURNING id AS upload \gset
UPDATE public.file_uploads SET status='completed' WHERE id=:'upload';
SELECT pg_temp.rejects(format('SELECT public.create_story(''video'',%L)',:'upload'),'at most 15 seconds');
UPDATE public.file_uploads SET duration_seconds=15 WHERE id=:'upload';
SELECT public.create_story('video',:'upload') AS video \gset
SELECT pg_temp.assert_true(public.own_upload_is_referenced(:'upload'),'Story upload is protected while referenced');
SELECT public.delete_story(:'video');
DO $$BEGIN FOR i IN 1..10 LOOP PERFORM public.create_story('text',NULL,'Story '||i,'#123456'); END LOOP; END $$;
SELECT pg_temp.rejects('SELECT public.create_story(''text'',NULL,''11th'',''#123456'')','up to 10 active stories');
DELETE FROM public.channels WHERE id=:'channel';
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE id=:'post'),'Channel deletion cascades posts');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.channel_followers WHERE channel_id=:'channel'),'Channel deletion cascades follows');
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.create_story(public.story_media_type,uuid,text,text,text,uuid,uuid)','execute'),'Anonymous story creation denied');
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES(gen_random_uuid(),'d1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects('SELECT public.create_story(''text'',NULL,''MFA bypass'',''#123456'')','MFA required');
ROLLBACK;
