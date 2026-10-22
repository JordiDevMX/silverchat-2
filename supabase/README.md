# SilverChat backend foundation

Authentication now adds migration `0004_auth_backup_codes.sql`; see
[authentication deployment notes](../docs/authentication.md). It is locally
validated but has not been applied remotely. The remote results below describe
0001–0003 only. The new local schema has 22 application tables.

Built from roadmap 01, 02, 04a, 04b-1 and 04b-2, after refreshing `main` to
`bf12b71`. No roadmap files from 05 onward were read for this implementation.

## Graphify dependency order

- Backend hubs are `chats` (12 edges), `profiles` (10), unified `messages`
  (8), and `create_direct_chat_request()` (8). The most connected overall
  nodes also include `ChatOptionsMenu` (14) and `useTheme` (11).
- Establish entities and foreign keys before the RLS helpers, privacy view,
  and storage policies; these form the shared profiles/privacy core.
- The chat-request flow requires atomic create/accept/reject RPCs and cooldown
  history. Counters, receipts, and previews depend on the same tables.
- Realtime and cron come after schema/security/business logic. UI, calls,
  offline, stories and community features consume this backend foundation.
  The graph is undirected, so this is an inferred implementation order,
  not a topological ordering of the entire graph.

The locked infrastructure remains Supabase (Postgres/Auth/Storage/Realtime),
LiveKit Cloud, Resend and Netlify. The existing React SPA/tooling remains in
place. This change adds no UI or application dependencies.

## Migrations

| File | Contents |
| --- | --- |
| `0001_initial_schema.sql` | 21 tables, 13 named enums, FKs, checks, indexes, timestamp/signup triggers, nine config rows; RLS enabled immediately |
| `0002_rls_policies.sql` | 13 security helpers, `profiles_visible`, all 58 listed application policies and 13 Storage policies, plus five restrictive policies and a message-update guard |
| `0003_business_logic.sql` | Three policy replacements, channel last-message FK/index, preview helper, seven business trigger functions, 13 RPCs, five Realtime publication members, four cron jobs |

`0004_auth_backup_codes.sql` adds backup codes, device uniqueness, service-only
recovery RPCs, and MFA assurance gates. Apply it separately before deploying auth.

### Resolved inconsistencies in the specs

- 04a names **13 enums**, although the request and 04b-2 summary say 14. No
  unspecified enum was invented. Similarly, 04b-2 actually defines seven
  business trigger functions, although its summary says six.
- `calls.initiator_id` is nullable so its specified `ON DELETE SET NULL` can
  work. Call INSERT policies still require the authenticated initiator, and
  `calls.chat_id` remains mandatory. Account deletion is covered by a test.
- Corrected Markdown corruption in the signup example to `display_name` and
  the valid `user_` username prefix; all definer functions have an explicit
  search path and owner, with default PUBLIC execution revoked.
- PostgreSQL combines permissive UPDATE policies with OR. The two message
  policies alone cannot enforce separate edit/delete windows or prohibit a
  combined edit+delete. An invoker trigger enforces those requirements.
- Column grants prevent clients changing membership IDs/roles, chat status,
  counters, ownership, review state, message timestamps/scopes, and other
  server-managed fields through otherwise valid own-row UPDATE policies.
- Restrictive policies stop clients attaching receipts/reactions/deletions
  or views to inaccessible content. Deleted messages are hidden from
  recipients; senders can still read their own retained row (which also
  allows their direct soft-delete UPDATE to return it).
- Request creation serializes each pair, and responses lock the chat then
  request. Retries retain history, handle a reversal of the requesting user,
  and create a new initial message. Acceptance backfills receipts for pending
  messages sent before the recipient became a member.
- The explicit `stories_delete_own` policy in 04b-1 section 4.13 is retained.
  This conflicts with that document's general "stories never hard-delete"
  statement; its specified table has no soft-delete field.

No later-phase RPCs, UI, ownership transfer, GDPR purge or object-cleanup Edge
Function were added. Storage buckets remain a separately provisioned private
resource, as specified by 04b-1 section 5.2. Cron deletes metadata, not actual
Storage objects. Realtime publication membership was checked; delivery through
an external Realtime subscription was not tested.

## Previous local validation

The local validation project was created at `/tmp/silverchat-backend-validation`,
separate from the application checkout. Its Supabase Postgres version is
15.19.0.004. Docker's `vfs` driver exhausted disk space with normal layered
images; the same official image was imported as one layer after verifying
its manifest and every layer's SHA-256. No project migration ran during those
startup failures. The database then initialized with real Supabase Auth and
Storage schemas.

