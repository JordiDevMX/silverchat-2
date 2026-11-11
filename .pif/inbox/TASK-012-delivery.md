# Engineer → Guardian Delivery Submission

**Task ID:** `TASK-012` (corrective sequence, `RISK-001`)
**Approved plan reference:** `.superpowers/plans/migration-reconciliation.md`; Product Owner authorization of items 1–5 on 2026-11-10 (`USER_APPROVED`)
**Branch:** `engineering/migration-reconciliation` (from `main` @ `a0037a1f2acf1dd04ff3f16782944b01bb095830`)
**Commit SHA(s):**
- `174b71b3d9192b9c8c8c1ee7be074a8e601e0a85` — `chore(db): add write-target guard for Supabase CLI operations`
- `3338089d56c8706d92e6c32a089de3e914fed5c2` — `docs(db): record reconciled migration state and file conventions`
- `44bea4f266c820b51e0fa276ad7d813da1d27484` — `fix(db): type the guard module for the TypeScript test import`
- `65f0bbd9724884c0671e43f37bafc27849566133` — `docs(pif): submit TASK-012 corrective delivery for Guardian audit` (first submission)
- `de86468635f0897241024082e7429b246a516bc1` — `fix(db): harden the write-target guard after review`
- `629dd31aeb98d88bd4df2f021e1fd6e6940e2f3b` — `chore(db): commit the migration equivalence tool and its 2026-11-11 result`
- `60f58ccaf29667d2895f0f0853c319da1eacbf8e` — `docs(db): correct the migration documentation after review`
- `b78d66d` — `feat(db): backfill the 0005/0006 content gap on Production` (the corrective migration + the verification-tool fix)
- `docs(pif): submit TASK-012 corrective delivery for Guardian audit` — the commit that contains this file (its SHA is reported to the Product Owner separately; it cannot be self-referenced)

**Claim status:** `REPORTED` (Engineer claims below are individually classified; Guardian to re-check). Working tree clean except untracked `.superpowers/` (task working notes) and `graphify-out/cache/last_query_stamp` (pre-existing, untouched).

**Baseline reference:** `.pif/manifest.json` baseline revision `fceb0e51750eb06ee9f6f18652f7c43f18d11585`.

---

## Requested behavior and scope

The PO authorized five corrective items for `RISK-001`:

1. **Deeper equivalence verification** (read-only) of Production against `supabase/migrations/0001`–`0014`.
2. **Production ledger repair** — history metadata only, no schema DDL.
3. **Staging rebuild** (destructive, staging only).
4. **Safeguards** (repository changes, on the branch).
5. **Guardian delivery** via this file.

A second Product Owner authorization (2026-11-11, after the 12 discrepancies
were reported) extended the scope to **execute the corrective schema change on
Production** so that the discrepancies are closed rather than only documented.
That work is covered below under "Reconciliation".

Scope kept as authorized: the first pass executed **no schema DDL on
Production**; the reconciliation executed only the 12 discrepancies in scope
(and nothing else); canonical `.pif/` records were not touched (only this
inbox file is written); nothing was pushed, merged or deployed.

---

## Changes made

| Path | Change | Revision |
|---|---|---|
| `scripts/db-guard.mjs` | **New.** Pre-write guard for remote-mutating CLI commands: asserts the linked project ref equals the expected ref, requires `--allow-production` for production, and blocks when a checked-out migration file contains CRLF. | `174b71b` |
| `tests/db-guard.test.ts` | **New.** 9 tests covering ref matching, unlinked state, unknown refs, CRLF detection, production authorization. | `174b71b` |
| `biome.json` | Exclude `.superpowers/` (task scratch dir) from Biome, matching the existing exclusions for `.opencode/`, `.agents/`, `.claude/`. | `174b71b` |
| `docs/FASE-2.md` | Marks the 0001–0007 history blocker **RESOLVED**; adds the open item "Production is missing the content of 0005 and 0006" with both options and the CRLF root cause. | `3338089` |
| `docs/SUPABASE_CLI.md` | Adds the guard section, the project refs in use with current state, and the migration-file rules (LF endings, timestamp-prefixed names for new migrations, never edit an applied migration, no `db push` against Production). | `3338089` |
| `docs/staging-migrations-report.md` | Appends the 2026-11-11 rebuild outcome, the recurrence of the CRLF failure and its fix, and the device-index resolution. | `3338089` |
| `supabase/README.md` | Current deployment state per environment + migration file conventions. | `3338089` |

