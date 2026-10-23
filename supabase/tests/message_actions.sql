-- Local-only tests: transaction rolls back all fixtures.
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
 ('e1111111-1111-4111-8111-111111111111','actions-alice@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','actions-bob@example.test','{}'),
 ('e3333333-3333-4333-8333-333333333333','actions-carol@example.test','{}'),
 ('e4444444-4444-4444-8444-444444444444','actions-outsider@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.create_group_chat('Actions source',ARRAY['e2222222-2222-4222-8222-222222222222'::uuid]) AS source \gset
SELECT public.create_group_chat('Actions destination',ARRAY['e3333333-3333-4333-8333-333333333333'::uuid]) AS destination \gset
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'source',auth.uid(),'one') RETURNING id AS one \gset
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'source',auth.uid(),'two') RETURNING id AS two \gset
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'source',auth.uid(),'three') RETURNING id AS three \gset
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'source',auth.uid(),'four') RETURNING id AS four \gset
SELECT public.set_message_pin(:'one',true),public.set_message_pin(:'two',true),public.set_message_pin(:'three',true);
SELECT pg_temp.rejects(format('SELECT public.set_message_pin(%L,true)',:'four'),'Cannot pin more than 3');
SELECT public.delete_chat_message_for_me(:'two');
SELECT pg_temp.rejects(format('SELECT public.set_message_pin(%L,true)',:'four'),'Cannot pin more than 3');
SELECT public.set_message_pin(:'one',false),public.set_message_pin(:'four',true);
SELECT public.set_message_reaction(:'one','👍');
SELECT public.set_message_reaction(:'one','❤️');
SELECT pg_temp.assert_true((SELECT count(*)=1 AND min(emoji)='❤️' FROM public.message_reactions WHERE message_id=:'one'),'Reaction replaces the one-per-user row');
SELECT public.set_message_reaction(:'one');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.message_reactions WHERE message_id=:'one'),'Reaction removal');
UPDATE public.messages SET content='edited',edited_at=now() WHERE id=:'one';
SELECT pg_temp.assert_true((SELECT content='edited' AND edited_at IS NOT NULL FROM public.messages WHERE id=:'one'),'Own recent text edit');
SELECT pg_temp.rejects(format('UPDATE public.messages SET content='''' WHERE id=%L',:'one'),'cannot be edited');
INSERT INTO public.messages(chat_id,sender_id,content,reply_to_message_id) VALUES(:'source',auth.uid(),'reply',:'one');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content,reply_to_message_id) VALUES(%L,auth.uid(),''bad'',%L)',:'destination',:'one'),'Reply target is unavailable');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content,reply_to_message_id) VALUES(%L,auth.uid(),''bad'',%L)',:'source',:'two'),'Reply target is unavailable');
INSERT INTO public.file_uploads(id,uploader_id,bucket,path,original_filename,mime_type,size_bytes,duration_seconds) VALUES
 ('e5555555-5555-4555-8555-555555555555',auth.uid(),'chat-media',:'source'||'/e5555555-5555-4555-8555-555555555555/voice.webm','voice.webm','audio/webm',100,2.5);
UPDATE public.file_uploads SET status='completed',completed_at=now() WHERE id='e5555555-5555-4555-8555-555555555555';
INSERT INTO public.messages(chat_id,sender_id,type,file_upload_id,media_peaks) VALUES(:'source',auth.uid(),'audio','e5555555-5555-4555-8555-555555555555',array_fill(25,ARRAY[40])) RETURNING id AS voice \gset
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,type,file_upload_id,media_peaks) VALUES(%L,auth.uid(),''audio'',''e5555555-5555-4555-8555-555555555555'',ARRAY[1,2])',:'source'),'messages_voice_peaks_valid');
SELECT pg_temp.rejects(format('UPDATE public.messages SET content=''caption'' WHERE id=%L',:'voice'),'cannot be edited');
SELECT gen_random_uuid() AS forwarded \gset
SELECT public.forward_chat_message(:'voice',ARRAY[:'destination'::uuid],ARRAY[:'forwarded'::uuid]);
SELECT public.forward_chat_message(:'voice',ARRAY[:'destination'::uuid],ARRAY[:'forwarded'::uuid]);
SELECT pg_temp.assert_true((SELECT count(*)=1 AND min(file_upload_id::text)='e5555555-5555-4555-8555-555555555555' FROM public.messages WHERE id=:'forwarded'),'Forward retries share one file and one message');
SELECT pg_temp.assert_true((SELECT media_peaks=array_fill(25,ARRAY[40]) AND reply_to_message_id IS NULL AND mentions IS NULL AND forwarded_from_message_id=:'voice' FROM public.messages WHERE id=:'forwarded'),'Forward copies voice peaks and clears reply and mentions');
SELECT pg_temp.rejects(format('SELECT public.forward_chat_message(%L,ARRAY[%L::uuid,%L::uuid],ARRAY[gen_random_uuid(),gen_random_uuid()])',:'one',:'destination',:'destination'),'distinct chats');
UPDATE public.chat_members SET archived_at=now() WHERE chat_id=:'destination' AND user_id=auth.uid();
SELECT pg_temp.rejects(format('SELECT public.forward_chat_message(%L,ARRAY[%L::uuid],ARRAY[gen_random_uuid()])',:'one',:'destination'),'unarchived chat membership');
UPDATE public.chat_members SET archived_at=NULL WHERE chat_id=:'destination' AND user_id=auth.uid();
SELECT pg_temp.rejects(format('UPDATE public.messages SET is_pinned_in_chat=true WHERE id=%L',:'one'),'permission denied');
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content,forwarded_from_message_id) VALUES(%L,auth.uid(),''forged'',%L)',:'destination',:'one'),'permission denied');
RESET ROLE;
INSERT INTO storage.buckets(id,name,public) VALUES('chat-media','chat-media',false) ON CONFLICT(id) DO NOTHING;
INSERT INTO storage.objects(bucket_id,name,owner) SELECT bucket,path,uploader_id FROM public.file_uploads WHERE id='e5555555-5555-4555-8555-555555555555';
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE id=:'voice'),'Destination member cannot read original source');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.file_uploads WHERE id='e5555555-5555-4555-8555-555555555555'),'Destination member can read forwarded upload metadata');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='chat-media' AND name LIKE :'source'||'/%'),'Destination member can read shared private object');
SELECT pg_temp.rejects(format('SELECT public.set_message_pin(%L,true)',:'one'),'Message unavailable');
SELECT pg_temp.rejects(format('SELECT public.forward_chat_message(%L,ARRAY[%L::uuid],ARRAY[gen_random_uuid()])',:'one',:'destination'),'Message unavailable');
SELECT public.delete_chat_message_for_me(:'forwarded');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='chat-media' AND name LIKE :'source'||'/%'),'Hiding the only shared reference revokes object access');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.messages SET deleted_for_everyone=true,deleted_at=now() WHERE id=:'voice';
SELECT pg_temp.assert_true((SELECT deleted_for_everyone AND media_peaks IS NULL AND forwarded_from_message_id IS NULL AND file_upload_id IS NULL FROM public.get_chat_messages(:'source') WHERE id=:'voice'),'Voice tombstone redacts payload');
SELECT public.delete_chat_message_for_me(:'voice');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.get_chat_messages(:'source') WHERE id=:'voice'),'Delete-for-me works on a tombstone');
SELECT pg_temp.rejects(format('SELECT public.set_message_reaction(%L,''👍'')',:'voice'),'Message unavailable');
SELECT pg_temp.assert_true(public.own_upload_is_referenced('e5555555-5555-4555-8555-555555555555'),'Forward still protects original upload from cleanup');
RESET ROLE;
UPDATE public.messages SET created_at=now()-interval '16 minutes' WHERE id=:'one';
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('UPDATE public.messages SET content=''late edit'',edited_at=now() WHERE id=%L',:'one'),'15 minutes');
RESET ROLE;
UPDATE public.messages SET created_at=now()-interval '61 minutes' WHERE id=:'one';
SET LOCAL ROLE authenticated;
UPDATE public.messages SET deleted_for_everyone=true,deleted_at=now() WHERE id=:'one';
SELECT pg_temp.assert_true((SELECT NOT deleted_for_everyone FROM public.messages WHERE id=:'one'),'RLS refuses deletion after one hour');
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES(gen_random_uuid(),'e1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects(format('SELECT public.set_message_pin(%L,false)',:'three'),'Message unavailable');
SELECT pg_temp.rejects(format('SELECT public.set_message_reaction(%L,''👍'')',:'three'),'Message unavailable');
SELECT pg_temp.rejects(format('SELECT public.forward_chat_message(%L,ARRAY[%L::uuid],ARRAY[gen_random_uuid()])',:'three',:'destination'),'Message unavailable');
RESET ROLE;
SELECT pg_temp.assert_true(NOT has_function_privilege('anon','public.forward_chat_message(uuid,uuid[],uuid[])','execute'),'Anon cannot forward');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN ('message_reactions','message_deletions')),'Action tables published');
ROLLBACK;
