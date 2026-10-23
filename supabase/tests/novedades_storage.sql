-- Real Storage RLS in a rollback-only local fixture.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(v boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text) RETURNS void LANGUAGE plpgsql AS $$BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN insufficient_privilege THEN RETURN; END; RAISE EXCEPTION 'Unexpected success: %',statement; END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('e1111111-1111-4111-8111-111111111111','media-owner@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','media-viewer@example.test','{}');
INSERT INTO storage.buckets(id,name,public) VALUES('avatars','avatars',false),('story-media','story-media',false),('channel-media','channel-media',false) ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.user_settings SET story_visibility='everyone' WHERE user_id=auth.uid();
SELECT public.create_channel('Media tests','media-tests','') AS channel \gset
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('avatars','chat-'||:'channel'||'/channel-123.webp',auth.uid());
SELECT public.update_channel_info(:'channel',NULL,NULL,NULL,'chat-'||:'channel'||'/channel-123.webp');
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes,duration_seconds) VALUES(auth.uid(),'story-media',auth.uid()||'/test/story.mp4','story.mp4','video/mp4',100,15) RETURNING id AS video_upload \gset
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes) VALUES(auth.uid(),'story-media',auth.uid()||'/test/thumb.webp','thumb.webp','image/webp',100) RETURNING id AS thumb_upload \gset
UPDATE public.file_uploads SET status='completed' WHERE id IN (:'video_upload',:'thumb_upload');
INSERT INTO storage.objects(bucket_id,name,owner) SELECT bucket,path,uploader_id FROM public.file_uploads WHERE id IN (:'video_upload',:'thumb_upload');
SELECT public.create_story('video',:'video_upload',NULL,NULL,NULL,:'thumb_upload') AS story \gset
SELECT pg_temp.assert_true(public.own_upload_is_referenced(:'thumb_upload'),'Active thumbnail is referenced');
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes) VALUES(auth.uid(),'channel-media',:'channel'||'/test/image.webp','image.webp','image/webp',100) RETURNING id AS channel_upload \gset
UPDATE public.file_uploads SET status='completed' WHERE id=:'channel_upload';
INSERT INTO storage.objects(bucket_id,name,owner) SELECT bucket,path,uploader_id FROM public.file_uploads WHERE id=:'channel_upload';
INSERT INTO public.messages(channel_id,sender_id,type,file_upload_id) VALUES(:'channel',auth.uid(),'image',:'channel_upload');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='avatars' AND name='chat-'||:'channel'||'/channel-123.webp'),'Discoverable channel avatar readable');
SELECT pg_temp.rejects(format('INSERT INTO storage.objects(bucket_id,name,owner) VALUES(''avatars'',%L,auth.uid())','chat-'||:'channel'||'/channel-attacker.webp'));
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM storage.objects WHERE bucket_id='story-media' AND name LIKE 'e1111111-1111-4111-8111-111111111111/test/%'),'Visible story includes private video and thumbnail');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.file_uploads WHERE id=:'thumb_upload'),'Viewer can resolve thumbnail metadata');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='channel-media' AND name=:'channel'||'/test/image.webp'),'Non-follower cannot read channel upload');
SELECT public.follow_channel(:'channel');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='channel-media' AND name=:'channel'||'/test/image.webp'),'Follower can read channel upload');
SELECT pg_temp.rejects(format('INSERT INTO storage.objects(bucket_id,name,owner) VALUES(''channel-media'',%L,auth.uid())',:'channel'||'/test/attacker.webp'));
RESET ROLE;
UPDATE public.stories SET expires_at=now()-interval '1 hour' WHERE id=:'story';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='story-media' AND name LIKE 'e1111111-1111-4111-8111-111111111111/test/%'),'Expired story cannot issue new media URLs to viewers');
ROLLBACK;
