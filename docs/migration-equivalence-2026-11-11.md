# Migration equivalence report — 2026-11-11

Result of the `TASK-012` corrective verification: what the migration files
describe versus what the databases actually contain.

- Tool: `scripts/verify-migrations/` (read-only; every remote statement is a `SELECT`).
- Method and how to read the output: `scripts/verify-migrations/README.md`.
- Targets: Production `lmzbaxlojgsdwgcxkmzx`, Staging `gffdrrtatxdiucigtwdn`.

## Summary

| Target | State | Result |
| --- | --- | --- |
| Production | ledger repaired to 0001–0014 (ledger metadata only, no DDL) | **12 findings** — every one of them content that migrations 0005/0006 describe and Production never received |
| Staging | rebuilt from scratch, 0001–0014 applied in order | **0 findings** — the rebuilt database matches the files exactly |

The Staging result is the control: the same comparison, the same tool and the
same files yield zero findings against a database that was applied from those
files. That is what makes the Production findings attributable to the database
rather than to the comparison.

## Reconciliation (2026-11-11, later the same day)

The Product Owner authorized closing the 12 discrepancies on Production. They
were closed with `supabase/migrations/20261111103000_backfill_profile_settings.sql`,
applied through `npx supabase db push --linked` against Production
`lmzbaxlojgsdwgcxkmzx` (link asserted before the push; `db push --dry-run`
first showed exactly that one pending migration).

The corrective migration is idempotent and was applied to Staging first, where
it changed nothing (Staging stayed at 0 findings and its ledger moved from 14
to 15 versions). It creates the objects below, re-applies 0005's two rewrites to
`create_direct_chat_request`, and adds `avatar_initials` to
`profiles_visible`.

After the Production push the comparison returns **0 findings**, and each of
the 12 objects was confirmed present by a direct read-only probe
(`profiles.username_changed_at`, `profiles.scheduled_deletion_at`,
`idx_profiles_pending_deletion`, `validate_username_change()`,
`profiles_username_change_validation`, `check_blocked_on_message_insert()`,
`messages_block_check`, `profiles_blocked`, `profiles_visible.avatar_initials`,
the rewritten `create_direct_chat_request` body, `schedule_account_deletion()`,
`cancel_account_deletion()`), together with the expected privileges.

The sections below record the state **before** the reconciliation.

## Production — 12 findings (resolved by the corrective migration)

All of them are objects that migrations 0005 and 0006 create.

| # | Object missing on Production | Migration |
| --- | --- | --- |
| 1 | `public.profiles.username_changed_at` | 0005 |
| 2 | `public.profiles.scheduled_deletion_at` | 0005 |
| 3 | `idx_profiles_pending_deletion` | 0005 |
| 4 | `public.validate_username_change()` | 0005 |
| 5 | trigger `profiles_username_change_validation` | 0005 |
| 6 | `public.check_blocked_on_message_insert()` | 0005 |
| 7 | trigger `messages_block_check` | 0005 |
| 8 | view `public.profiles_blocked` | 0005 |
| 9 | `public.profiles_visible.avatar_initials` (0005's redefinition of the view not applied) | 0005 |
| 10 | `public.create_direct_chat_request` body — 0005's two `pg_get_functiondef()` rewrites not applied (Production still raises `'Initial message cannot be empty'`) | 0005 |
| 11 | `public.schedule_account_deletion()` | 0006 |
| 12 | `public.cancel_account_deletion()` | 0006 |

Production still has 0004's `profiles_visible` definition and the pre-0005
`create_direct_chat_request` body, while 0007's rewrite — which does not
depend on 0005 — **is** applied.

## Why 0005 is missing on Production

0005 was never applied there. `0009_device_fingerprint.sql` records the same
fact in its header ("Migration 0005 was never applied to the remote
database"), and 0006 depends on a column that only 0005 creates, so it was
never applied either.

A read-only probe (`scripts/verify-migrations/probes/needle-position.sql`)
shows Production's `create_direct_chat_request` body is LF-clean and still
contains **both** of 0005's exact-text needles (`position(...)` → 1522 and
2991), so 0005 would have applied successfully against Production's body.

The CRLF failure mode is real but is a different failure: it blocks 0005 when
a migration file with CRLF line endings created the function body. That is
what stopped 0005 on Staging (2026-10-23 and again on 2026-11-11 before the
working tree was renormalized). `scripts/db-guard.mjs` now blocks any write
while a checked-out migration file contains CRLF.

## Differences proven to be presentational

These are counted, not listed: they are the same objects on both sides.

- **13 function bodies** differ only in whitespace — identical after
  whitespace is removed (the 0004 MFA wrappers).
- **20 policy expressions** are token-identical and differ only in the
  parentheses Postgres adds when it deparses.
- **83 notes** are objects that exist only in the database under
  Postgres-generated names — auto-named primary key, unique and inline
  `CHECK` constraints. `CHECK` constraints are compared by count per table,
  and the counts match for every table that has them.

## Ledger

Production recorded 0001–0007 before this task; 0008–0014 were missing even
though their content was present, so the CLI wanted to apply them again. They
are now recorded through
`npx supabase migration repair --status applied 0008 0009 0010 0011 0012 0013 0014`,
which writes history metadata only. The schema was compared before and after
that command and is unchanged.

## Scope of the comparison

Verified at object level: function bodies and attributes, tables and columns,
constraints (named by name; `CHECK` by count; foreign key / unique / primary
key by column set and foreign key actions), policies including expression
text, triggers, indexes, privileges, RLS enablement, enum types and labels,
extensions, views (options, owner, output columns), cron jobs (command and
schedule), publication membership, ownership and the `app_config` seed rows.

Not verified: view body text beyond the output columns, `CHECK` constraint
expressions (count only), and constraint names for inline primary key, unique
and `CHECK` constraints (Postgres generates them).
