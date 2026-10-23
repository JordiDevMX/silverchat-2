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
`.env.example` for the placeholder). Never hardcode your project's ref in
committed files.

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

Fast path if everything is healthy:

```bash
bash scripts/setup-supabase.sh      # Linux / macOS / Git Bash
powershell -File scripts/setup-supabase.ps1   # Windows PowerShell
```

Both scripts are idempotent, prompt-free health checks: they verify the CLI
version and authentication, and link the project if `SUPABASE_PROJECT_ID`
is available. They never ask for credentials — that is the human's job.
