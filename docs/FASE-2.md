# FASE-2 — Deferred items

## RESOLVED (2026-11-11): remote migration history tracking for 0001–0014

Migrations 0001–0007 were applied manually via the Supabase SQL Editor in a
previous session (see `supabase/README.md`), so the internal
`supabase_migrations.schema_migrations` tracking table was never populated
(`supabase db push` was never used).

State as of 2026-11-11 (TASK-012 corrective sequence, Production
`lmzbaxlojgsdwgcxkmzx`):

- 0001–0007 are recorded in `schema_migrations`. They were recorded before
  this task (verified by reading the table directly), independently of the
  repair below.
- 0008–0014 had been applied out-of-band and their content was verified
  present, but they were **absent from the ledger** — the CLI therefore wanted
  to apply them again and `supabase db push` was blocked. They are now
  recorded too, via the ledger-only command
  `npx supabase migration repair --status applied 0008 0009 0010 0011 0012 0013 0014`.
  No schema DDL was executed by that command (verified by a read-only
  before/after catalog comparison).
- `npx supabase migration list --linked` now shows 14 local == 14 remote.
  **Do not run `supabase db push` against Production**: all 14 versions are
  recorded, and pushing would be a no-op at best.
- The repair rule still holds: do **not** re-apply migrations, modify
  applied migration files, or touch the DB to "fix" history.

## RESOLVED (2026-11-11, later the same day): Production was missing the content of 0005 and 0006

Production's ledger recorded 0005 and 0006 as applied, but their schema
content was never created there — a read-only catalog comparison against the
migration files listed 12 missing objects (see
`docs/migration-equivalence-2026-11-11.md` for the list and method, and
`.pif/inbox/TASK-012-delivery.md` for the audit submission).

With the Product Owner's authorization, those 12 discrepancies were closed on
Production by `supabase/migrations/20261111103000_backfill_profile_settings.sql`
(applied with `npx supabase db push --linked` after `db push --dry-run` showed
that single pending migration, with the linked project ref asserted). The
migration is idempotent — it was applied to Staging first, where it changed
nothing — and it creates exactly the missing objects.

After the push the equivalence comparison against Production returns **0
findings**, and each of the 12 objects was confirmed present by a direct
read-only probe. Production now has the username-change cooldown trigger, the
message block-check trigger, the account-deletion scheduling RPCs, the
`profiles_blocked` management view, `profiles_visible.avatar_initials`, and a
`create_direct_chat_request` that behaves as 0005 specifies.

Why 0005 was never applied on Production (verified): it was never run there.
`0009_device_fingerprint.sql` records the same fact in its header, and 0006
depends on a column only 0005 creates. A read-only probe showed Production's
`create_direct_chat_request` body is LF-clean and still contains **both** of
0005's exact-text needles, so 0005 would have applied successfully against
Production's body.

The related CRLF hazard is a different failure: 0005 and 0007 rewrite
`public.create_direct_chat_request` by exact text match against
`pg_get_functiondef()` output with LF-only needles, so a function body that
was stored with CRLF line endings (because the migration file that created it
had CRLF) makes the match fail and 0005 aborts with `Unexpected
create_direct_chat_request definition; migration stopped`. That is what
blocked 0005 on Staging. The migration files are committed with LF and
`.gitattributes` enforces `supabase/migrations/*.sql text eol=lf`;
`scripts/db-guard.mjs` now blocks a write when a checked-out migration file
contains CRLF. See `docs/staging-migrations-report.md`.
