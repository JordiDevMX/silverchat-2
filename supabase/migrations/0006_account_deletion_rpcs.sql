BEGIN;
CREATE OR REPLACE FUNCTION public.schedule_account_deletion() RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scheduled timestamptz;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  SELECT scheduled_deletion_at INTO v_scheduled FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_scheduled IS NULL THEN
    v_scheduled := now() + interval '30 days';
    UPDATE public.profiles SET scheduled_deletion_at = v_scheduled WHERE id = auth.uid();
  END IF;
  RETURN v_scheduled;
END;
$$;
CREATE OR REPLACE FUNCTION public.cancel_account_deletion() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_scheduled timestamptz;
BEGIN
  IF NOT public.auth_mfa_satisfied() THEN RAISE EXCEPTION 'Authentication and MFA required'; END IF;
  SELECT scheduled_deletion_at INTO v_scheduled FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  -- The full thirty-day grace period is cancellable. After the deadline, Storage
  -- and Auth deletion may already be running across services; never promise a
  -- successful cancellation while personal files are being irreversibly removed.
  IF v_scheduled <= clock_timestamp() THEN
    RAISE EXCEPTION 'The 30-day grace period has ended; account deletion is in progress';
  END IF;
  UPDATE public.profiles SET scheduled_deletion_at = NULL WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_account_deletion(), public.cancel_account_deletion()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_account_deletion(), public.cancel_account_deletion() TO authenticated;
COMMIT;
