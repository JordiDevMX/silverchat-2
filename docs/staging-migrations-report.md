# Staging migrations run report — 2026-10-23

Outcome: migrations **0001–0004 applied successfully** to staging
(`gffdrrtatxdiucigtwdn`); **0005 stopped at its own self-check**; 0006–0007 not
applied. Root cause identified with evidence. No migration file in this
repository was modified.

## What ran

Applied via the Supabase Management API
`POST /v1/projects/{ref}/database/migrations` (`{query, name}` bodies), strictly
sequential, read-only verification through `POST /database/query` with
`read_only: true`. No CLI, no SQL Editor.

| Migration | Result | Version recorded on staging | Name sent |
| --- | --- | --- | --- |
| 0001_initial_schema | applied | `20261023174155` | `0001_initial_schema` |
| 0002_rls_policies | applied | `20261023174156` | `0002_rls_policies` |
| 0003_business_logic | applied | `20261023174321` | `0003_business_logic` |
| 0004_auth_backup_codes | applied | `20261023174323` | `0004_auth_backup_codes` |
| 0005_profile_settings | **failed, rolled back** | — | — |
| 0006_account_deletion_rpcs | not attempted | — | — |
| 0007_chat_delete_adjustments | attempted once against staging missing 0003–0006 (operator error, see warnings); rolled back | — | — |

## Staging state at stop (all read-only checks)

- Migration history rows: exactly 0001–0004 (names as above).
- Public base tables: **22** (21 from 0001 + `two_factor_backup_codes`).
- 0004 present: `two_factor_backup_codes`, `auth_mfa_satisfied()`, and 22
  `mfa_assurance_required` restrictive policies (21 public tables +
  `storage.objects`).
- 0003 present: business RPCs, 4 cron jobs (`cleanup_expired_stories`,
  `cleanup_orphan_uploads`, `cleanup_pending_uploads`, `cleanup_stale_calls`),
  5 `supabase_realtime` publication members.
- 0005 absent: no `username_changed_at`/`scheduled_deletion_at` columns, no
  `profiles_blocked` view, no username-change trigger (its `BEGIN/COMMIT`
  rolled back — no partial DDL).
- 0006/0007 absent: no deletion RPCs, no `manually_unread` column.

## Root cause of the 0005 failure: CRLF vs LF

Exact staging error:

```text
ERROR:  P0001: Unexpected create_direct_chat_request definition; migration stopped
CONTEXT:  PL/pgSQL function inline_code_block line 13 at RAISE
```

That message is 0005's own anti-drift guard: it rewrites
`create_direct_chat_request` by exact text match against `pg_get_functiondef()`
output, and aborts when the source does not look like what it expects.

Evidence gathered on staging (read-only):

1. 0005's needles are single-line-ending (`\n`) strings, e.g.
   `"  IF p_initial_content IS NULL …\n    RAISE EXCEPTION 'Initial message cannot be empty';\n  END IF;"`.
2. `pg_get_functiondef('public.create_direct_chat_request(uuid,text)')` on
   staging returns that source with **`\r\n`** line endings inside the body.
3. Therefore 0005's two multi-line needles are `false` matches on staging
   (verified directly: `needle A present? false`), and its guard raises.
4. `git ls-files --eol supabase/migrations/` on this machine:
   `i/lf  w/crlf` for all seven files — the Windows checkout materialized
   CRLF, and the migrations were applied byte-for-byte **from the working
   tree**, storing CRLF inside every function body.
5. Why it ever worked locally: the earlier validation ran on a Linux
   workspace (LF). 0004 succeeded despite CRLF because its single-line
   needles/patches are line-ending-agnostic — only 0005 and 0007 contain
   multi-line E-string needles that break on CRLF.

Reproduction of the mismatch: needle expects `...empty';\n  END IF;` but
staging stores `...empty';\r\n  END IF;`.

## Recovery options (stop-and-report, per mission)

1. **Normalize the one affected function body, then resume** (recommended):
   rebuild `public.create_direct_chat_request(uuid,text)` from its own
   definition with `\r\n` replaced by `\n` via one non-read-only
   `/database/query` call, then apply 0005–0007 from the **committed (LF)
   bytes** — e.g. `git show HEAD:supabase/migrations/<file>` instead of the
   working-tree copy. 0005 and 0007 rewrite that function as their final
   step, so the normalized body is instantly consistent. Rollback: the
   function is recreated in full by 0005/0007; nothing else is touched.
