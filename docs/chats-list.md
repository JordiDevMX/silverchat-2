# Chats list — Prompt 07

The chats list includes migration 0007 (three new RPCs, the mark-read update,
policy relaxation and `manually_unread`), ten feature components, `useChats`
and `useMessageRequests`, seven URL-backed filters, Realtime subscriptions and
local drafts. Supporting components add the shared application navigation and
safe mutation/filter hooks. No composer, chat view, new-chat/group forms,
channel list or community list is implemented.

## Deployment

Apply `supabase/migrations/0007_chat_delete_adjustments.sql` in the Supabase SQL
Editor **after 0001–0006 and before deploying this frontend**. Stop on any error;
the migration is transactional. It has been applied and tested locally only.
Do not rerun already applied migrations. This work does not use `supabase link`
or `supabase db push` against the remote project.

`src/types/database.ts` was generated from the local database with 0001–0007,
using a temporary file and replacing the destination only after successful
generation and validation. Regenerate it from the remote schema after applying
0007, using the working Management API binding and the same temporary-file
pattern. Never overwrite the type file with a failed HTTP response.

The four private Storage buckets (`avatars`, `chat-media`, `story-media`,
`channel-media`) still require developer configuration if not already created.
Chat avatars reuse the existing short-lived signed URL mechanism.

## Database behavior

- `manually_unread` is independent of message receipts. `mark_chat_as_read`
  clears it and marks the user's existing receipts read.
- All four touched user RPCs check MFA and membership/ownership. PUBLIC, anon
  and service-role execution is revoked. Existing restrictive MFA RLS remains.
- Direct deletion hides the chat by removing only the caller's membership.
  A new incoming message in an accepted direct chat restores the canonical
  recipient **before receipt creation**. A blocked message cannot restore it.
  Opening an existing accepted chat from a profile also restores the caller.
- Self deletion requires ownership and cascades to messages. Leaving groups
  uses the existing last-admin promotion / last-member cleanup trigger.
- Requests are added to `supabase_realtime` alongside the specified messages,
  membership and receipt subscriptions: an empty initial request has no message
  event. No private profile or backup-code table is published.

## Query and interaction details

The main query begins at the current user's memberships, embeds active chats,
orders by own pin time and the chat's message time, and applies LIMIT 200.
This corrects the roadmap example's attempt to order a nonexistent root-chat
`pinned_at` column. Child queries batch 50 chat/message/profile IDs and paginate
500 rows at a time to avoid silently losing receipts above PostgREST's row cap.
No service-role key is used in the browser.

Profiles come from privacy views. Receipt status uses the worst state among
recipients; missing or privacy-hidden receipts never imply delivery/read.
Pending recipients cannot SELECT the parent chat, so requests fetch their first
visible message since the current request directly from `messages` under RLS.
The sender's name/profile is resolved separately; no nonexistent FK to the
privacy view is assumed.

Subscriptions listen for authorized new chats and other recipients' receipts,
not just a captured set of current chat IDs. Events coalesce into invalidation
at most once per 100 ms. Successful reconnections, window focus and a 60-second
fallback refetch reconcile missed events. Mutations are optimistic; failures
roll back only affected rows. Partial bulk deletion retains only failed rows
in the confirmation dialog for retry.

Filters, query and selection live in `/chats` search parameters. Search waits
150 ms and applies after the selected filter. Selection supports Shift ranges;
selection changes replace history while filter changes remain navigable with
Back. The global numeric badge counts actual unread receipts in unmuted,
unarchived active chats; manual dots don't invent unread messages.

Draft keys remain `silverchat_draft_{chat_id}`. Values use the specified shape,
with optional `failed`, `pending` and `ownerId`. New writes carry `ownerId` to
isolate accounts. Legacy drafts without an owner are shown only for currently
accessible chats. `createDraftWriter` provides the future composer's 500 ms
writer, explicit flush and cancellation; storage errors return false so the
composer can show a save failure. Same-tab events and cross-tab storage events
refresh previews. Malformed / expired drafts are cleaned up on app-shell mount;
newer drafts override the preview while retaining unread badges. Successful
chat deletion clears that chat's local draft.

The FAB uses a focus-trapped dialog styled as a desktop popover / mobile bottom
sheet. Message yourself is functional and never pins automatically. New chat,
new group, new channel and chat destinations are explicit future-feature
placeholders, as Prompt 08 forms and messaging are outside this plan.

## Verification commands

```sh
pnpm build
pnpm lint
pnpm test:auth
pnpm test:settings
pnpm test:chats
# Against a LOCAL validation database only:
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/chats_list.sql
```

Browser suites require an existing Playwright installation and Chromium. Start
Vite with dummy bindings (these tests intercept auth, HTTP and WebSockets):