### Database-side changes (authorized)

| Target | Action | Result |
|---|---|---|
| Production `lmzbaxlojgsdwgcxkmzx` | `npx supabase migration repair --status applied 0008 0009 0010 0011 0012 0013 0014` | Ledger now records 0001–0014. **Ledger metadata only — no DDL** (verified below). |
| Staging `gffdrrtatxdiucigtwdn` | Dropped all app objects, reverted stale ledger rows, `npx supabase db push --linked` | 0001–0014 applied from scratch in order. Staging data destroyed (authorized). |
| Staging `gffdrrtatxdiucigtwdn` (reconciliation) | `npx supabase db push --linked` with the corrective migration | Applied cleanly and changed nothing — the idempotency proof before touching Production. Ledger 14 → 15. |
| Production `lmzbaxlojgsdwgcxkmzx` (reconciliation) | `npx supabase db push --linked` with the corrective migration (link asserted, dry run first) | The 12 discrepancies closed. Ledger 15 versions, local == remote, equivalence comparison **0 findings**. |

### Reconciliation — new files

| Path | Change |
|---|---|
| `supabase/migrations/20261111103000_backfill_profile_settings.sql` | **New.** Idempotent corrective migration creating exactly the 12 missing objects (0005/0006 content), re-applying 0005's two `create_direct_chat_request` rewrites, and appending `avatar_initials` to `profiles_visible`. Recovery SQL is documented in its header. |
| `scripts/verify-migrations/verify-migrations.mjs` | The 0005/0007 rewrite handler now applies the rewrites based on the **body** rather than the statement text, so a corrective migration that repeats 0005's rewrite leaves an already-rewritten body untouched (same guard the migration itself uses). |
| `docs/migration-equivalence-2026-11-11.md` | Records the reconciliation and its result; the pre-reconciliation state is kept below it. |
| `docs/FASE-2.md` | The "Production is missing the content of 0005 and 0006" item becomes **RESOLVED**. |

### Working-tree hygiene change (not committed)

`supabase/migrations/0001`–`0007` existed as CRLF in the working tree while the committed blobs are LF (`git ls-files --eol` → `i/lf w/crlf`). They were removed and restored from the index so all 14 migration files are `w/lf`. **No migration file content changed** (`git status` clean for `supabase/migrations/`; the diff of that path is empty).

---

## Checks and evidence

