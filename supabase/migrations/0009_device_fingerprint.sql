-- Apply this file manually via the Supabase SQL Editor for remote.
-- Migration 0005 was never applied to the remote database, so devices has no
-- device_fingerprint column. This migration is idempotent and adds only the
-- device fingerprint support required by the auth/presence flows.
BEGIN;

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS device_fingerprint text NULL;

ALTER TABLE public.devices
  DROP CONSTRAINT IF EXISTS devices_user_agent_unique;

ALTER TABLE public.devices
  DROP CONSTRAINT IF EXISTS devices_user_fingerprint_unique;

ALTER TABLE public.devices
  ADD CONSTRAINT devices_user_fingerprint_unique UNIQUE (user_id, device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_devices_fingerprint
  ON public.devices(user_id, device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

GRANT INSERT(device_fingerprint), UPDATE(device_fingerprint) ON public.devices TO authenticated;

COMMIT;