Each migration was copied into that project's migrations directory and pushed
**separately in numeric order**:

```text
Applying migration 0001_initial_schema.sql...
Finished supabase db push.
Applying migration 0002_rls_policies.sql...
Finished supabase db push.
Applying migration 0003_business_logic.sql...
Finished supabase db push.
```

All three commands exited 0. Subsequent results:

```text
supabase db lint --local --schema public: No schema errors found
backend_foundation.sql: passed_checks = 67; ROLLBACK
local schema TypeScript generation: exit 0
pnpm build: exit 0
pnpm lint: exit 0
```

The SQL tests exercise real authenticated-role permissions, positive and
negative requests, cooldowns, edit/delete limits, receipt privacy, counters,
group admin promotion/deletion, storage RLS, account deletion, and the actual
scheduled cleanup commands. Fixtures and test helpers are rolled back. They
check cron registration and execute the job SQL; they do not wait for the
scheduler's wall-clock execution.

When that local instance is available, repeat its checks with:

```bash
cd /workspace/silverchat-2
export PATH="/workspace/.onboarding-tools/node_modules/.bin:$PATH"
export SUPABASE_HOME=/workspace/.cache/supabase
export SUPABASE_NO_UPDATE_NOTIFIER=1
export SUPABASE_TELEMETRY_DISABLED=1
supabase db lint --local --schema public --workdir /tmp/silverchat-backend-validation

docker exec -i supabase_db_silverchat-backend-validation \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/backend_foundation.sql

# Generate to a temporary file so a CLI failure cannot truncate committed types.
supabase gen types typescript --local --schema public \
  --workdir /tmp/silverchat-backend-validation > /tmp/silverchat-types.ts &&
  pnpm exec biome format --stdin-file-path=database.ts \
  < /tmp/silverchat-types.ts > src/types/database.ts
pnpm build
pnpm lint
```

This local database/process is not evidence of a published environment or of
successful restoration in another cloud task.

## Remote verification

The developer applied migrations `0001_initial_schema.sql`,
`0002_rls_policies.sql`, and `0003_business_logic.sql` in numeric order using
the Supabase SQL Editor and reported that all three succeeded. The SQL files
were left unchanged. No remote `supabase link` or `supabase db push` was run
for this verification, and CLI migration history was not reconciled.

Read-only SQL through the Management API endpoint
`POST /v1/projects/{ref}/database/query` confirmed:

| Check | Actual result | Expected |
| --- | --- | --- |
| Tables in `public` | 21 | 21 |
| Public tables with RLS disabled | 0 rows | 0 rows |
| Matching known enum names | 13 | 13 |
| `app_config` rows | 9 | 9 |
| `cron.job` rows | 4 | 4 |
| `supabase_realtime` publication tables | 5 | 5 |

The cron jobs are `cleanup_expired_stories`, `cleanup_orphan_uploads`,
`cleanup_pending_uploads`, and `cleanup_stale_calls`. The publication contains
`public.calls`, `public.chat_members`, `public.message_receipts`,
`public.messages`, and `public.stories`. All six checks passed; this verifies
schema registration, not remote execution of the earlier local test suite.

### Remote TypeScript definitions

The existing access-token binding works with the Management API even though
the CLI is blocked by environment secret masking. Types were fetched with
`GET /v1/projects/{ref}/types/typescript?included_schemas=public`, validated
in a temporary file, formatted using the existing Biome installation, and
atomically moved to `src/types/database.ts` only after success. No token or
project identifier was written into the repository. The package script and
dependency files were left unchanged.

Compared with the previous local generation, the remote generator adds
PostgREST version metadata (`14.18`), removes `ComputedFields` markers and the
computed `messages.Row.compute_message_preview` pseudo-field, and adjusts
JSON and RPC argument types. The `compute_message_preview` function remains
in `Functions`. No application tables or stored columns were added or renamed.
The formatted type diff contains 93 insertions and 58 deletions.

Validation with these remote definitions completed successfully:

```text
pnpm build: exit 0; TypeScript passed; Vite transformed 153 modules
pnpm lint: exit 0; Checked 22 files. No fixes applied.
```

### Manual follow-ups

A read-only query of `storage.buckets` returned zero rows for the four required
bucket IDs. The developer still needs to create all four as **private** buckets:
`avatars`, `chat-media`, `story-media`, and `channel-media`. Their Storage
policies are already included in the migrations.

Auth email templates still need manual configuration. Cleanup of orphaned
Storage objects remains deferred: existing cron jobs delete metadata and do
not remove the underlying stored files.