| Check | Command / procedure | Result | Evidence |
|---|---|---|---|
| Production ledger before repair | `SELECT version FROM supabase_migrations.schema_migrations` (read-only) + `npx supabase migration list --linked` | **PASS** — exactly 0001–0007 recorded; 0008–0014 local-only | `.superpowers/sdd/migration-reconciliation/ledger-read.mjs` output; CLI JSON `{"local":"0008","remote":""}`… |
| Production ledger after repair | `npx supabase migration list --linked` | **PASS** — 14 local == 14 remote | CLI output (this session) |
| Repair executed no DDL | Read-only catalog dump + full equivalence compare before vs after repair | **PASS** — identical results (same 12 drift findings, same 13 whitespace-only bodies) | `equivalence-report-lmzbaxlojgsdwgcxkmzx.txt` before/after |
| Production equivalence vs files | File inventory of 0001–0014 vs read-only Production catalog dump | **FAIL (12 findings)** — all attributable to 0005/0006; see findings table | `docs/migration-equivalence-2026-11-11.md` (committed); raw dump + report under `.migration-verification/` |
| Staging rebuild | `npx supabase db push --linked` after reset | **PASS** — 0001–0014 applied, no error | CLI output |
| Staging equivalence vs files | Same comparison against staging | **PASS — 0 findings** | `docs/migration-equivalence-2026-11-11.md` (committed) |
| Staging ledger | `npx supabase migration list --linked` | **PASS** — 14 local == 14 remote | CLI output |
| Link-target discipline | `supabase/.temp/project-ref` asserted before and after every link switch and write command | **PASS** — prod → staging → prod, asserted each time | this session's command log |
| CRLF root cause | Read-only `position(<needle> in pg_get_functiondef(...))` on staging | **PASS (reproduced)** — both 0005 needles returned `0`; the stored body contains `\r\n` while the needles are LF-only | `probe-fn.sql`, `fn-raw.json` |
| Guard unit tests | `node --experimental-strip-types --test tests/db-guard.test.ts` | **PASS** — 15/15 | this session |
| Guard live behavior | `node scripts/db-guard.mjs --expect <ref> [--allow-production]` | **PASS** — exit 0 on match (+flag for prod); exit 1 on mismatch or missing flag; exit 2 on usage error; also verified through a directory-junction invocation and from a subdirectory | this session |
| Full test suite | `pnpm test` | **PASS** — 87/87 (72 pre-existing + 15 guard cases) | this session |
| Type check | `pnpm typecheck` | **PASS** — exit 0 | this session |
| Biome on changed files | `npx biome check scripts tests/db-guard.test.ts` | **PASS** | this session |
| Repo-wide lint | `pnpm lint` | **FAIL — pre-existing, not a regression**: ~405 formatting diagnostics in untouched files (CRLF working-tree copies of `src/`, `netlify/`, `package.json`, `tsconfig*.json`). Already tracked as `RISK-004`. Changed files are clean. | this session; `RISK-004` in `.pif/state.md` |

### Verification method (for reproducibility)

Engineer built a parser that reads all 14 migration files into a final-state inventory and diffs it against a read-only catalog dump of the linked project (`npx supabase db query --linked`, every statement a `SELECT`). The tool is committed at `scripts/verify-migrations/` (with `README.md` describing the method and how to read its output); the result of the 2026-11-11 runs is committed at `docs/migration-equivalence-2026-11-11.md`; the raw per-target dumps and reports stay local under `.migration-verification/` (gitignored). Compared: function bodies/signatures/attributes, tables and columns, constraints (named by name; CHECK by count per table; FK/UNIQUE/PK by column set and FK actions), policies (including expression text), triggers, indexes, privileges, RLS enablement, enum types and labels, extensions, views (options, owner, output columns), cron jobs (command **and** schedule), publication membership, function and view ownership, and `app_config` seed rows.

### Findings — Production differed from the migration files (12 objects, all 0005/0006) — RESOLVED

State before the reconciliation; every row was confirmed present afterwards by a
read-only probe and the equivalence comparison now returns 0 findings.

