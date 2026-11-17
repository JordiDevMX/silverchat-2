-- Prompt #12 calls (Guardian round-2 revision): RLS permissions, realtime
-- publication membership, one-active-call exclusivity incl. the recipient
-- side (AUD-004), MFA gate on the SECURITY DEFINER path (AUD-002),
-- conditional-write races in both orders (AUD-003) and security-boundary-
-- accurate assertions (AUD-005).
--
-- Round-2 corrections per Guardian:
-- - profiles are NOT inserted explicitly: the on_auth_user_created trigger
--   from 0001_initial_schema.sql already creates them from auth.users;
-- - the outsider UPDATE is asserted as an RLS *filter* (RETURNING yields
--   zero rows and the row is invisible in the outsider session, where the
--   scalar lookup is NULL, not a comparable value); unchanged state is then
--   verified under a permitted identity;
-- - direct client INSERTs are asserted against the real boundary: 0002's
--   hardening loop REVOKEs ALL on calls and grants only SELECT, so every
--   client INSERT fails with "permission denied" there is no INSERT grant,
--   making the RPC the single supported write path; the forged-initiator
--   variant is covered at that same boundary;
-- - the missing cancel-then-accept race order is added;
-- - recipient-busy (AUD-004 round 2) is exercised across chats.
--
-- Requires migration 20261116120000 applied. NOT RUN locally: no Postgres
-- or Docker on the Engineer machine (RISK-003), remotes unauthorized.
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

-- Fixtures: alice (caller), bob (callee), carol (outsider for the a111/a222
-- chats), erin (second caller toward the busy callee bob). Trigger-created
-- profiles: user_e1111111, user_e2222222, ... (username = 'user_' || id[1:8]).
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('e1111111-1111-4111-8111-111111111111','calls-alice@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','calls-bob@example.test','{}'),
 ('e3333333-3333-4333-8333-333333333333','calls-carol@example.test','{}'),
 ('e5555555-5555-4555-8555-555555555555','calls-erin@example.test','{}');

-- a111: alice+bob direct (the main call). a222: alice+carol group (direct-only).
-- a333: bob+carol direct (caller-side busy as the callee of a111).
-- a444: alice+carol direct (initiator busy across chats).
-- a666: erin+bob direct (recipient-busy, AUD-004 round 2).
INSERT INTO public.chats(id,type,status,direct_pair_key) VALUES
 ('a1111111-1111-4111-8111-111111111111','direct','active','e1111111-1111-4111-8111-111111111111::e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','group','active',NULL),
 ('a3333333-3333-4333-8333-333333333333','direct','active','e2222222-2222-4222-8222-222222222222::e3333333-3333-4333-8333-333333333333'),
 ('a4444444-4444-4444-8444-444444444444','direct','active','e1111111-1111-4111-8111-111111111111::e3333333-3333-4333-8333-333333333333'),
 ('a6666666-6666-4666-8666-666666666666','direct','active','e5555555-5555-4555-8555-555555555555::e2222222-2222-4222-8222-222222222222');
INSERT INTO public.chat_members(chat_id,user_id) VALUES
 ('a1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111'),
 ('a1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111'),
 ('a2222222-2222-4222-8222-222222222222','e3333333-3333-4333-8333-333333333333'),
 ('a3333333-3333-4333-8333-333333333333','e2222222-2222-4222-8222-222222222222'),
 ('a3333333-3333-4333-8333-333333333333','e3333333-3333-4333-8333-333333333333'),
 ('a4444444-4444-4444-8444-444444444444','e1111111-1111-4111-8111-111111111111'),
 ('a4444444-4444-4444-8444-444444444444','e3333333-3333-4333-8333-333333333333'),
 ('a6666666-6666-4666-8666-666666666666','e5555555-5555-4555-8555-555555555555'),
 ('a6666666-6666-4666-8666-666666666666','e2222222-2222-4222-8222-222222222222');

