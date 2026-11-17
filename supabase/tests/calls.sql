-- Prompt #12 calls (Guardian-audit revision): RLS permissions, realtime
-- publication membership, one-active-call exclusivity (AUD-004), MFA gate
-- on the SECURITY DEFINER path (AUD-002), conditional-write races
-- (AUD-003) and security-boundary-accurate assertions (AUD-005).
-- Local integration checks only; every fixture and assertion rolls back.
-- Requires migration 20261116120000 applied. Pre-dates this revision the
-- suite made sequential unconditional writes and expected an error message
-- from an RLS-filtered UPDATE; both are corrected here.
-- NOT RUN locally (no migrated instance / Docker unavailable, RISK-003).
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

-- Fixtures: alice (caller AAL1-valid / AAL2), bob (callee), carol (outsider).
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('e1111111-1111-4111-8111-111111111111','calls-alice@example.test','{}'),
 ('e2222222-2222-4222-8222-222222222222','calls-bob@example.test','{}'),
 ('e3333333-3333-4333-8333-333333333333','calls-carol@example.test','{}');
INSERT INTO public.profiles(id,username,display_name) VALUES
 ('e1111111-1111-4111-8111-111111111111','calls_alice','Alice'),
 ('e2222222-2222-4222-8222-222222222222','calls_bob','Bob'),
 ('e3333333-3333-4333-8333-333333333333','calls_carol','Carol');

-- a111: alice+bob direct. a222: alice+carol group (calls rejected).
-- a333: bob+carol direct. a444: alice+carol direct. a333/a444 prove
-- callee-busy and initiator-busy exclusivity across chats (AUD-004).
INSERT INTO public.chats(id,type,status,direct_pair_key) VALUES
 ('a1111111-1111-4111-8111-111111111111','direct','active','e1111111-1111-4111-8111-111111111111::e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','group','active',NULL),
 ('a3333333-3333-4333-8333-333333333333','direct','active','e2222222-2222-4222-8222-222222222222::e3333333-3333-4333-8333-333333333333'),
 ('a4444444-4444-4444-8444-444444444444','direct','active','e1111111-1111-4111-8111-111111111111::e3333333-3333-4333-8333-333333333333');
INSERT INTO public.chat_members(chat_id,user_id) VALUES
 ('a1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111'),
 ('a1111111-1111-4111-8111-111111111111','e2222222-2222-4222-8222-222222222222'),
 ('a2222222-2222-4222-8222-222222222222','e1111111-1111-4111-8111-111111111111'),
 ('a2222222-2222-4222-8222-222222222222','e3333333-3333-4333-8333-333333333333'),
 ('a3333333-3333-4333-8333-333333333333','e2222222-2222-4222-8222-222222222222'),
 ('a3333333-3333-4333-8333-333333333333','e3333333-3333-4333-8333-333333333333'),
 ('a4444444-4444-4444-8444-444444444444','e1111111-1111-4111-8111-111111111111'),
 ('a4444444-4444-4444-8444-444444444444','e3333333-3333-4333-8333-333333333333');

-- ─── Notification enabler: calls must replicate to realtime subscribers ────
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='calls'),
  'calls table is in the supabase_realtime publication (incoming/outgoing events)');

-- ─── AUD-002: MFA boundary on the SECURITY DEFINER start_call ──────────────
-- AAL1 without any verified enrolled factor is legitimate (0004 policy).
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.start_call('a1111111-1111-4111-8111-111111111111','voice') IS NOT NULL,
  'AAL1 session without enrolled factors may start a call (0004 policy)');
RESET ROLE;
-- AAL1 with a verified factor must be refused. Fixture inserted as the auth
-- admin (same shape the other suites use).
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
VALUES (gen_random_uuid(),'e1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'MFA required');
RESET ROLE;
-- AAL2 with the enrolled factor passes and is the session used below.
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;

-- The caller's first (AAL1, no factor) ringing row is still open; cancel it
-- with the conditional write the client now uses (AUD-003) before going on.
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'
  RETURNING id
) SELECT count(*) AS canceled_rows FROM updated \gset
SELECT pg_temp.assert_true((:'canceled_rows'::int)=1,'Caller cancels the stale ringing row conditionally (1 row)');

SELECT pg_temp.assert_true(public.start_call('a1111111-1111-4111-8111-111111111111','voice') IS NOT NULL,
  'AAL2 session with an enrolled factor may start a call');

