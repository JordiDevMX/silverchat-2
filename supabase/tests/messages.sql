-- Local-only security and paging regression tests. All fixtures roll back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected failure: %',SQLERRM; END IF;
  RETURN;
 END;
 RAISE EXCEPTION 'Statement unexpectedly succeeded: %',statement;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('d1111111-1111-4111-8111-111111111111','messages-alice@example.test','{}'),
 ('d2222222-2222-4222-8222-222222222222','messages-bob@example.test','{}'),
 ('d3333333-3333-4333-8333-333333333333','messages-outsider@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.create_direct_chat_request('d2222222-2222-4222-8222-222222222222','Hello') AS direct \gset
SELECT public.create_group_chat('Message tests',ARRAY['d2222222-2222-4222-8222-222222222222'::uuid]) AS group_id \gset
INSERT INTO public.messages(chat_id,sender_id,content,mentions) VALUES(:'group_id',auth.uid(),'@bob',ARRAY['d2222222-2222-4222-8222-222222222222'::uuid]);
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content,mentions) VALUES(%L,auth.uid(),''bad'',ARRAY[''d3333333-3333-4333-8333-333333333333''::uuid])',:'group_id'),'Mentions must identify');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content,mentions) VALUES(%L,auth.uid(),''bad'',ARRAY[auth.uid()])',:'direct'),'Mentions must identify');
INSERT INTO public.file_uploads(id,uploader_id,bucket,path,original_filename,mime_type,size_bytes) VALUES
 ('d4444444-4444-4444-8444-444444444444',auth.uid(),'chat-media',:'direct'||'/d4444444-4444-4444-8444-444444444444/video.mp4','video.mp4','video/mp4',100),
 ('d5555555-5555-4555-8555-555555555555',auth.uid(),'chat-media',:'direct'||'/d5555555-5555-4555-8555-555555555555/video.thumb.jpg','video.thumb.jpg','image/jpeg',50);
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,type,file_upload_id) VALUES(%L,auth.uid(),''video'',''d4444444-4444-4444-8444-444444444444'')',:'direct'),'Media must be a completed upload');
UPDATE public.file_uploads SET status='completed',completed_at=now() WHERE id IN ('d4444444-4444-4444-8444-444444444444','d5555555-5555-4555-8555-555555555555');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,type,file_upload_id) VALUES(%L,auth.uid(),''video'',''d4444444-4444-4444-8444-444444444444'')',:'group_id'),'Media must be a completed upload');
INSERT INTO public.messages(chat_id,sender_id,type,file_upload_id,media_thumbnail_upload_id) VALUES(:'direct',auth.uid(),'video','d4444444-4444-4444-8444-444444444444','d5555555-5555-4555-8555-555555555555') RETURNING id AS video_id \gset
SELECT pg_temp.assert_true(public.own_upload_is_referenced('d5555555-5555-4555-8555-555555555555'),'Thumbnail is referenced');
DELETE FROM public.file_uploads WHERE id='d5555555-5555-4555-8555-555555555555';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.file_uploads WHERE id='d5555555-5555-4555-8555-555555555555'),'Referenced thumbnail cannot be removed');
RESET ROLE;
INSERT INTO storage.buckets(id,name,public) VALUES('chat-media','chat-media',false) ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.objects(bucket_id,name,owner) SELECT bucket,path,uploader_id FROM public.file_uploads WHERE id IN ('d4444444-4444-4444-8444-444444444444','d5555555-5555-4555-8555-555555555555');
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('chat-media',:'direct'||'/unreferenced.txt','d1111111-1111-4111-8111-111111111111');
SELECT set_config('request.jwt.claims','{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.chats WHERE id=:'direct'),'Pending recipient cannot read parent chat');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.get_chat_messages(:'direct')),'Pending recipient can read scoped message page');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.file_uploads WHERE id IN ('d4444444-4444-4444-8444-444444444444','d5555555-5555-4555-8555-555555555555')),'Pending recipient can resolve video and thumbnail metadata');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM storage.objects WHERE bucket_id='chat-media' AND name LIKE :'direct'||'/%'),'Pending media policy exposes only the two referenced objects');
INSERT INTO public.message_deletions(message_id,user_id) SELECT id,auth.uid() FROM public.messages WHERE chat_id=:'direct' AND content='Hello';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.get_chat_messages(:'direct')),'Per-user deletions also apply to the message RPC');
RESET ROLE;
-- A deleted row retains sensitive data internally; RPC must redact ALL payloads.
UPDATE public.messages SET deleted_for_everyone=true,deleted_at=now(),content='SECRET',contact_data='{"display_name":"SECRET"}' WHERE id=:'video_id';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE id=:'video_id'),'Raw deleted row remains hidden');
SELECT pg_temp.assert_true((SELECT deleted_for_everyone AND content IS NULL AND file_upload_id IS NULL AND media_thumbnail_upload_id IS NULL AND contact_data IS NULL AND mentions IS NULL AND reply_to_message_id IS NULL FROM public.get_chat_messages(:'direct') WHERE id=:'video_id'),'Deleted row becomes safe tombstone');
RESET ROLE;
-- Fifty rows per page, including identical timestamps, without gaps or duplicates.
INSERT INTO public.messages(chat_id,sender_id,content,created_at) SELECT :'group_id','d1111111-1111-4111-8111-111111111111','tie '||n,now()+interval '1 minute' FROM generate_series(1,75)n;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=50 FROM public.get_chat_messages(:'group_id')),'First page bounded to fifty');
SELECT created_at AS cursor_at,id AS cursor_id FROM public.get_chat_messages(:'group_id') ORDER BY created_at,id LIMIT 1 \gset
SELECT pg_temp.assert_true((SELECT count(*)=26 FROM public.get_chat_messages(:'group_id',:'cursor_at',:'cursor_id')),'Tie-breaker preserves all remaining messages');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_chat_messages(:'group_id')),'Outsiders cannot read message RPC');
SELECT pg_temp.assert_true(public.own_upload_is_referenced('d5555555-5555-4555-8555-555555555555'),'Reference probe reveals nothing to outsiders');
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES('d6666666-6666-4666-8666-666666666666','d2222222-2222-4222-8222-222222222222','totp','verified',now(),now());
SELECT set_config('request.jwt.claims','{"sub":"d2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_chat_messages(:'group_id')),'MFA guard applies to security definer read');
RESET ROLE;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.get_chat_messages(uuid,timestamptz,uuid)','execute'),'Anonymous access denied');
SELECT pg_temp.assert_true((SELECT command LIKE '%media_thumbnail_upload_id%' FROM cron.job WHERE jobname='cleanup_orphan_uploads'),'Cron protects referenced thumbnails');
ROLLBACK;
