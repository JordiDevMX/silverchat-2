# FASE-2 — Deferred items

## Pre-0008 blocker: remote migration history tracking is empty for 0001–0007

Migrations 0001–0007 were applied manually via the Supabase SQL Editor in a
previous session (see `supabase/README.md`), so the internal
`supabase_migrations.schema_migrations` tracking table was never populated
(`supabase db push` was never used).

- **Before any future `supabase db push`**, run
  `supabase migration repair --status applied <version>` for **each** of
  0001–0007 so the CLI's history table matches the actual remote schema.
- Do **not** re-apply the migrations, modify migration files, or touch the DB
  as part of the repair.
- Discovered during the Supabase CLI setup task (see
  `docs/SUPABASE_CLI.md`); noted by `supabase migration list --linked` showing
  an empty `remote` column for all seven migrations.
