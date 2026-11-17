-- ═══════════════════════════════════════════════════════════════
-- Prompt #12: Calls (Voice & Video) — schema additions, start_call RPC,
-- realtime publication and stale-call cron hardening.
--
-- Numbering note: the roadmap's locked migration number 0013 was already
-- taken by 0013_optimize_story_viewers.sql (out-of-sequence Prompt 10 work).
-- Timestamped naming after 20261114000000_community_chat_avatar.sql is used
-- instead (approved by the Product Owner on 2026-11-16).
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

CREATE INDEX IF NOT EXISTS idx_calls_chat_started
  ON public.calls(chat_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_recent
  ON public.calls(started_at DESC)
  WHERE started_at > now() - interval '90 days';

-- ───────────────────────────────────────────────────────────────
-- 3. RPC: start_call (atomic room-name generation + insert).
--    SECURITY DEFINER: the row must be created even though the
--    calls_insert policy restricts client inserts to initiator_id
--    = auth.uid(); membership and activity are re-checked here so
--    the definer bypass cannot widen access.
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
BEGIN
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

  -- One active call per chat
  IF EXISTS (
    SELECT 1 FROM public.calls
    WHERE chat_id = p_chat_id AND status IN ('ringing', 'answered')
  ) THEN
    RAISE EXCEPTION 'A call is already in progress in this chat';
  END IF;

  -- The caller must not be busy in another call (as callee or caller)
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

  v_room_name := 'call_' || gen_random_uuid()::text;

  INSERT INTO public.calls (initiator_id, chat_id, type, status, livekit_room_name)
  VALUES (auth.uid(), p_chat_id, p_type, 'ringing', v_room_name)
  RETURNING id INTO v_call_id;

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
-- 6. Stale-call cron: tighten 60s → 20s (slightly above the 15s
--    frontend timeout to tolerate network latency) and record the
--    decline_reason the UI and call log expect.
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
