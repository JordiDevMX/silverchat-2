-- Prompt #12 calls (Guardian round-3 revision): RLS permissions, realtime
-- publication membership, one-active-call exclusivity (AUD-004), MFA gate on
-- the SECURITY DEFINER path (AUD-002), conditional-write races in both
-- orders (AUD-003) and security-boundary-accurate assertions (AUD-005).
--
-- Round-3 corrections per Guardian:
-- - direct client INSERTs are asserted against the REAL privilege boundary:
--   0002:704-705 grants authenticated INSERT(id,initiator_id,chat_id,type,
--   livekit_room_name) on calls (the round-2 suite wrongly assumed no INSERT
--   grant exists — that grant statement is split across lines and was
--   missed). The one-active-call invariant is therefore exercised through
--   the unique indexes (a same-chat duplicate INSERT fails with
--   uq_calls_active_chat; a cross-chat second call fails with
--   uq_calls_active_initiator), and a forged initiator — inserted by a
--   DISTINCT member under someone else's identity — fails on the RLS
--   WITH CHECK (initiator_id = auth.uid()).
-- - the outsider block no longer demands both "0 visible rows" and
--   "permission denied" for the same UPDATE: RLS genuinely filters for a
--   non-member, so only the filtered-state pattern applies.
-- - per roadmap L12 (round-3 decision), start_call has NO recipient-busy
--   pre-check: a second call toward a busy callee is inserted and rings,
--   then the busy callee's client silently rejects it as a missed/busy
--   write (persisted call-log entry); with the callee offline the stale-ring
--   cron records it missed. The suite exercises that full path.
--
-- Round-2 corrections retained: profiles come from the on_auth_user_created
-- trigger only; outsider state is verified via filtered row counts and then
-- re-checked under a member identity; cancel-then-accept race order.
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
-- a666: erin+bob direct (busy-path L12 flow: the second call rings and the
--        busy callee's client records it missed/busy).
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

-- ─── AUD-004/005: client INSERT boundary — real grants, real invariants ────
-- 0002:704-705 grants authenticated INSERT(id,initiator_id,chat_id,type,
-- livekit_room_name) on calls; RLS lets a chat member insert with
-- initiator_id = auth.uid(). The one-active-call rule is therefore enforced
-- by the partial unique indexes on every permitted write path.
-- (a) A same-chat duplicate while the a111 call is ringing → uq_calls_active_chat.
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_dup_probe')$q$,
  'uq_calls_active_chat');
-- (b) A second ringing call by the same caller in her OTHER chat →
--     uq_calls_active_initiator (the chat index cannot fire: a444 is idle).
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a4444444-4444-4444-8444-444444444444','voice','call_cross_probe')$q$,
  'uq_calls_active_initiator');
-- (c) Forged initiator with a DISTINCT actor: chat member Bob inserts a row
--     claiming Alice as initiator → RLS WITH CHECK initiator_id = auth.uid().
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SELECT pg_temp.rejects($q$INSERT INTO public.calls(initiator_id,chat_id,type,livekit_room_name)
  VALUES ('e1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','voice','call_forged_by_bob')$q$,
  'row-level security policy');
RESET ROLE;

-- ─── AUD-004: caller-busy across chats ──────────────────────────────────────
-- Alice (back in her own AAL2 session) is the initiator of the active a111
-- call: starting one in her other direct chat must fail on the caller check.
SELECT set_config('request.jwt.claims','{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a4444444-4444-4444-8444-444444444444','voice')$q$,'already in a call');
RESET ROLE;
-- Bob is the callee of the active a111 call: starting one in his other
-- direct chat must fail on the busy check too.
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.rejects($q$SELECT public.start_call('a3333333-3333-4333-8333-333333333333','voice')$q$,'already in a call');
RESET ROLE;
-- ─── AUD-004 round 3: busy path per roadmap L12 (no recipient pre-check) ───
-- Erin calls busy Bob: the call is INSERTED and rings (start_call has no
-- recipient-busy pre-check). Bob's client then silently rejects it — the
-- conditional missed/busy write IS the persisted call-log entry (L12), and
-- the original a111 call stays untouched.
SELECT set_config('request.jwt.claims','{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT public.start_call('a6666666-6666-4666-8666-666666666666','voice') AS busy_call \gset
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"e2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  EXISTS (SELECT 1 FROM public.calls WHERE id=:'busy_call' AND status='ringing'),
  'A second call toward a busy callee rings (no recipient pre-check, L12)');
WITH updated AS (
  UPDATE public.calls SET status='missed', decline_reason='busy', ended_at=now()
  WHERE id=:'busy_call' AND status='ringing'
  RETURNING id
) SELECT count(*) AS busy_reject_rows FROM updated \gset
SELECT pg_temp.assert_true((:'busy_reject_rows'::int)=1,
  'Busy callee client writes exactly one missed/busy entry (L12 log path)');
SELECT pg_temp.assert_true(
  (SELECT decline_reason='busy' FROM public.calls WHERE id=:'busy_call'),
  'The busy entry is persisted with decline_reason=busy');
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
