-- ═══════════════════════════════════════════════════════════════
-- Prompt #12: Calls (Voice & Video) — schema additions, start_call RPC,
-- realtime publication and stale-call cron hardening.
--
-- Numbering note: the roadmap's locked migration number 0013 was already
-- taken by 0013_optimize_story_viewers.sql (out-of-sequence Prompt 10 work).
-- Timestamped naming after 20261114000000_community_chat_avatar.sql is used
-- instead (approved by the Product Owner on 2026-11-16).
--
-- Guardian-audit revisions (2026-11-16, AUD-001..AUD-007):
-- - AUD-001: the previous partial index with a now() predicate is removed
--   (PostgreSQL requires immutable index predicates). No log-scan index is
--   added: 0001's idx_calls_chat / idx_calls_initiator / idx_calls_ringing
--   already cover every access path this feature uses.
-- - AUD-002: start_call re-checks public.auth_mfa_satisfied() explicitly;
--   SECURITY DEFINER bypasses table RLS, where the 0004
--   mfa_assurance_required restrictive policy already enforces MFA.
-- - AUD-004: one-active-call exclusivity is now enforced by two partial
--   UNIQUE indexes (per chat, per initiator) as a hard invariant, and
--   start_call serializes concurrent starts with per-member transaction
--   advisory locks (ordered by user_id to avoid deadlocks).
-- - Round 4 (AUD-004 residual): direct client INSERTs are REVOKED. The
--   0002 column-list INSERT grant let a chat member create call rows
--   bypassing start_call's invariants — most notably the caller-busy
--   check (a user RECEIVING an active call could originate another in a
--   different chat: neither unique index conflicts) and the direct/self
--   chat-type restriction. The application never inserts directly (all
--   creation goes through the RPC), so start_call is now the single
--   supported creation path and the indexes remain the hard backstop.
-- - AUD-007 (round 3): the callee is resolved from typed chat_members rows
--   instead of string_to_array on direct_pair_key, whose text elements made
--   uuid comparisons unresolvable (text <> uuid has no operator: start_call
--   would have failed at runtime for every direct call).
-- - Per roadmap L12 (round-3 decision): there is NO recipient-busy check
--   here. A second call toward a busy callee is inserted normally, rings,
--   and is rejected BY THE CALLEE'S CLIENT as a silent missed/busy write;
--   if the callee is offline the stale-ring cron records it missed. This
--   keeps a persisted call-log entry on the busy path, matching L12.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Status enum: the original 0001 enum predates Prompt #12 and
--    has no terminal "connected call finished" value. The roadmap
--    locks ringing → answered → ended / missed / declined / canceled.
-- ───────────────────────────────────────────────────────────────
ALTER TYPE public.call_status ADD VALUE IF NOT EXISTS 'ended';

-- ───────────────────────────────────────────────────────────────
-- 2. Schema additions
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS decline_reason text NULL;
COMMENT ON COLUMN public.calls.decline_reason IS
  'Why the call never connected: declined | missed | canceled | network_lost | busy';

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS ended_reason text NULL;
COMMENT ON COLUMN public.calls.ended_reason IS
  'Why a connected call finished: hangup | peer_hangup | network_lost | timeout';

-- ───────────────────────────────────────────────────────────────
-- 2b. One-active-call exclusivity (AUD-004). Partial UNIQUE indexes are
--     the hard invariant behind every creation path: at most one
--     ringing/answered call per chat, and at most one per initiator
--     across all chats. (Round 4 note: direct client INSERTs are revoked
--     in 2c, so the RPC is the only writer — the indexes still backstop
--     it and any future privileged writer.)
-- ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_calls_active_chat
  ON public.calls(chat_id)
  WHERE status IN ('ringing', 'answered');

CREATE UNIQUE INDEX IF NOT EXISTS uq_calls_active_initiator
  ON public.calls(initiator_id)
  WHERE status IN ('ringing', 'answered');