2. Make 0005/0007 EOL-agnostic with CRLF-safe regex matching — requires
   editing the migration files, which this task forbids; belongs to a
   separate repo task (good hardening for production too).
3. Re-create the staging project and apply every migration from committed
   LF bytes in one pass — cleanest but slower.

## Warnings and notes

- **Endpoint version collisions:** `POST /database/migrations` stamps each
  migration with second-resolution wall-clock `version`. Two POSTs inside
  the same second collide on `schema_migrations_pkey`
  (`Key (version)=20261023174156 already exists`). Fixed operationally by
  spacing successive applies ≥ 1.8 s. JSON error was reproducible and fully
  reported at the time it happened.
- **History bookkeeping works on staging** — the endpoint records applied
  migrations (versions/names above), unlike production, where
  `docs/FASE-2.md` notes the history table is empty. When production is
  brought to the 0001–0007 baseline via CLI or API, reusing these name
  conventions (`000N_slug`) will reconcile cleanly.
- **Operator error during this run:** one buggy script invocation attempted
  only 0007 without 0003–0006; it failed cleanly and rolled back. Corrected
  and re-verified state before resuming.
- **Security hygiene:** `.env.example` currently contains what appear to be
  real staging service-role/anon JWTs, contradicting its own comment
  (real values belong in gitignored `.env.local`). Recommend moving to
  `.env.local`, rotating the exposed keys, and scrubbing them from the
  repo history in a separate task.
- **Out of scope for full app testing on staging:** the four private Storage
  buckets (`avatars`, `chat-media`, `story-media`, `channel-media`) and Auth
  email templates still need manual setup (see `supabase/README.md`).
- Production (`lmzbaxlojgsdwgcxkmzx`) was never targeted; its ref was
  hard-coded as a guard, and the working token cannot access it from this
  role anyway.

## Next verification (once 0005–0007 apply)

Run with `read_only: true`:

1. `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';` → expect 22
2. `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;` → expect 0 rows
3. `SELECT count(*) FROM app_config;` → expect 9
4. `SELECT jobname, count(*) FROM cron.job GROUP BY jobname;` → expect 4 jobnames
5. `SELECT proname FROM pg_proc WHERE proname IN ('mark_chat_as_read','mark_chat_as_unread','delete_self_chat','delete_direct_chat_for_me') AND pronamespace = 'public'::regnamespace;` → expect 4 pronames

## Recovery outcome (2026-10-23, authorized Option 1 with Variants A + B)

Recovery Option 1 was applied. Step 1 pre-state matched the documented state
exactly (history 0001–0004 only; 0005/0006/0007 artifacts absent; function
present with 54 CR bytes). Normalization through a single non-read-only
`/database/query` call (note: the authorized snippet's closing `END $$;` was
not valid PL/pgSQL; the identical SEMICOLON-correct form `END; $$;` was run):

| Metric | Before | After |
| --- | --- | --- |
| CR bytes in `create_direct_chat_request` body | 54 | 0 |
| Body length | 3037 | 2983 |

`0005_profile_settings`, `0006_account_deletion_rpcs` and
`0007_chat_delete_adjustments` were then applied from **committed (LF) bytes**
via `git show HEAD:…` (Variant A) as names `0005_profile_settings`,
`0006_account_deletion_rpcs`, `0007_chat_delete_adjustments`, versions
`20261023180925`, `20261023180927`, `20261023180930` respectively. All were
HTTP 200; 0005's response confirmed cron re-registration (`schedule: 4`).

Full verification suite results (all read-only):

1. Migration history: 7 rows, versions `…174155`, `…174156`, `…174321`,
   `…174323`, `…180925`, `…180927`, `…180930`.
2. Table count: 22. 3. RLS-disabled tables: 0 rows. 4. `app_config`: 9 rows.
5. Cron: exactly 4 jobnames, each `count = 1`. 6. The 4 RPCs from 0007:
   4 pronames. 7. `chat_members.manually_unread`: present, `boolean`,
   default `false`. 8. `chat_members_delete_own` qual: restricts to
   authenticated member plus direct/group/community_chat row checks.
9. `create_direct_chat_request`: membership-restore patch present
   (`true`) and LF-clean (`true`).

Variant B: `.gitattributes` enforces
`supabase/migrations/*.sql text eol=lf`; `git ls-files --eol` verifies every
migration file as `i/lf`. Staging is green and ready for further testing.
Production work and history reconciliation remain the developer's
responsibility.
