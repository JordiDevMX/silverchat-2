-- ═══════════════════════════════════════════════════════════════
-- Prompt #12: incoming-call verdict on server time.
--
-- Before this migration the callee client decided whether an incoming call
-- was still answerable by comparing calls.started_at with its own wall clock.
-- A PC clock ahead of the server therefore dropped live calls as "stale"
-- (the call never rang), and a PC clock behind would ring a call that had
-- already expired. The realtime INSERT is only a hint: this function is the
-- single source of truth for "can this call still be answered?", computed
-- from the row status and the server's now().
--
-- SECURITY INVOKER (not DEFINER): the calls RLS policies keep applying
-- (chat membership + active chat), so the function cannot widen visibility.
-- Self-calls are excluded here to mirror the client rule that my own call
-- never rings me. Callers pass p_call_id for the realtime hint, or omit it
-- to recover every answerable call after a reconnect.
--
-- The 15 seconds window is the locked L1 ring window; keep it in sync with
-- RING_TIMEOUT_MS in src/features/calls/types.ts.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.answerable_incoming_calls(
  p_call_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  chat_id uuid,
  initiator_id uuid,
  type public.call_type,
  started_at timestamptz,
  livekit_room_name text,
  expires_in_ms integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.chat_id,
    c.initiator_id,
    c.type,
    c.started_at,
    c.livekit_room_name,
    GREATEST(
      0,
      CEIL(EXTRACT(EPOCH FROM (c.started_at + interval '15 seconds' - now())) * 1000)
    )::integer AS expires_in_ms
  FROM public.calls c
  WHERE (p_call_id IS NULL OR c.id = p_call_id)
    AND c.status = 'ringing'
    AND c.started_at > now() - interval '15 seconds'
    AND c.initiator_id IS DISTINCT FROM auth.uid()
  ORDER BY c.started_at DESC;
$$;

COMMENT ON FUNCTION public.answerable_incoming_calls(uuid) IS
  'Answerable incoming calls for the caller with the remaining ring window measured on the server clock; realtime INSERTs are only hints.';

REVOKE ALL ON FUNCTION public.answerable_incoming_calls(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answerable_incoming_calls(uuid) TO authenticated;
