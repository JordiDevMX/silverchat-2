#!/usr/bin/env node
// Pre-write guard for Supabase CLI operations that mutate a remote database.
//
// Usage:
//   node scripts/db-guard.mjs --expect <project-ref> [--allow-production]
//
// Exit codes: 0 = checks passed, 1 = blocked, 2 = usage error.
//
// Checks, in order:
//   1. the expected project ref is a known project (production or staging);
//   2. the CLI is linked, and linked to exactly the expected project;
//   3. production writes carry an explicit authorization flag;
//   4. migration SQL in the working tree contains no CRLF line endings.
//
// (4) exists because migrations 0005 and 0007 rewrite
// public.create_direct_chat_request by exact text match against
// pg_get_functiondef() output, using needles that contain LF only. The line
// endings that matter are those of the body as stored by the migration that
// created the function (0003 for create_direct_chat_request): a CRLF
// migration file stores a CRLF body, the match then fails and the migration
// aborts with "Unexpected create_direct_chat_request definition; migration
// stopped". Any CRLF in any migration file can put CRLF into a stored body,
// so the check covers the whole directory. See docs/staging-migrations-report.md.
//
// This guard is a pre-flight check: it inspects the local checkout and the
// CLI link file only. It performs no network access and writes nothing.
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCTION_REF = "lmzbaxlojgsdwgcxkmzx";
export const STAGING_REF = "gffdrrtatxdiucigtwdn";

const KNOWN_REFS = { production: PRODUCTION_REF, staging: STAGING_REF };

// Repository root: resolved from this file's location so the guard works the
// same from any working directory.
export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

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

  const known = Object.entries(KNOWN_REFS).find(([, ref]) => ref === expectedRef);
  if (!known) {
    errors.push(
      `unknown expected project ref "${expectedRef}" (known: production=${PRODUCTION_REF}, staging=${STAGING_REF})`,
    );
    return { ok: false, errors };
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
        "a CRLF migration file stores CRLF inside function bodies, and 0005/0007 then fail to match their LF-only exact-text needles and abort. " +
        "Fix with: git checkout HEAD -- supabase/migrations",
    );
  }

  return { ok: errors.length === 0, errors };
}

export function parseArgs(argv) {
  const args = { expect: null, allowProduction: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--expect") args.expect = argv[++i] ?? null;
    else if (arg === "--allow-production") args.allowProduction = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

const USAGE = "usage: node scripts/db-guard.mjs --expect <project-ref> [--allow-production]\n";

// Runs the guard. Returns the exit code and the text to print; `deps` exists
// so the CLI layer can be tested without touching the filesystem.
export function runCli(argv, deps = {}) {
  const root = deps.root ?? repoRoot();
  const args = parseArgs(argv);

  if (args.help) return { code: 0, stdout: USAGE, stderr: "" };
  if (!args.expect) return { code: 2, stdout: "", stderr: USAGE };

  const currentRef = deps.currentRef !== undefined ? deps.currentRef : readProjectRef(root);
  const crlfFiles = deps.crlfFiles !== undefined ? deps.crlfFiles : findCrlfMigrations(root);

  const result = evaluate({
    expectedRef: args.expect,
    currentRef,
    crlfFiles,
    allowProduction: args.allowProduction,
  });

  if (result.ok) {
    return {
      code: 0,
      stdout: `db-guard: OK — linked target ${args.expect} verified.\n`,
      stderr: "",
    };
  }
  const stderr = `db-guard: BLOCKED\n${result.errors.map((error) => `  - ${error}\n`).join("")}`;
  return { code: 1, stdout: "", stderr };
}

// True when this file is the process entry point. Both sides are resolved to
// their real path so a symlinked or junctioned invocation still runs main().
export function isEntryPoint(entryPath) {
  if (!entryPath) return false;
  try {
    const self = realpathSync(fileURLToPath(import.meta.url));
    const entry = realpathSync(entryPath);
    return path.resolve(self) === path.resolve(entry);
  } catch {
    return false;
  }
}

if (isEntryPoint(process.argv[1])) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.code);
}
