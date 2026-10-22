-- Local integration checks only; every fixture and assertion rolls back.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.rejects(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM) = 0 THEN RAISE EXCEPTION 'Unexpected failure: %', SQLERRM; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Statement unexpectedly succeeded: %',statement;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('d1111111-1111-4111-8111-111111111111','settings-alice@example.test','{}'),
 ('d2222222-2222-4222-8222-222222222222','settings-bob@example.test','{}'),
 ('d3333333-3333-4333-8333-333333333333','settings-carol@example.test','{}');
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$UPDATE public.profiles SET username='user_abcdef12' WHERE id=auth.uid()$q$,'placeholder');
UPDATE public.profiles SET username='settings_alice' WHERE id=auth.uid();
SELECT pg_temp.assert_true((SELECT username_changed_at=now() FROM public.profiles WHERE id=auth.uid()),'First username change sets timestamp');
SELECT pg_temp.rejects($q$UPDATE public.profiles SET username='alice_again' WHERE id=auth.uid()$q$,'30 days');
SELECT pg_temp.rejects($q$UPDATE public.profiles SET username_changed_at=NULL WHERE id=auth.uid()$q$,'permission denied');
UPDATE public.profiles SET display_name='Alice updated',first_name='Alice',last_name='Rivera',bio='Bio' WHERE id=auth.uid();
SELECT pg_temp.assert_true((SELECT display_name='Alice updated' FROM public.profiles WHERE id=auth.uid()),'Other profile edits bypass username cooldown');
SELECT pg_temp.assert_true((SELECT avatar_initials='AR' FROM public.profiles_visible WHERE id=auth.uid()),'Public initials use names without exposing them');
SELECT pg_temp.rejects($q$UPDATE public.profiles SET scheduled_deletion_at=now() WHERE id=auth.uid()$q$,'permission denied');
SELECT pg_temp.assert_true(public.schedule_account_deletion()=now()+interval '30 days','Deletion is thirty days away');
SELECT pg_temp.assert_true(public.schedule_account_deletion()=now()+interval '30 days','Scheduling is idempotent');
SELECT public.cancel_account_deletion();
SELECT pg_temp.assert_true((SELECT scheduled_deletion_at IS NULL FROM public.profiles WHERE id=auth.uid()),'Cancellation clears deadline');
INSERT INTO public.devices(user_id,device_name,user_agent,device_fingerprint) VALUES
 (auth.uid(),'Browser one','same agent','fingerprint-one'),(auth.uid(),'Browser two','same agent','fingerprint-two'),
 (auth.uid(),'Private one','same agent',NULL),(auth.uid(),'Private two','same agent',NULL);
SELECT pg_temp.rejects($q$INSERT INTO public.devices(user_id,device_name,device_fingerprint) VALUES(auth.uid(),'Duplicate','fingerprint-one')$q$,'duplicate key');
SELECT public.create_direct_chat_request('d2222222-2222-4222-8222-222222222222','') AS request_chat \gset
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.messages WHERE chat_id=:'request_chat'),'Opening profile does not send an empty message');
INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(auth.uid(),'d2222222-2222-4222-8222-222222222222');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.profiles_blocked),'Own block management details available');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.profiles_visible WHERE id='d2222222-2222-4222-8222-222222222222'),'General privacy view still hides blocked profile');
RESET ROLE;
-- Test as table owner as well: trigger must not depend on MFA-gated helper results.
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content) VALUES(%L,%L,%L)',:'request_chat','d1111111-1111-4111-8111-111111111111','blocked pending message'),'blocked');
INSERT INTO public.chat_members(chat_id,user_id) VALUES(:'request_chat','d2222222-2222-4222-8222-222222222222');
UPDATE public.chats SET status='active' WHERE id=:'request_chat';
SELECT pg_temp.rejects(format('INSERT INTO public.messages(chat_id,sender_id,content) VALUES(%L,%L,%L)',:'request_chat','d2222222-2222-4222-8222-222222222222','blocked reverse message'),'blocked');
SELECT set_config('request.jwt.claims','{"sub":"d3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.profiles_blocked),'A different user cannot enumerate someone else’s block list');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"d1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
DELETE FROM public.user_blocks WHERE blocker_id=auth.uid();
INSERT INTO public.messages(chat_id,sender_id,content) VALUES(:'request_chat',auth.uid(),'unblocked');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.messages WHERE chat_id=:'request_chat'),'Messages resume after unblock');
RESET ROLE;
UPDATE public.profiles SET username_changed_at=now()-interval '31 days' WHERE id='d1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET username='alice_after_cooldown' WHERE id=auth.uid();
SELECT pg_temp.assert_true((SELECT username='alice_after_cooldown' FROM public.profiles WHERE id=auth.uid()),'Change after cooldown succeeds');
RESET ROLE;
UPDATE public.profiles SET scheduled_deletion_at=now()-interval '1 day' WHERE id='d1111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects('SELECT public.cancel_account_deletion()','grace period has ended');
RESET ROLE;
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES
 ('d4444444-4444-4444-8444-444444444444','d1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects('SELECT public.schedule_account_deletion()','MFA required');
SELECT pg_temp.rejects('SELECT public.cancel_account_deletion()','MFA required');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.profiles_blocked),'AAL1 cannot read block details with MFA enabled');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE anon;
SELECT pg_temp.rejects('SELECT public.schedule_account_deletion()','permission denied');
SELECT pg_temp.rejects('SELECT * FROM public.profiles_blocked','permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=4 FROM cron.job),'No extra housekeeping jobs introduced');
INSERT INTO public.file_uploads(uploader_id,bucket,path,original_filename,mime_type,size_bytes,status,created_at)
VALUES('d3333333-3333-4333-8333-333333333333','avatars','d3333333-3333-4333-8333-333333333333/avatar.webp','avatar.webp','image/webp',100,'completed',now()-interval '8 days');
DO $$ DECLARE job_sql text; BEGIN SELECT command INTO job_sql FROM cron.job WHERE jobname='cleanup_orphan_uploads'; EXECUTE job_sql; END $$;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.file_uploads WHERE bucket='avatars' AND uploader_id='d3333333-3333-4333-8333-333333333333'),'Housekeeping retains avatar accounting metadata');
SELECT 'Profile/settings integration checks passed' AS result;
ROLLBACK;
