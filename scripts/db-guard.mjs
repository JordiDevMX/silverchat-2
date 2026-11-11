#!/usr/bin/env node
// Pre-write guard for Supabase CLI operations that mutate a remote database.
//
// Usage:
//   node scripts/db-guard.mjs --expect <project-ref> [--allow-production]
//
// Checks, in order:
//   1. the expected project ref is a known project (production or staging);
//   2. the CLI is linked, and linked to exactly the expected project;
//   3. production writes carry an explicit authorization flag;
//   4. migration SQL in the working tree contains no CRLF line endings.
//
// (4) exists because migrations 0005 and 0007 rewrite a function by exact
// text match against pg_get_functiondef() output using LF-only needles. A
// CRLF working tree stores CRLF inside the function body, the match fails and
// the migration aborts with "Unexpected create_direct_chat_request
// definition; migration stopped". See docs/staging-migrations-report.md.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PRODUCTION_REF = "lmzbaxlojgsdwgcxkmzx";
export const STAGING_REF = "gffdrrtatxdiucigtwdn";

const KNOWN_REFS = { production: PRODUCTION_REF, staging: STAGING_REF };

export function readProjectRef(root) {
  const refFile = path.join(root, "supabase", ".temp", "project-ref");
  if (!existsSync(refFile)) return null;
  const ref = readFileSync(refFile, "utf8").trim();
  return ref.length > 0 ? ref : null;
}

export function findCrlfMigrations(root) {
  const dir = path.join(root, "supabase", "migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => readFileSync(path.join(dir, name), "utf8").includes("\r\n"))
    .sort();
}

export function evaluate({ expectedRef, currentRef, crlfFiles, allowProduction }) {
  const errors = [];
  const warnings = [];

  const known = Object.entries(KNOWN_REFS).find(([, ref]) => ref === expectedRef);
  if (!known) {
    errors.push(
      `unknown expected project ref "${expectedRef}" (known: production=${PRODUCTION_REF}, staging=${STAGING_REF})`,
    );
    return { ok: false, errors, warnings };
  }
  const [environment] = known;

  if (currentRef === null) {
    errors.push(
      `supabase is not linked: run "npx supabase link --project-ref ${expectedRef}" before writing to ${environment}`,
    );
  } else if (currentRef !== expectedRef) {
    const currentEntry = Object.entries(KNOWN_REFS).find(([, ref]) => ref === currentRef);
    const currentLabel = currentEntry ? `${currentEntry[0]} "${currentRef}"` : `"${currentRef}"`;
    errors.push(
      `linked project is ${currentLabel} but ${environment} "${expectedRef}" was expected; run "npx supabase link --project-ref ${expectedRef}" first`,
    );
  }

  if (environment === "production" && !allowProduction) {
    errors.push(
      "production writes require --allow-production (explicit authorization to mutate the production database)",
    );
  }

  if (crlfFiles.length > 0) {
    errors.push(
      `migration files contain CRLF line endings: ${crlfFiles.join(", ")}; ` +
        "0005/0007 match function bodies by exact text with LF-only needles, so a CRLF working tree aborts the migration. " +
        "Fix with: git rm --cached -r supabase/migrations && git reset --hard supabase/migrations",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

function parseArgs(argv) {
  const args = { expect: null, allowProduction: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--expect") args.expect = argv[++i] ?? null;
    else if (arg === "--allow-production") args.allowProduction = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.expect) {
    process.stdout.write(
      "usage: node scripts/db-guard.mjs --expect <project-ref> [--allow-production]\n",
    );
    process.exit(args.help ? 0 : 2);
  }

  const root = process.cwd();
  const result = evaluate({
    expectedRef: args.expect,
    currentRef: readProjectRef(root),
    crlfFiles: findCrlfMigrations(root),
    allowProduction: args.allowProduction,
  });

  if (result.ok) {
    process.stdout.write(`db-guard: OK — linked target ${args.expect} verified.\n`);
    process.exit(0);
  }
  process.stderr.write("db-guard: BLOCKED\n");
  for (const error of result.errors) process.stderr.write(`  - ${error}\n`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
