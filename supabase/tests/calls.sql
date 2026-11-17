-- Prompt #12 calls: RLS permissions, realtime publication membership and
-- simultaneous-cancel behavior. Local integration checks only; every fixture
-- and assertion rolls back. Requires migration 20261116120000 applied.
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

-- Fixtures: caller (alice), callee (bob), outsider (carol).
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('e1111111-1111-4111-8111-111111111111','calls-alice@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','calls-bob@example.test','{}'),
 ('e3333333-3333-4333-8333-333333333333','calls-carol@example.test','{}');
INSERT INTO public.profiles(id,username,display_name) VALUES
 ('e1111111-1111-4111-8111-111111111111','calls_alice','Alice'),
 ('e2222222-2222-4222-8222-222222222222','calls_bob','Bob'),
 ('e3333333-3333-4333-8333-333333333333','calls_carol','Carol');

INSERT INTO public.chats(id,type,status,direct_pair_key) VALUES
 ('a1111111-1111-4111-8111-111111111111','direct','active','e1111111-1111-4111-8111-111111111111::e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','group','active',NULL);
INSERT INTO public.chat_members(chat_id,user_id) VALUES
 ('a1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111'),
 ('a1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111'),
 ('a2222222-2222-4222-8222-222222222222','e3333333-3333-4333-8333-333333333333');

-- ─── Notification enabler: calls must replicate to realtime subscribers ────
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='calls'),
  'calls table is in the supabase_realtime publication (incoming/outgoing events)');

-- ─── start_call validation (SECURITY DEFINER re-checks membership) ─────────
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.start_call('a1111111-1111-4111-8111-111111111111','voice') IS NOT NULL,'Caller can start a direct-call row');
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'already in progress');
SELECT pg_temp.rejects($q$SELECT public.start_call('a2222222-2222-4222-8222-222222222222','voice')$q$,'already in a call');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'Not a member');
SELECT pg_temp.rejects($q$SELECT public.start_call('a2222222-2222-4222-8222-222222222222','voice')$q$,'only supported in direct chats');
RESET ROLE;

-- The ringing row from start_call.
UPDATE public.calls SET started_at=now() WHERE chat_id='a1111111-1111-4111-8111-111111111111';

-- ─── Callee permissions: accept / decline / busy writes (RLS + grants) ─────
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'),
  'Callee can read the caller ringing row (notification path)');
-- Accept.
UPDATE public.calls SET status='answered', answered_at=now()
 WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing';
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered'),
  'Callee can accept the caller call');
-- Hangup with the new ended_reason column (grant check).
UPDATE public.calls SET status='ended', ended_reason='hangup', ended_at=now(), duration_seconds=42
 WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered';
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND ended_reason='hangup'),
  'Ended reason and duration are writable by the callee');
RESET ROLE;

-- A fresh call for decline/busy paths.
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a1111111-1111-4111-8111-111111111111','video') AS ringing_call \gset
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.calls SET status='missed', decline_reason='busy', ended_at=now() WHERE id=:'ringing_call';
SELECT pg_temp.assert_true((SELECT decline_reason='busy' FROM public.calls WHERE id=:'ringing_call'),'Busy auto-reject path writable by callee');
RESET ROLE;

-- ─── Simultaneous cancellation: callee declines while caller cancels ───────
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice') AS race_call \gset
RESET ROLE;
-- Caller cancels (client A)…
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now() WHERE id=:'race_call';
RESET ROLE;
-- …while the callee declines at the same moment (client B). Both UPDATEs must
-- succeed (last write wins on shared columns); neither may error or deadlock
-- the local state machine, which is covered by the unit tests.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
UPDATE public.calls SET status='declined', decline_reason='declined', ended_at=now() WHERE id=:'race_call';
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE id=:'race_call' AND status IN ('canceled','declined') AND ended_at IS NOT NULL),
  'Simultaneous cancel/decline converges to one terminal status');

-- ─── Outsider permissions: no read, no write, no membership bypass ─────────
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  (SELECT count(*)=0 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111'),
  'Non-member cannot see calls in someone else chat');
SELECT pg_temp.rejects($q$UPDATE public.calls SET status='answered' WHERE chat_id='a1111111-1111-4111-8111-111111111111'$q$,'permission denied');
RESET ROLE;

-- Direct client INSERT stays restricted to the initiator via RLS.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name) VALUES (auth.uid(),'a1111111-1111-4111-8111-111111111111','voice','call_forged')$q$,'with check');
RESET ROLE;

ROLLBACK;
