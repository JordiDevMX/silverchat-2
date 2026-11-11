# Supabase CLI Setup

One-time setup required for any developer or AI agent working on SilverChat
locally.

## Prerequisites

- Node.js 20+
- pnpm 9+ (enforced by a `preinstall` hook)
- Supabase CLI 2.x — installed as a dev dependency of this repo. Commands
  below use `npx supabase …`, which resolves the local copy automatically.

## One-time setup (per machine)

1. `npx supabase login` — opens a browser, authorizes, and stores the token
   globally in `~/.supabase/access-token`. Do this ONCE per machine.
2. `npx supabase link --project-ref <PROJECT_REF>` — links this checkout to
   the remote project. Creates `supabase/.temp/project-ref` (gitignored).
3. If `supabase link` (or a later `db push`) asks for a password, set
   `SUPABASE_DB_PASSWORD` first:
   `export SUPABASE_DB_PASSWORD="<password>"`.

## Where to find your ref

`<PROJECT_REF>` is a 20-character lowercase string unique to your Supabase
project:

- **Dashboard URL:** `https://supabase.com/dashboard/project/<PROJECT_REF>`
  — the path segment after `/project/`.
- **Dashboard UI:** Project Settings → General → Reference ID.

Put the real value in `.env.local` as `SUPABASE_PROJECT_ID` (see
`.env.example` for the placeholder). The project ref itself is not a secret
and appears in this repository's docs and tooling (the two refs below, in
`scripts/db-guard.mjs`); credentials — access token, database password — must
never be committed.

## Verify

```bash
npx supabase projects list
npx supabase migration list --linked
npx supabase db lint --linked
```

All three should succeed.

## Common commands

| Command                                | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `npx supabase migration new <name>`    | Create a new migration file          |
| `npx supabase db push`                 | Apply pending migrations to remote   |
| `npx supabase migration list --linked` | Show applied migrations on remote    |
| `npx supabase db lint --linked`        | Lint the remote schema               |
| `npx supabase db reset`                | Reset LOCAL db (needs Docker)        |

## Guard before any write to a remote database

`scripts/db-guard.mjs` is a pre-flight check for `db push`,
`migration repair` or any other command that mutates a remote database. Run
it first and stop if it does not exit 0. It reports the linked project so you
do not write to the wrong one, and it reports CRLF migration files whose
line endings would break the exact-text rewrites in 0005/0007.

```bash
# staging
node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn

# production (requires the explicit authorization flag)
node scripts/db-guard.mjs --expect lmzbaxlojgsdwgcxkmzx --allow-production
```

The guard checks that:

1. the expected ref is a known project (production or staging);
2. `supabase/.temp/project-ref` exists and is exactly the expected project;
3. production writes carry `--allow-production`;
4. no file in `supabase/migrations/` contains CRLF line endings.

Exit codes: `0` = all checks passed, `1` = blocked (the reasons are printed),
`2` = usage error. `--help` prints the usage and exits 0.

The guard is advisory: it inspects the local checkout and the CLI link file
only, performs no network access and writes nothing. Nothing enforces it
automatically — running it is a procedural step, and the exit code has to be
checked.

About check 4: 0005 and 0007 rewrite `public.create_direct_chat_request` by
exact text match against `pg_get_functiondef()` output, with needles that
contain LF only. The line endings that matter are those of the body as
stored by the migration that *created* the function (0003 for
`create_direct_chat_request`): a CRLF migration file stores a CRLF body, the
match then fails and 0005 aborts with `Unexpected create_direct_chat_request
definition; migration stopped`. Any CRLF in any migration file can put CRLF
into a stored body, so the check covers the whole directory. Repair a dirty
working tree with:

```bash
git checkout HEAD -- supabase/migrations   # restores the files from the index with LF endings
```

Verify afterwards with `git ls-files --eol supabase/migrations` — every file
must show `w/lf`.

## Project references in use

| Environment | Project ref              | Notes                                             |
| ----------- | ------------------------ | ------------------------------------------------- |
| Production  | `lmzbaxlojgsdwgcxkmzx`   | Ledger 2026-11-11: 15/15 versions recorded (0001–0014 + the corrective backfill) |
| Staging     | `gffdrrtatxdiucigtwdn`   | Rebuilt 2026-11-11: 0001–0014 applied from scratch, plus the same corrective migration (a no-op there) |

## Rules for migration files

- **Line endings must be LF.** `.gitattributes` pins
  `supabase/migrations/*.sql text eol=lf`, because 0005 and 0007 match
  function bodies by exact text with LF-only needles. If a Windows checkout
  materializes CRLF, the function body is stored with CRLF and those
  migrations abort with
  `Unexpected create_direct_chat_request definition; migration stopped`.
  Repair a dirty working tree with:
  `git checkout HEAD -- supabase/migrations`, then confirm with
  `git ls-files --eol supabase/migrations` that every file shows `w/lf`.
- **New migrations use timestamp-prefixed filenames**
  (`supabase migration new <name>` produces `YYYYMMDDHHMMSS_<name>.sql`).
  The existing 0001–0014 series stays as-is; do not renumber it.
- **Never edit an already-applied migration file.** Add a new migration
  instead — with idempotent guards (`if not exists`, `drop … if exists`) so it
  is a no-op where the change already landed.
- **Do not run `supabase db push` against Production.** All 14 versions are
  recorded there; pushing is unnecessary and risks re-applying DDL.

## What is NOT committed

- `~/.supabase/access-token` — global, per-machine
- `supabase/.temp/` — gitignored
- `.env.local` — gitignored

## Troubleshooting

- **Access token not provided** → run `npx supabase login`.
- **Cannot find project ref** → run
  `npx supabase link --project-ref <PROJECT_REF>`.
- **Invalid access token format** → token is malformed; run
  `npx supabase login` again.
- **`supabase db push` hangs** → check that the DB password is correct.
- **`unexpected login role status 400: duplicate key cli_login_postgres`**
  → two Supabase commands connected at the same time and raced to create the
  shared login role. Run the commands sequentially; the second attempt
  succeeds.

## For AI agents

Before running any `supabase` command, verify the CLI is authenticated and
linked:

```bash
npx supabase projects list && cat supabase/.temp/project-ref
```

If either fails, do NOT try `supabase login` or `supabase link` yourself.
Ask the developer to run them.

Before any command that writes to a remote database, run the guard for the
intended target and stop if it exits non-zero:

```bash
node scripts/db-guard.mjs --expect gffdrrtatxdiucigtwdn          # staging
node scripts/db-guard.mjs --expect lmzbaxlojgsdwgcxkmzx --allow-production
```

Fast path if everything is healthy:

```bash
bash scripts/setup-supabase.sh      # Linux / macOS / Git Bash
powershell -File scripts/setup-supabase.ps1   # Windows PowerShell
```

Both scripts are idempotent, prompt-free health checks: they verify the CLI
version and authentication, and link the project if `SUPABASE_PROJECT_ID`
is available. They never ask for credentials — that is the human's job.
