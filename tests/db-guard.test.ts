import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  evaluate,
  findCrlfMigrations,
  PRODUCTION_REF,
  parseArgs,
  readProjectRef,
  runCli,
  STAGING_REF,
} from "../scripts/db-guard.mjs";

const makeRepo = (t: { after: (fn: () => void) => void }): string => {
  const root = mkdtempSync(path.join(tmpdir(), "db-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "supabase", ".temp"), { recursive: true });
  mkdirSync(path.join(root, "supabase", "migrations"), { recursive: true });
  return root;
};

const link = (root: string, ref: string): void => {
  writeFileSync(path.join(root, "supabase", ".temp", "project-ref"), `${ref}\n`);
};

const migration = (root: string, name: string, body: string): void => {
  writeFileSync(path.join(root, "supabase", "migrations", name), body);
};

test("readProjectRef returns the linked project ref and tolerates trailing whitespace", (t) => {
  const root = makeRepo(t);
  link(root, PRODUCTION_REF);
  assert.equal(readProjectRef(root), PRODUCTION_REF);
});

test("readProjectRef returns null when the project is not linked", (t) => {
  const root = makeRepo(t);
  assert.equal(readProjectRef(root), null);
});

test("findCrlfMigrations reports only migration files containing CRLF", (t) => {
  const root = makeRepo(t);
  migration(root, "0001_lf.sql", "select 1;\nselect 2;\n");
  migration(root, "0002_crlf.sql", "select 1;\r\nselect 2;\r\n");
  assert.deepEqual(findCrlfMigrations(root), ["0002_crlf.sql"]);
});

test("a matching link with LF-only migrations passes the guard", (t) => {
  const root = makeRepo(t);
  link(root, STAGING_REF);
  migration(root, "0001_lf.sql", "select 1;\n");
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: readProjectRef(root),
    crlfFiles: findCrlfMigrations(root),
    allowProduction: false,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("a mismatched link fails the guard with the expected and actual refs", (t) => {
  const root = makeRepo(t);
  link(root, PRODUCTION_REF);
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: readProjectRef(root),
    crlfFiles: [],
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /staging/i);
  assert.match(result.errors.join("\n"), /production/i);
});

test("a link to an unknown third project is reported as such", (t) => {
  const root = makeRepo(t);
  link(root, "someotherprojectref12");
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: readProjectRef(root),
    crlfFiles: [],
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /someotherprojectref12/);
});

test("an unlinked project fails the guard", () => {
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: null,
    crlfFiles: [],
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /not linked/i);
});

test("CRLF migration files fail the guard because the rewrite needles are LF-only", (t) => {
  const root = makeRepo(t);
  link(root, STAGING_REF);
  migration(root, "0003_business_logic.sql", "select 1;\r\n");
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: readProjectRef(root),
    crlfFiles: findCrlfMigrations(root),
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /CRLF/);
  assert.match(result.errors.join("\n"), /git checkout HEAD -- supabase\/migrations/);
});

test("production writes need an explicit authorization flag", (t) => {
  const root = makeRepo(t);
  link(root, PRODUCTION_REF);
  const withoutFlag = evaluate({
    expectedRef: PRODUCTION_REF,
    currentRef: readProjectRef(root),
    crlfFiles: [],
    allowProduction: false,
  });
  assert.equal(withoutFlag.ok, false);
  assert.match(withoutFlag.errors.join("\n"), /authorization/i);

  const withFlag = evaluate({
    expectedRef: PRODUCTION_REF,
    currentRef: readProjectRef(root),
    crlfFiles: [],
    allowProduction: true,
  });
  assert.equal(withFlag.ok, true);
});

test("an unknown expected ref fails the guard", (t) => {
  const root = makeRepo(t);
  link(root, "someotherref");
  const result = evaluate({
    expectedRef: "someotherref",
    currentRef: readProjectRef(root),
    crlfFiles: [],
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /unknown/i);
});

test("parseArgs reads the expected ref and the production authorization flag", () => {
  assert.deepEqual(parseArgs(["--expect", STAGING_REF]), {
    expect: STAGING_REF,
    allowProduction: false,
    help: false,
  });
  assert.deepEqual(parseArgs(["--expect", PRODUCTION_REF, "--allow-production"]), {
    expect: PRODUCTION_REF,
    allowProduction: true,
    help: false,
  });
  assert.deepEqual(parseArgs(["--help"]), { expect: null, allowProduction: false, help: true });
});

test("the CLI exits 0 when every check passes", (t) => {
  const root = makeRepo(t);
  link(root, STAGING_REF);
  const result = runCli(["--expect", STAGING_REF], {
    root,
    currentRef: STAGING_REF,
    crlfFiles: [],
  });
  assert.equal(result.code, 0);
  assert.match(result.stdout, /OK/);
});

test("the CLI exits 1 when the target does not match", (t) => {
  const root = makeRepo(t);
  link(root, PRODUCTION_REF);
  const result = runCli(["--expect", STAGING_REF], {
    root,
    currentRef: PRODUCTION_REF,
    crlfFiles: [],
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /BLOCKED/);
});

test("the CLI exits 1 for a production write without the authorization flag", (t) => {
  const root = makeRepo(t);
  link(root, PRODUCTION_REF);
  const result = runCli(["--expect", PRODUCTION_REF], {
    root,
    currentRef: PRODUCTION_REF,
    crlfFiles: [],
  });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /authorization/i);
});

test("the CLI exits 2 when no expected ref is given", () => {
  const result = runCli([], { currentRef: null, crlfFiles: [] });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /usage/);
});
