-- Local, rollback-only authentication permission and recovery checks.
BEGIN;
CREATE FUNCTION pg_temp.assert_true(value boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF; END $$;
INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
 ('a1111111-1111-4111-8111-111111111111','auth-test@example.test','{}'),
 ('a2222222-2222-4222-8222-222222222222','auth-other@example.test','{}');
INSERT INTO auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) VALUES
 ('b1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','totp','verified',now(),now());
INSERT INTO auth.mfa_challenges(id,factor_id,created_at,ip_address) VALUES
 ('c1111111-1111-4111-8111-111111111111','b1111111-1111-4111-8111-111111111111',now(),'192.0.2.1');
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(NOT public.auth_mfa_satisfied(),'AAL1 with verified factor must fail assurance');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.profiles),'Pending MFA must not read profiles');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.profiles_visible),'Pending MFA must not read privacy view');
DO $$ BEGIN
 BEGIN PERFORM public.create_self_chat(); RAISE EXCEPTION 'Pending MFA called definer RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO public.two_factor_backup_codes(user_id,code_hash) VALUES(auth.uid(),repeat('a',64));
  RAISE EXCEPTION 'AAL1 backup insertion unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal2"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.auth_mfa_satisfied(),'AAL2 must pass assurance');
INSERT INTO public.two_factor_backup_codes(user_id,code_hash) VALUES(auth.uid(),repeat('a',64));
SELECT pg_temp.assert_true((SELECT count(*) = 1 FROM public.two_factor_backup_codes),'Own AAL2 code visible');
DO $$ BEGIN
 BEGIN UPDATE public.two_factor_backup_codes SET used_at=now(); RAISE EXCEPTION 'Client UPDATE succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.two_factor_backup_codes; RAISE EXCEPTION 'Client DELETE succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.consume_backup_code(auth.uid(),repeat('a',64),'c1111111-1111-4111-8111-111111111111'); RAISE EXCEPTION 'Client consumption succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.two_factor_backup_codes(user_id,code_hash) VALUES('a2222222-2222-4222-8222-222222222222',repeat('b',64)); RAISE EXCEPTION 'Foreign insert succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT pg_temp.assert_true(NOT public.consume_backup_code('a2222222-2222-4222-8222-222222222222',repeat('a',64),'c1111111-1111-4111-8111-111111111111'),'Challenge must belong to user');
SELECT pg_temp.assert_true(public.consume_backup_code('a1111111-1111-4111-8111-111111111111',repeat('a',64),'c1111111-1111-4111-8111-111111111111'),'First consumption must succeed');
SELECT pg_temp.assert_true(NOT public.consume_backup_code('a1111111-1111-4111-8111-111111111111',repeat('a',64),'c1111111-1111-4111-8111-111111111111'),'Code must be single-use');
SELECT public.replace_backup_codes('a1111111-1111-4111-8111-111111111111',ARRAY(SELECT encode(sha256(n::text::bytea),'hex') FROM generate_series(1,10) n));
SELECT pg_temp.assert_true((SELECT count(*) = 10 FROM public.two_factor_backup_codes WHERE user_id='a1111111-1111-4111-8111-111111111111' AND used_at IS NULL),'Replacement must create ten unused codes');
DO $$ BEGIN
 BEGIN PERFORM public.replace_backup_codes('a1111111-1111-4111-8111-111111111111',ARRAY[repeat('a',64)]); RAISE EXCEPTION 'Invalid replacement succeeded'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid replacement succeeded' THEN RAISE; END IF; END;
END $$;
SELECT pg_temp.assert_true((SELECT count(*) = 10 FROM public.two_factor_backup_codes WHERE user_id='a1111111-1111-4111-8111-111111111111'),'Failed replacement must preserve previous set');
SELECT set_config('request.jwt.claims','{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(public.auth_mfa_satisfied(),'User without factor may use AAL1');
SELECT pg_temp.assert_true((SELECT count(*) = 0 FROM public.two_factor_backup_codes),'Other user cannot read hashes');
RESET ROLE;
SELECT '19 authentication checks passed' AS result;
ROLLBACK;
