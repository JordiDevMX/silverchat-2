import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  evaluate,
  findCrlfMigrations,
  PRODUCTION_REF,
  readProjectRef,
  STAGING_REF,
} from "../scripts/db-guard.mjs";

const makeRepo = (): string => {
  const root = mkdtempSync(path.join(tmpdir(), "db-guard-"));
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

test("readProjectRef returns the linked project ref and tolerates trailing whitespace", () => {
  const root = makeRepo();
  link(root, PRODUCTION_REF);
  assert.equal(readProjectRef(root), PRODUCTION_REF);
});

test("readProjectRef returns null when the project is not linked", () => {
  const root = makeRepo();
  assert.equal(readProjectRef(root), null);
});

test("findCrlfMigrations reports only migration files containing CRLF", () => {
  const root = makeRepo();
  migration(root, "0001_lf.sql", "select 1;\nselect 2;\n");
  migration(root, "0002_crlf.sql", "select 1;\r\nselect 2;\r\n");
  assert.deepEqual(findCrlfMigrations(root), ["0002_crlf.sql"]);
});

test("a matching link with LF-only migrations passes the guard", () => {
  const root = makeRepo();
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

test("a mismatched link fails the guard with the expected and actual refs", () => {
  const root = makeRepo();
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

test("CRLF migration files fail the guard because DO-block needles are LF-only", () => {
  const root = makeRepo();
  link(root, STAGING_REF);
  const result = evaluate({
    expectedRef: STAGING_REF,
    currentRef: readProjectRef(root),
    crlfFiles: ["0005_profile_settings.sql"],
    allowProduction: false,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /CRLF/);
});

test("production writes need an explicit authorization flag", () => {
  const root = makeRepo();
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

test("an unknown expected ref fails the guard", () => {
  const root = makeRepo();
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