-- ─── AUD-004: exclusivity invariants ───────────────────────────────────────
-- One active call per chat: a second row (even by a legitimate RLS insert)
-- must hit the partial UNIQUE index.
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_dup_probe')$q$,
  'uq_calls_active');
-- One active call per initiator across chats: alice is busy in the a111
-- call, so starting one in her other direct chat a444 must fail.
SELECT pg_temp.rejects($q$SELECT public.start_call('a4444444-4444-4444-8444-444444444444','voice')$q$,'already in a call');
-- The group chat fails the direct-only rule (before the busy checks matter).
SELECT pg_temp.rejects($q$SELECT public.start_call('a2222222-2222-4222-8222-222222222222','voice')$q$,'only supported in direct chats');
RESET ROLE;
-- Callee-busy exclusivity across chats: bob is the callee of the active
-- a111 call; starting a call in his other direct chat must fail.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a3333333-3333-4333-8333-333333333333','voice')$q$,'already in a call');
RESET ROLE;

-- ─── start_call validation (SECURITY DEFINER re-checks membership) ─────────
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a1111111-1111-4111-8111-111111111111','voice')$q$,'Not a member');
SELECT pg_temp.rejects($q$SELECT public.start_call('a2222222-2222-4222-8222-222222222222','voice')$q$,'only supported in direct chats');
RESET ROLE;

-- The active ringing row from start_call (alice, a111): expect two rows in
-- this chat overall (the canceled AAL1 probe and the live one).
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
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
-- The caller's late cancel is conditional on ringing: it must change nothing.
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='ringing'
  RETURNING id
) SELECT count(*) AS late_cancel_rows FROM updated \gset
SELECT pg_temp.assert_true((:'late_cancel_rows'::int)=0,'Caller cancel after bob accept touches zero rows');
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered'),
  'Answered status survives the losing cancel');
-- Hangup with the new ended_reason column, conditionally on answered.
WITH updated AS (
  UPDATE public.calls SET status='ended', ended_reason='hangup', ended_at=now(), duration_seconds=42
  WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered'
  RETURNING id
) SELECT count(*) AS ended_rows FROM updated \gset
SELECT pg_temp.assert_true((:'ended_rows'::int)=1,'Ended reason and duration are writable by the caller');
RESET ROLE;

-- ─── AUD-003 race B: callee decline wins, caller cancel loses ──────────────
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a1111111-1111-4111-8111-111111111111','video') AS race_call \gset
RESET ROLE;
-- Stale busy write must not clobber: condition on ringing while the row is.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='declined', decline_reason='declined', ended_at=now()
  WHERE id=:'race_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS decline_rows FROM updated \gset
SELECT pg_temp.assert_true((:'decline_rows'::int)=1,'Callee decline matches the ringing precondition (1 row)');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
WITH updated AS (
  UPDATE public.calls SET status='canceled', decline_reason='canceled', ended_at=now()
  WHERE id=:'race_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS loser_rows FROM updated \gset
SELECT pg_temp.assert_true((:'loser_rows'::int)=0,'Simultaneous cancel/decline: the losing transition touches zero rows');
SELECT pg_temp.assert_true(
  (SELECT status='declined' FROM public.calls WHERE id=:'race_call'),
  'Losing cancel leaves the winner terminal status intact');
RESET ROLE;

-- ─── AUD-005: security-boundary-accurate outsider assertions ───────────────
SELECT set_config('request.jwt.claims','{"sub":"e3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
-- RLS filters the row: the UPDATE affects zero rows (no error expected).
WITH updated AS (
  UPDATE public.calls SET status='answered'
  WHERE chat_id='a1111111-1111-4111-8111-111111111111'
  RETURNING id
) SELECT count(*) AS outsider_rows FROM updated \gset
SELECT pg_temp.assert_true((:'outsider_rows'::int)=0,'Non-member UPDATE affects zero rows (RLS filters)');
-- And no data changed despite the successful statement.
SELECT pg_temp.assert_true(
  (SELECT status='declined' FROM public.calls WHERE id=:'race_call'),
  'Outsider UPDATE leaves the row unchanged');
SELECT pg_temp.assert_true(
  (SELECT count(*)=0 FROM public.calls WHERE chat_id='a1111111-1111-4111-8111-111111111111' AND status='answered'),
  'No answered row was fabricated by the outsider UPDATE');
RESET ROLE;

-- Forged initiator: bob (a member, so the membership check cannot explain a
-- failure) inserts a row naming alice as initiator. The initiator-equals-
-- caller INSERT policy must reject it.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_forged')$q$,
  'row-level security policy');
RESET ROLE;

ROLLBACK;
