#!/usr/bin/env node
// Runs the SQL test suites against a running Postgres/Supabase database.
//
// Usage:
//   pnpm test:db                                  # supabase/tests/calls.sql
//   pnpm test:db supabase/tests/messages.sql ...  # any explicit files
//
// Environment:
//   SUPABASE_DB_URL  Postgres connection string. Defaults to the local
//                    Supabase stack started by `supabase start`.
//   PSQL_PATH        psql executable. Defaults to `psql` on PATH.
//
// Each suite runs in its own psql process with ON_ERROR_STOP=1, so the first
// failed assertion aborts the file and makes the command exit non-zero. The
// suites print the failing assertion message (expected vs actual) themselves.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const DEFAULT_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DEFAULT_SUITE = "supabase/tests/calls.sql";

const url = process.env.SUPABASE_DB_URL ?? DEFAULT_URL;
const psql = process.env.PSQL_PATH ?? "psql";
const files = process.argv.slice(2);
if (files.length === 0) files.push(DEFAULT_SUITE);

let failed = 0;
for (const file of files) {
  if (!existsSync(file)) {
    console.error(`SQL TEST FAILED: file not found: ${file}`);
    failed += 1;
    continue;
  }

  console.log(`\n=== SQL TEST: ${file} ===`);
  const result = spawnSync(psql, ["-X", "-v", "ON_ERROR_STOP=1", "-d", url, "-f", file], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`SQL TEST FAILED: ${file}: ${result.error.message}`);
    failed += 1;
  } else if (result.status !== 0) {
    console.error(`SQL TEST FAILED: ${file} (psql exit ${result.status})`);
    failed += 1;
  } else {
    console.log(`SQL TEST PASSED: ${file}`);
  }
}

if (failed > 0) {
  console.error(`\nSQL TESTS: ${failed} file(s) failed`);
  process.exit(1);
}

console.log(`\nSQL TESTS: all ${files.length} file(s) passed`);
