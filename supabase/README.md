# SilverChat backend foundation

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

## Verification performed in this cloud instance

The local validation project lives at `/tmp/silverchat-backend-validation`,
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

To repeat against this running local instance:

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

## Remote verification still blocked

No project ref or usable Supabase access token was present. These actual
commands failed before any remote migration was applied:

```text
supabase projects list:
AccessTokenRequiredError: Access token not provided. Supply an access token
by running supabase login or setting the SUPABASE_ACCESS_TOKEN environment variable.

supabase db push --yes:
ProjectRefNotLinkedError: Cannot find project ref. Have you run supabase link?

pnpm db:types:
Supabase CLI usage/help output
ELIFECYCLE Command failed with exit code 1.
```

The existing `db:types` script uses `SUPABASE_PROJECT_ID`; that value is unset.
The installed CLI also exposes `--schema` as required for this invocation.
The script's redirection was restored after failure. `src/types/database.ts`
was subsequently generated successfully from the migrated **local** database
with `--local --schema public`, and formatted using the existing Biome tool.
The package script and dependency files were not changed.

Requirements for `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` were saved
in environment settings. The token's permitted destination is
`api.supabase.com`, which was added to the network draft. Supply values there
securely, review/save the settings and publish the environment configuration
when appropriate. Saving the draft alone does not inject credentials or apply
migrations.

After those bindings are available, link the intended project and inspect its
migration history before pushing. A database password or project database
hostname allowance may also be needed depending on the connection route; test
the existing authentication first. Stop on the first migration error. Only
then regenerate the remote types with `pnpm db:types --schema public` (protect
the existing file from failed redirection), and rerun build/lint. The local
successful checks do not substitute for this remaining remote verification.