| # | Was missing on Production | Migration | Resolved by |
|---|---|---|---|
| 1 | `public.profiles.username_changed_at` | 0005 | `ADD COLUMN IF NOT EXISTS` |
| 2 | `public.profiles.scheduled_deletion_at` | 0005 | `ADD COLUMN IF NOT EXISTS` |
| 3 | `idx_profiles_pending_deletion` | 0005 | `CREATE INDEX IF NOT EXISTS` |
| 4 | `public.validate_username_change()` | 0005 | `CREATE OR REPLACE FUNCTION` (0005's body verbatim) |
| 5 | trigger `profiles_username_change_validation` | 0005 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` |
| 6 | `public.check_blocked_on_message_insert()` | 0005 | `CREATE OR REPLACE FUNCTION` (0005's body verbatim) |
| 7 | trigger `messages_block_check` | 0005 | `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` |
| 8 | view `public.profiles_blocked` | 0005 | `CREATE OR REPLACE VIEW` + owner/revoke/grant |
| 9 | `public.profiles_visible.avatar_initials` column (Production had 0004's view) | 0005 | `CREATE OR REPLACE VIEW` with 0005's definition (column appended at the end) |
| 10 | `public.create_direct_chat_request` body — 0005's two `pg_get_functiondef()` rewrites | 0005 | guarded `pg_get_functiondef` rewrite (skips when already applied) |
| 11 | `public.schedule_account_deletion()` | 0006 | `CREATE OR REPLACE FUNCTION` (0006's body verbatim) |
| 12 | `public.cancel_account_deletion()` | 0006 | `CREATE OR REPLACE FUNCTION` (0006's body verbatim) |

Privileges were restored to what the files specify: EXECUTE revoked from
`public`/`anon`/`authenticated` on the two trigger functions, and EXECUTE granted
to `authenticated` (and revoked from `public`/`anon`/`service_role`) on the two
deletion RPCs — both confirmed by probe.

Corroboration (`VERIFIED`): `0009_device_fingerprint.sql` header states *"Migration 0005 was never applied to the remote database"*; Production still has 0004's `profiles_visible` definition and the pre-0005 `create_direct_chat_request` body, while 0007's rewrite — which is independent of 0005 — **is** applied.

**Why 0005 is absent on Production (`VERIFIED`):** it was never run there. A read-only probe against Production shows its `create_direct_chat_request` body is LF-clean and still contains **both** of 0005's exact-text needles (`position(...)` = 1522 and 2991), so 0005 would have applied successfully against Production's body — the CRLF defect described below is what blocked 0005 on **staging** (2026-10-23 and the first rebuild attempt), not on Production. 0006 depends on a column that only 0005 creates, so it was never applied either.

**Why this is drift and not a tool artifact:** the same comparison against the freshly rebuilt Staging returns **0 findings** (`VERIFIED`).

---

## Independent review

An independent reviewer (`general` subagent, read-only) reviewed the branch diff
against the migration files. Its blocking findings were addressed:

- the guard's entry-point detection silently exited 0 when invoked through a
  symlink or a Windows directory junction (a caller checking the exit code
  would read that as "passed") — now resolved through `realpathSync`, and
  verified live through a junction;
- the guard resolved the repository root from the working directory, so running
  it from a subdirectory reported a misleading "not linked" — now resolved from
  the script's own location;
- the remediation command the guard printed (`git reset --hard
  supabase/migrations`) is rejected by git — replaced with `git checkout HEAD --
  supabase/migrations`, verified to restore LF endings;
- the CRLF explanation named the wrong files: the needles in 0005/0007 are
  LF-only regardless of those files' own line endings, and what breaks the
  match is CRLF in the body stored by the migration that created the function
  (0003) — the message and the docs now say that;
- the documentation asserted database facts whose only source was untracked
  working notes — the tool (`scripts/verify-migrations/`) and the result
  (`docs/migration-equivalence-2026-11-11.md`) are now committed;
- `docs/FASE-2.md` pointed at a file name that did not exist, and the
  corrective-migration example contradicted the repository's own naming
  convention — both corrected;
- `docs/SUPABASE_CLI.md` forbade committing a project ref while the same
  document and the guard script commit both refs — the rule now targets
  credentials;
- the guard's CLI layer had no test coverage — `parseArgs`/`runCli` are
  exported and covered (exit codes 0/1/2, flag parsing, unknown linked
  project), taking the guard suite from 9 to 15 cases.

The reviewer also confirmed against the migration files that the
`storage.objects` policy count (26), the devices constraint chain
(0004 → 0005 → 0009), the staging pre-state numbers, and the 12-item
production gap list are accurate.

## Risks / open gates

1. **`RISK-001` — ledger desync: RESOLVED.** Production records 0001–0014 plus the corrective migration `20261111103000` (15 versions, local == remote) and `db push` is no longer needed there (`VERIFIED`).
2. **RESOLVED — Production was missing the content of 0005 and 0006 while its ledger claimed them applied.** Closed under Product Owner authorization with the idempotent corrective migration `supabase/migrations/20261111103000_backfill_profile_settings.sql`; the equivalence comparison against Production now returns 0 findings and each of the 12 objects was confirmed present by probe (`VERIFIED`). Production now enforces the username-change cooldown and the message block check, and exposes the account-deletion RPCs, `profiles_blocked` and `profiles_visible.avatar_initials`.
3. **OPEN — `RISK-002` and other milestone-scoped gates remain untouched by this delivery.** No application behavior was exercised; no feature was accepted.
4. **`RISK-004` (repo-wide Biome drift) is pre-existing** and was not addressed; the changed files pass Biome individually.
5. **Staging data was destroyed** (authorized). Storage buckets / Auth email templates on staging still need manual setup (pre-existing item in `docs/staging-migrations-report.md`).
6. **Evidence freshness:** the Production and Staging dumps under `.migration-verification/` were taken 2026-11-11 after the reconciliation; they are valid until the next schema change on either project.
7. **Scope note:** the equivalence tool canonicalizes SQL expressions (casts, parentheses, `IN`↔`= ANY`, interval literals, relation qualification, subquery aliases). Any residual difference would have been reported; none remained. CHECK constraints are verified by count per table (postgres auto-generates names for inline CHECKs), and FK/UNIQUE/PK by column set and FK actions rather than by constraint name; view bodies are verified by output columns + options + owner rather than full text.
8. **Behavioral note:** the reconciliation is schema-level. Two guards now fire on Production for the first time — the username-change cooldown trigger and the blocked-user message check. Engineer verified their presence and definitions, not their runtime behavior against live accounts (the platform is pre-launch, and no application test run was authorized).

## Human verification needed

Do not mark these PASS without confirmation:

1. **Product Owner / developer** to confirm that the commits on `engineering/migration-reconciliation` are merged to `main` (Engineer did not merge; no branch was pushed).
2. Optional manual smoke test of the two newly active guards on Staging or Production (username change within 30 days; message to a blocked user) — Engineer verified the schema, not the runtime behavior.
3. Optional manual smoke test of Staging (rebuilt from scratch) by the developer — Engineer performed only catalog-level verification, not application-level behavior.

## Requested Guardian action

- Audit the evidence above and create `AUD-…` findings; compare against `RISK-001` and the gate table in `.pif/state.md`.
- Propose (or perform, if authorized) the canonical status updates: `RISK-001` → resolved (ledger and content); `G5` (delivery readiness) reconsideration; `TASK-012` state transition. **Engineer has not modified any canonical record.**
- Note that the verification tool (`scripts/verify-migrations/`) and the equivalence result (`docs/migration-equivalence-2026-11-11.md`) are committed, so the DB facts asserted in the documentation have a committed, re-runnable source, and the corrective migration that produced them is in the repository (`supabase/migrations/20261111103000_backfill_profile_settings.sql`).

---

## Supplementary evidence — the CR bytes that blocked 0005 on Staging

Read-only probe run against **Staging** during the rebuild, at the moment its
body had been stored from a CRLF working tree:

```sql
select position(
  E'  IF p_initial_content IS NULL OR btrim(p_initial_content) = '''' THEN\n    RAISE EXCEPTION ''Initial message cannot be empty'';\n  END IF;'
  in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure));
-- => 0   (needle not found)

select substring(pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure)
  from position('p_initial_content IS NULL' in pg_get_functiondef('public.create_direct_chat_request(uuid,text)'::regprocedure))
  for 160);
-- => "p_initial_content IS NULL OR btrim(p_initial_content) = '' THEN\r\n    RAISE EXCEPTION 'Initial message cannot be empty';\r\n  END IF;\r\n…"
```

The `\r\n` in the stored body against an LF-only needle is the whole failure.
The same probe against **Production** returns 1522 and 2991 — both needles
present, body LF-clean — which is why Production's missing 0005 is a
"never applied" gap rather than a CRLF failure.

The committed migration files are LF and `.gitattributes` pins
`supabase/migrations/*.sql text eol=lf`; `scripts/db-guard.mjs` now blocks any
write command while a checked-out migration file contains CRLF, and
`docs/SUPABASE_CLI.md` documents the repair command for a dirty working tree.
