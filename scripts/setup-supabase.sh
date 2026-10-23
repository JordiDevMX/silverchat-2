#!/usr/bin/env bash
# SilverChat — Supabase CLI health check. Idempotent; never prompts.
# Verifies CLI version and authentication, and links the project if needed.
# See docs/SUPABASE_CLI.md.
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Resolve the CLI: prefer a global install, else the dev dependency via npx.
if command -v supabase >/dev/null 2>&1; then
  sb() { supabase "$@"; }
else
  sb() { npx --no-install supabase "$@"; }
fi

echo "== Supabase CLI health check =="

# 2. Version must be 2.x or newer.
ver=$(sb --version 2>/dev/null || true)
if [ -z "$ver" ]; then
  echo "ERROR: Supabase CLI not found. Run 'pnpm install' in this repo, or install it globally (npm i -g supabase)." >&2
  exit 1
fi
major=${ver%%.*}
if [ "$major" -lt 2 ] 2>/dev/null; then
  echo "ERROR: Supabase CLI 2.x+ required, found $ver. Upgrade with: npm i -g supabase" >&2
  exit 1
fi
echo "CLI version: $ver"

# 3. Auth must already be configured. We never run 'supabase login' ourselves.
if ! sb projects list >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is not authenticated. Run 'npx supabase login' (opens a browser), then re-run this script." >&2
  exit 2
fi
echo "Auth: OK"

# 4. Link only if missing. Reads SUPABASE_PROJECT_ID from the environment,
#    falling back to a READ-ONLY .env.local lookup. Never hardcodes a ref.
if [ -f supabase/.temp/project-ref ]; then
  echo "Link: OK ($(cat supabase/.temp/project-ref))"
else
  ref=${SUPABASE_PROJECT_ID:-}
  if [ -z "$ref" ] && [ -f .env.local ]; then
    ref=$(grep '^SUPABASE_PROJECT_ID=' .env.local | head -1 | cut -d= -f2- | tr -d ' "' || true)
  fi
  if [ -z "$ref" ]; then
    echo "ERROR: Not linked and SUPABASE_PROJECT_ID is not set." >&2
    echo "Add 'SUPABASE_PROJECT_ID=<your-project-ref>' to .env.local (see docs/SUPABASE_CLI.md), then re-run." >&2
    exit 3
  fi
  echo "Not linked; linking with SUPABASE_PROJECT_ID..."
  sb link --project-ref "$ref" || { echo "ERROR: 'supabase link' failed. See docs/SUPABASE_CLI.md." >&2; exit 4; }
  echo "Link: OK ($ref)"
fi

echo "Supabase CLI is ready."