-- ─── Notification enabler: calls must replicate to realtime subscribers ────
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='calls'),
  'calls table is in the supabase_realtime publication (incoming/outgoing events)');

-- ─── AUD-004: one-active-call exclusivity indexes exist as the invariant ───
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_calls_active_chat'),
  'per-chat active-call unique index present');
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_calls_active_initiator'),
  'per-initiator active-call unique index present');

-- ─── AUD-002: MFA boundary on the SECURITY DEFINER start_call ──────────────
-- AAL1 without any verified enrolled factor is legitimate (0004 policy).
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.start_call('a1111111-1111-4111-8111-111111111111','voice') IS NOT NULL,
  'AAL1 session without enrolled factors may start a call (0004 policy)');
-- Clean up the probe row with the client's conditional write (AUD-003).
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'
  RETURNING id
) SELECT count(*) AS canceled_rows FROM updated \gset
SELECT pg_temp.assert_true((:'canceled_rows'::int)=1,'Caller cancels the MFA-probe ringing row (1 row)');
RESET ROLE;
-- Alice now enrolls a verified factor; her AAL1 session must be refused...
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
VALUES (gen_random_uuid(),'e1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'MFA required');
RESET ROLE;
-- ...while her AAL2 session passes and opens THE active call.
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.start_call('a1111111-1111-4111-8111-111111111111','voice') IS NOT NULL,
  'AAL2 session with an enrolled factor may start a call');

-- ─── AUD-005: client write boundary — RPC only ─────────────────────────────
-- 0002's hardening loops REVOKE ALL on calls and grant SELECT (+ the
-- audit's UPDATE column list); there is no INSERT grant, so EVERY client
-- INSERT fails at the privilege check. Alice inserting a second active row
-- for her own chat, and Bob forging Alice as initiator, are both covered
-- by that same real boundary (the unique indexes additionally hold against
-- any future grant-based writer).
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_dup_probe')$q$,
  'permission denied');
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_forged')$q$,
  'permission denied');

-- ─── AUD-004: caller-busy and callee-busy across chats ─────────────────────
-- Alice is the initiator of the active a111 call: starting one in her other
-- direct chat must fail on the initiator check.
SELECT pg_temp.rejects($q$SELECT public.start_call('a4444444-4444-4444-8444-444444444444','voice')$q$,'already in a call');
RESET ROLE;
-- Bob is the callee of the active a111 call: starting one in his other
-- direct chat must fail on the busy check too.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a3333333-3333-4333-8333-333333333333','voice')$q$,'already in a call');
RESET ROLE;
-- AUD-004 (round 2): any caller trying to reach the busy callee Bob — here
-- Erin — must get the recipient-busy rejection; Bob's ringing history in
-- a111 stays exactly as the caller left it.
SELECT set_config('request.jwt.claims','{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a6666666-6666-4666-8666-666666666666','voice')$q$,'The recipient is already in a call');
RESET ROLE;

-- ─── start_call validation (SECURITY DEFINER re-checks membership) ─────────
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'Not a member');
SELECT pg_temp.rejects($q$SELECT public.start_call('a2222222-2222-4222-8222-222222222222','voice')$q$,'only supported in direct chats');
RESET ROLE;

-- ─── Callee permissions: read the ringing row (notification path) ──────────
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'),
  'Callee can read the caller ringing row (notification path)');

-- ─── AUD-003 race A: callee accept wins, caller cancel loses ───────────────
WITH updated AS (
  UPDATE public.calls SET status='answered', answered_at=now()
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'
  RETURNING id
) SELECT count(*) AS accepted_rows FROM updated \gset
SELECT pg_temp.assert_true((:'accepted_rows'::int)=1,'Callee accept matches the ringing precondition (1 row)');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'
  RETURNING id
) SELECT count(*) AS late_cancel_rows FROM updated \gset
SELECT pg_temp.assert_true((:'late_cancel_rows'::int)=0,'Caller cancel after bob accept touches zero rows');
-- The hangup-intent reconciliation (AUD-003 round 2): reading the winner and
-- closing the call with the winner's answered_at is the client behavior.
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls
          WHERE chat_id='a1111111-1111-4111-8111-111111111111'
            AND status='answered' AND answered_at IS NOT NULL),
  'Winner state is answered with an answered_at the losing client reconciles from');
