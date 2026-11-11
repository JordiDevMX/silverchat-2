# FASE-2 — Deferred items

## RESOLVED (2026-11-11): remote migration history tracking for 0001–0014

Migrations 0001–0007 were applied manually via the Supabase SQL Editor in a
previous session (see `supabase/README.md`), so the internal
`supabase_migrations.schema_migrations` tracking table was never populated
(`supabase db push` was never used).

State as of 2026-11-11 (TASK-012 corrective sequence, Production
`lmzbaxlojgsdwgcxkmzx`):

- 0001–0007 are recorded in `schema_migrations` (verified by reading the
  table directly).
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

## OPEN (2026-11-11): Production is missing the content of 0005 and 0006

Production's ledger records 0005 and 0006 as applied, but their schema
content was never created there (a read-only catalog comparison against the
migration files lists 12 missing objects — see
`.pif/inbox/task-012-corrective-report.md` for the full list and evidence).

Consequences on Production today: no username-change cooldown trigger, no
message block-check trigger, no account-deletion scheduling RPCs, no
`profiles_blocked` management view, no `profiles_visible.avatar_initials`
column, and `create_direct_chat_request` still behaves as pre-0005.

Because the ledger already claims 0005/0006, the CLI will never re-apply
them. Two options, both requiring Product Owner approval (Production writes
are ledger-only by default):

1. **Backfill with a new migration** (e.g. `0015_…`) written idempotently
   (`if not exists`, `drop … if exists` before `create`) so it is a no-op on
   environments where 0005/0006 already applied. This is the only option that
   restores the intended features to Production.
2. **Accept the drift** and record it as a known Production gap.

Why 0005 never applied on Production (root cause, verified): 0005 and 0007
rewrite `public.create_direct_chat_request` by exact text match against
`pg_get_functiondef()` output using LF-only needles. A CRLF working tree
stores CRLF inside the function body, the match fails, and 0005 aborts with
`Unexpected create_direct_chat_request definition; migration stopped`. The
migration files are committed with LF and `.gitattributes` enforces
`supabase/migrations/*.sql text eol=lf`; `scripts/db-guard.mjs` now blocks a
write when a checked-out migration file contains CRLF. See
`docs/staging-migrations-report.md`.
