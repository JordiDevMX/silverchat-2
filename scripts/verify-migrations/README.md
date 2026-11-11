# Migration equivalence verification

Compares the schema that `supabase/migrations/*.sql` describe with the schema
that actually exists in the linked Supabase project. It exists because the
migration ledger can look healthy while the database content does not match
the files (see `docs/FASE-2.md`).

## Guarantees

- **Read-only.** Every statement sent to the remote project is a `SELECT`.
  The tool never runs `db push`, `db reset` or any DDL.
- **Target-aware.** The target is the currently linked project
  (`supabase/.temp/project-ref`). Output files are named per project ref, so
  a Staging run never overwrites the Production evidence.
- **No secrets.** The tool reads only the project ref from the gitignored
  link file; it does not read or write credentials.

## Usage

```bash
# 1. link the project you want to inspect
npx supabase link --project-ref <project-ref>

# 2. dump its catalog (read-only)
node scripts/verify-migrations/verify-migrations.mjs run

# 3. diff the dump against the migration files
node scripts/verify-migrations/verify-migrations.mjs compare
```

Output lands in `.migration-verification/` (gitignored):

| File | Contents |
| --- | --- |
| `inventory.json` | expected final state parsed from the migration files |
| `dump-<ref>.json` | the catalog read from the remote project |
| `dump-<ref>.sql` | the exact SQL used for that dump |
| `equivalence-report-<ref>.txt` | the diff: findings, then soft/paren-only/notes |

## Reading the report

- **HARD findings** (`MISSING_*`, `EXTRA_*`, `DIFFERS_*`) — the database and
  the files disagree. Each line names the object and what differs.
- **SOFT** — differences proven to be presentational only, e.g. a function
  body that differs only in whitespace (token-identical after whitespace is
  removed).
- **PAREN-ONLY / TOKEN-IDENTICAL** — expressions whose token sequences are
  identical and differ only in the parentheses Postgres adds when it
  deparses. Both sides are canonicalized with the same rules
  (`canon.mjs`): casts, parentheses, `IN` vs `= ANY`, interval literal
  spellings, relation qualification and subquery aliases.
- **NOTES** — objects that exist only in the database under
  Postgres-generated names (for example the auto-named primary key, unique
  and inline `CHECK` constraints). CHECK constraints are therefore compared
  by count per table rather than by name.

## What is compared

Function bodies, signatures, return types, volatility, strictness,
`SECURITY DEFINER` and `search_path`; tables and columns (type, nullability,
default); constraints (named constraints by name, `CHECK` by count per table,
foreign keys / unique / primary key by column set and foreign key actions);
RLS policies including expression text; triggers; indexes including
predicates; table, column and routine privileges; RLS enablement; enum
types and their labels; extensions; views (options, owner, output columns);
cron jobs (command **and** schedule); realtime publication membership;
function and view ownership; and the `app_config` seed rows.

## Probes

`probes/` holds small read-only queries used during the 2026-11-11
reconciliation:

- `migration-ledger.sql` — the `supabase_migrations.schema_migrations` rows.
- `needle-position.sql` — proves whether 0005's exact-text needles match the
  stored function body (the CRLF failure mode).
