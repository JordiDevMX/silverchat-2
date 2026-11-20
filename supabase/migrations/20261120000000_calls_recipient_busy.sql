-- Keep start_call's signature, privileges and existing caller-side checks.
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

  v_room_name := 'call_' || gen_random_uuid()::text;

  -- Both parties are locked above. Keep the first call and record the next
  -- attempt in the second chat without creating an answerable ringing row.
  IF EXISTS (
    SELECT 1
    FROM public.chat_members recipient
    JOIN public.chat_members participant ON participant.user_id = recipient.user_id
    JOIN public.calls active ON active.chat_id = participant.chat_id
    WHERE recipient.chat_id = p_chat_id
      AND recipient.user_id <> auth.uid()
      AND (active.status = 'answered' OR
        (active.status = 'ringing' AND active.started_at > now() - interval '15 seconds'))
  ) THEN
    INSERT INTO public.calls
      (initiator_id, chat_id, type, status, decline_reason, ended_at, livekit_room_name)
    VALUES
      (auth.uid(), p_chat_id, p_type, 'missed', 'busy', now(), v_room_name)
    RETURNING id INTO v_call_id;
    RETURN v_call_id;
  END IF;

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