-- ───────────────────────────────────────────────────────────────
-- 2c. Creation-path lock-down (AUD-004, round 4). 0002's column-list
--     INSERT grant on calls lets any chat member create call rows
--     directly, bypassing start_call's invariant checks: the caller-busy
--     rule (a user RECEIVING an active call can originate another in a
--     different chat — neither the per-chat nor the per-initiator unique
--     index conflicts) and the direct/self chat-type restriction. The
--     application never inserts into calls directly (every creation
--     goes through the RPC), so the direct path is revoked and start_call
--     becomes the single supported creation path; the partial UNIQUE
--     indexes above remain the hard backstop behind the RPC.
--     Lifecycle UPDATE privileges are re-stated in section 5 below
--     (decline_reason / ended_reason postdate 0002's column list).
-- ───────────────────────────────────────────────────────────────
REVOKE INSERT ON public.calls FROM authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3. RPC: start_call (atomic room-name generation + insert).
--    SECURITY DEFINER: the row must be created even though the
--    calls_insert policy restricts client inserts to initiator_id
--    = auth.uid(); membership, activity, MFA and call-uniqueness are
--    re-checked here so the definer bypass cannot widen access.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_call(
  p_chat_id uuid,
  p_type call_type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id uuid;
  v_room_name text;
  v_member record;
BEGIN
  -- MFA gate (AUD-002): the 0004 restrictive table policy enforces MFA on
  -- the RLS path; a SECURITY DEFINER function skips RLS, so the same
  -- public.auth_mfa_satisfied() rule (AAL2, or no verified factor enrolled)
  -- is re-checked here. Same error contract as the 0004 RPC guards.
  IF NOT public.auth_mfa_satisfied() THEN
    RAISE EXCEPTION 'MFA required' USING ERRCODE = '42501';
  END IF;

  -- Must be a chat member
  IF NOT is_chat_member(p_chat_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this chat';
  END IF;

  -- Chat must be active (per 04b-1 policy on calls)
  IF NOT is_chat_active(p_chat_id) THEN
    RAISE EXCEPTION 'Cannot call in a pending or rejected chat';
  END IF;

  -- Direct or self chats only (group / community calls are Fase 2)
  IF NOT EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = p_chat_id AND type IN ('direct', 'self')
  ) THEN
    RAISE EXCEPTION 'Calls are only supported in direct chats';
  END IF;

  -- Serialize concurrent starts (AUD-004): any two in-flight start_call
  -- transactions that share a chat member take the same advisory lock, so
  -- the busy checks below and the INSERT behave atomically against each
  -- other. Locks are taken in user_id order to keep two overlapping chat
  -- member lists deadlock-free. The partial UNIQUE indexes above remain the
  -- hard backstop (they outlive this transaction and also guard non-RPC
  -- writers).
  FOR v_member IN
    SELECT user_id FROM public.chat_members
    WHERE chat_id = p_chat_id
    ORDER BY user_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_member.user_id::text, 0));
  END LOOP;

  -- One active call per chat (lock-protected; unique index backstops it)
  IF EXISTS (
    SELECT 1 FROM public.calls
    WHERE chat_id = p_chat_id AND status IN ('ringing', 'answered')
  ) THEN
    RAISE EXCEPTION 'A call is already in progress in this chat';
  END IF;

  -- A participant must not be busy in another call (as callee or caller)
  IF EXISTS (
    SELECT 1 FROM public.calls c
    JOIN public.chat_members cm ON cm.chat_id = c.chat_id
    WHERE cm.user_id = auth.uid()
      AND c.status IN ('ringing', 'answered')
      AND c.initiator_id IS DISTINCT FROM auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.calls
    WHERE initiator_id = auth.uid() AND status IN ('ringing', 'answered')
  ) THEN
    RAISE EXCEPTION 'You are already in a call';
  END IF;

  -- AUD-004 round 3 / roadmap L12: there is deliberately NO recipient-busy
  -- pre-check here. A second call toward a busy callee is inserted normally,
  -- rings, and is rejected BY THE CALLEE'S CLIENT as a silent missed/busy
  -- write (busyRejectCall) — that write IS the persisted call-log entry L12
  -- requires; with the callee offline, the stale-ring cron records it
  -- missed. (The caller-side check above still covers the caller's own
  -- state across chats. AUD-007 round 3 note: an earlier round-2 attempt
  -- resolved the callee via string_to_array(direct_pair_key,'::'), whose
  -- text elements made uuid comparisons unresolvable; that failed approach
  -- and its check are both gone.)

  v_room_name := 'call_' || gen_random_uuid()::text;

  BEGIN
    INSERT INTO public.calls (initiator_id, chat_id, type, status, livekit_room_name)
    VALUES (auth.uid(), p_chat_id, p_type, 'ringing', v_room_name)
    RETURNING id INTO v_call_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- AUD-004 backstop: a concurrent committed start won the race despite
      -- the locks (e.g. a non-RPC writer). Same user-facing contract as the
      -- pre-checks; the client maps both messages to its busy note.
      RAISE EXCEPTION 'A call is already in progress in this chat';
  END;

  RETURN v_call_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_call(uuid, call_type) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_call(uuid, call_type) TO authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4. Realtime: replicate calls so incoming/outgoing clients see
--    INSERT/UPDATE events. postgres_changes re-checks RLS per
--    subscriber, so only chat members receive the events.
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
  END IF;
END
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. Column grants: 0002 granted UPDATE on four columns only.
--    decline_reason / ended_reason (and the new enum value) must be
--    writable by the callee (accept / decline / busy) and the caller
--    (cancel / hangup). Column-level grants are additive.
-- ───────────────────────────────────────────────────────────────
GRANT UPDATE(status, answered_at, ended_at, duration_seconds, decline_reason, ended_reason)
  ON public.calls TO authenticated;

-- ───────────────────────────────────────────────────────────────
-- 6. Stale-call cron: the 20 seconds is an age threshold, not a latency
--    guarantee (Guardian's timing note). The job runs once per minute and
--    flips ringing rows older than 20 seconds to missed, so worst-case
--    cleanup latency after the ring started is ~80s. The frontend gives
--    up ringing locally at 15s (RING_TIMEOUT_MS) and never relies on the
--    cron for UI state.
-- ───────────────────────────────────────────────────────────────
SELECT cron.unschedule('cleanup_stale_calls');

SELECT cron.schedule(
  'cleanup_stale_calls',
  '* * * * *',
  $$
    UPDATE public.calls
    SET
      status = 'missed',
      ended_at = now(),
      decline_reason = 'missed'
    WHERE status = 'ringing'
      AND started_at < now() - interval '20 seconds';
  $$
);