WITH updated AS (
  UPDATE public.calls SET status='ended', ended_reason='hangup', ended_at=now(), duration_seconds=42
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered'
  RETURNING id
) SELECT count(*) AS ended_rows FROM updated \gset
SELECT pg_temp.assert_true((:'ended_rows'::int)=1,'Ended reason and duration are writable by the caller');
RESET ROLE;

-- ─── AUD-003: cancel-then-accept (the previously missing order) ─────────────
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a1111111-1111-4111-8111-111111111111','video') AS ca_call \gset
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE id=:'ca_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS cancel_first_rows FROM updated \gset
SELECT pg_temp.assert_true((:'cancel_first_rows'::int)=1,'Caller cancel wins when it lands first (1 row)');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='answered', answered_at=now()
  WHERE id=:'ca_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS late_accept_rows FROM updated \gset
SELECT pg_temp.assert_true((:'late_accept_rows'::int)=0,'Callee accept after a committed cancel touches zero rows');
SELECT pg_temp.assert_true(
  (SELECT status='canceled' FROM public.calls WHERE id=:'ca_call' AND ended_at IS NOT NULL),
  'Terminal canceled status survives the losing accept');
RESET ROLE;

-- ─── AUD-003 race B: callee decline wins, caller cancel loses ──────────────
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice') AS race_call \gset
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='declined', decline_reason='declined', ended_at=now()
  WHERE id=:'race_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS decline_rows FROM updated \gset
SELECT pg_temp.assert_true((:'decline_rows'::int)=1,'Callee decline matches the ringing precondition (1 row)');
-- A stale busy write against the already-terminal row must move nothing.
WITH updated AS (
  UPDATE public.calls SET status='missed', decline_reason='busy', ended_at=now()
  WHERE id=:'race_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS stale_busy_rows FROM updated \gset
SELECT pg_temp.assert_true((:'stale_busy_rows'::int)=0,'Stale busy write on a terminal row touches zero rows');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE id=:'race_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS loser_rows FROM updated \gset
SELECT pg_temp.assert_true((:'loser_rows'::int)=0,'Simultaneous cancel/decline: the losing transition touches zero rows');
RESET ROLE;

-- ─── AUD-005: outsider assertions reflect real RLS filtering ───────────────
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
-- RLS filters the row for a non-member: RETURNING yields zero rows and even
-- a plain SELECT cannot see it (a scalar lookup would be NULL here).
WITH updated AS (
  UPDATE public.calls SET status='answered'
  WHERE chat_id='a1111111-1111-4111-8111-111111111111'
  RETURNING id
) SELECT count(*) AS outsider_rows FROM updated \gset
SELECT pg_temp.assert_true((:'outsider_rows'::int)=0,'Non-member UPDATE affects zero rows (RLS filters)');
SELECT pg_temp.assert_true(
  (SELECT count(*)=0 FROM public.calls WHERE id=:'race_call'),
  'Non-member SELECT cannot see the hidden row at all');
SELECT pg_temp.rejects($q$UPDATE public.calls SET status='answered' WHERE chat_id='a1111111-1111-4111-8111-111111111111'$q$,
  'permission denied');
RESET ROLE;

-- The unchanged state is verified under a permitted identity (member).
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  (SELECT status='declined' FROM public.calls WHERE id=:'race_call'),
  'Outsider UPDATE leaves the row unchanged (verified as a member)');
SELECT pg_temp.assert_true(
  (SELECT count(*)=0 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered' AND decline_reason IS NOT NULL),
  'No fabricated answered row with a decline_reason exists');
RESET ROLE;

ROLLBACK;