```sh
VITE_SUPABASE_URL=https://supabase.test \
VITE_SUPABASE_ANON_KEY=test-anon \
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 127.0.0.1
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright-core/index.mjs node tests/chats-browser.mjs
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright-core/index.mjs node tests/auth-browser.mjs
PLAYWRIGHT_MODULE_PATH=/absolute/path/to/playwright-core/index.mjs node tests/settings-browser.mjs
```

The browser tests verify HTTP query shape, unread pagination, URL filters and
history, search, optimistic rollback, request actions, mocked Phoenix Realtime
events, partial bulk failure, drafts, self-chat creation, touch gestures and
responsive layout. SQL suites verify actual local RLS/RPC/trigger behavior.
Remote HTTP/Realtime behavior still needs the two-account checklist below after
the developer deploys the migration.

Full-repository lint has a pre-existing Biome version mismatch: the locked CLI
is 2.6.2 while the config schema is 2.5.15. Newly enabled Markdown rules report
formatting problems in existing skill and documentation files. Changed source
files are checked separately; this feature does not reformat unrelated files.

## Validation results

- `pnpm build`: passed (TypeScript and Vite).
- Node suites: 45 tests passed (33 auth, 5 settings, 7 chats).
- Local SQL suites: backend foundation, authentication, profile/settings and
  chats list passed. Fixtures roll back; migration 0007 remains applied locally.
- Chromium suites: auth, settings and chats passed. Chat checks include mocked
  HTTP and Phoenix Realtime, optimistic rollback and partial batch failure,
  native mobile touch input, long press, swipes and responsive screenshots.
- Changed-file Biome check: passed. Full `pnpm lint` reports 251 existing
  formatting errors in unrelated files and the config-version notice; it does
  **not** pass. The untouched base reported 252 errors and one warning.
- Remote migration deployment and real two-account HTTP/Realtime checks are
  pending developer execution. No remote schema was changed in this session.

## Developer checklist

- [ ] Apply 0007 after 0001–0006; regenerate remote types safely.
- [ ] See all seven horizontally scrollable filters; each updates URL and list.
- [ ] Search names, usernames, previews and group members within the active filter.
- [ ] Use browser Back to restore the filter; reload to preserve selection.
- [ ] Long-press for 500 ms / right-click / Shift+F10 opens the positioned menu.
- [ ] Pin moves a chat to the top; Favorite appears in Favorites.
- [ ] Mute suppresses numeric badges, including future messages; manual dots remain.
- [ ] Archive disappears from All and appears in Archived.
- [ ] Mark unread shows a dot; Mark read clears the dot and receipt count.
- [ ] Send a request from a second account; it appears above All and Unread.
- [ ] Accept moves the chat into the main list; Decline confirms the 7-day cooldown.
- [ ] Verify empty initial requests appear in Realtime and rejected chats stay absent.
- [ ] Send/read a message on another device; list, badges and checkmarks refresh.
- [ ] Disable receipt sharing for either party; read status is not disclosed.
- [ ] Save a newer draft; preview changes while unread count remains independent.
- [ ] Delete a direct chat; the next incoming unblocked message restores it unread.
- [ ] Leave a group as the last admin; the oldest remaining member is promoted.
- [ ] Delete a self-chat; its messages and local draft are removed.
- [ ] Swipe left for Archive/Mute; right for Pin/Read. Full swipe triggers primary action.
- [ ] Test mobile pull-to-refresh, desktop Refresh and hover actions.
- [ ] Select three chats (including a Shift range), mute/archive/read/delete in bulk.
- [ ] Simulate one failed bulk deletion; only failed items remain for retry.
- [ ] Check keyboard focus/Escape, light/dark themes, English/Spanish and mobile overflow.

## Pitfalls

- Clearing `last_read_at` cannot resurrect read receipts; the manual boolean is
  deliberately separate from the numeric unread count.
- Only active chats belong in the main list. Pending requests live in their
  separate section, and rejected chats stay hidden during the cooldown.
- “Load all” means one MVP result set, bounded to 200 for safety, not unbounded
  loading or infinite scroll. Child-query pagination does not paginate the UI.
- Realtime invalidates query keys instead of merging partially authorized row
  events into derived counts. Optimistic mutations provide immediate feedback.
- `Intl.RelativeTimeFormat({ numeric: 'auto' })` gives “yesterday” / “ayer”.
  Calendar comparisons handle month/year boundaries and daylight-saving days.
- Block is reversible and reuses the existing confirmation; deletion/leave has
  type-specific consequences and a separate confirmation.
- Self-chat membership deletion is prohibited to avoid orphaning notes; only
  the ownership-checked cascading RPC removes it.
- Apply search after the filter to keep results within the user's chosen scope.
- Read drafts synchronously because they are local data and must not wait for
  HTTP. A privacy browser or full storage quota must never crash the list.
