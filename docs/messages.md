# Chat layout, messages and composer (Prompt 08a)

`/chats/:chatId` now opens the conversation, with a fixed header and composer,
paged history, unread positioning, draft persistence and all nine message types.
Group/community mentions, an on-demand emoji picker, single-file previews,
private downloads and image/video viewing are included. Reply previews and
existing reactions are rendered without adding the actions reserved for 08b.

## Deployment

Apply `supabase/migrations/0008_messages_enhancements.sql` **after 0001–0007**,
before deploying this frontend. The complete migration runs in a transaction.
It has been applied and tested against the local validation database only.
The remote database was not linked or pushed; use the SQL Editor or your normal
migration deployment workflow, and stop on any SQL error.

Use the existing private `chat-media` bucket. No new bucket is required.
The existing four-bucket setup remains a developer deployment responsibility.
Generated `src/types/database.ts` reflects the local schema through migration
0008; this is not a claim that 0008 is already installed remotely.

The migration adds:
- `messages.mentions`, a partial GIN index, and member validation for group mentions.
- `media_thumbnail_upload_id`, a private upload FK, plus reference protection and
  thumbnail-aware orphan cleanup. Dimensions and duration stay on `file_uploads`.
- A `(chat_id, created_at DESC, id DESC)` index for stable 50-row pagination.
- `get_chat_messages`, a bounded, read-only RPC that applies membership/pending
  request, MFA and per-user-deletion checks. Deleted rows expose placeholders;
  retained content, contact/location payloads, replies and media references are
  removed from its result. Direct table access keeps its existing stricter RLS.
- Media metadata and Storage reads for pending recipients, restricted to files
  referenced by visible messages. Cleanup cannot remove a referenced upload.
- The `profiles` Realtime publication entry, without broadening profile RLS.

## Integration decisions

- **BFF authentication:** XHR uses the in-memory BFF access token, plus the public
  API key. `supabase.auth.getSession()` is intentionally unused because this SPA
  does not store a Supabase browser session. XHR supplies upload progress and
  `AbortController` cancellation. A failed/expired upload can be retried after
  the normal BFF refresh flow.
- **Private media:** signed URLs expire after five minutes and refresh after four.
  Downloads obtain a fresh URL. URLs are never stored in message rows. Videos
  upload a separately tracked JPEG thumbnail before inserting the message.
- **Compression:** images become WebP, at most 2048 pixels on the longest edge,
  initially quality 0.82, with an enforced output smaller than 200,000 bytes.
  Optional SHA-256 hashing skips files over 20 MiB to limit memory use.
- **Optimistic sends:** temporary UI IDs have a `temp-` prefix and retain a real
  client-generated UUID for insertion and retry. Realtime/refetch results dedupe
  against that UUID. An ambiguous send response is reconciled against the same
  accessible message before retrying. Failed sends keep their uploads for retry.
- **Drafts:** use the existing owner-scoped Prompt 07 shape and 500 ms writer;
  flush on navigation/page exit. The composer clears immediately on enqueue;
  its pending draft is removed only after confirmation. Typing a new draft is
  never overwritten by an older response. Failed text is retained as a draft.
- **Scrolling:** the latest 50 rows load first. Older pages use timestamp plus
  UUID, so equal timestamps do not drop messages. Layout effects adjust the
  scroll offset after React commits a prepend. Deep links and the earliest
  unread message load additional pages as needed; return navigation restores
  a visible message anchor. Incoming messages scroll only near the bottom.
- **Read privacy:** marking requires visible document + bottom position, waits
  one second initially and 500 ms for subsequent messages, and cancels when
  scrolling away or hiding the page. Missing/hidden recipient receipts cannot
  imply delivery or reading. Pending recipients cannot mark the chat read.
- **Presence:** the privacy-filtered `profiles_visible` view is polled every
  30 seconds for direct chats and 60 seconds for groups. Owner-only profile RLS
  prevents using raw profile Realtime events for other users' presence.
- **Live updates:** scoped subscriptions invalidate authoritative queries rather
  than trusting unfiltered payloads. A 30-second reconciliation poll also covers
  updates/deletions that RLS prevents Realtime from delivering. In particular,
  a recipient's deletion placeholder may appear on that next reconciliation.
- **Emoji:** frimousse is a separate lazy chunk. Its data normally comes from
  the Emojibase CDN; a small built-in set remains available offline. Insertion
  preserves the textarea selection. Mentions only complete current group and
  community members and are re-derived from the text before sending.
- **Links:** external message links set `noopener noreferrer nofollow` and open
  in a new tab. Locations use a coordinate-validated Google Maps URL.
- **Later prompts:** call/options buttons are disabled. Contact identity opens
  the existing profile page. New chat/group creation forms, recording, typing,
  reply/edit/delete/forward actions, reaction/sticker pickers, and in-chat search
  remain outside this change.

## Verification

```bash
pnpm build
pnpm test:auth
pnpm test:settings
pnpm test:chats
pnpm test:messages
pnpm lint
```

`pnpm lint` currently includes existing formatting errors in repository skill,
roadmap and documentation files. Check the changed source files separately;
do not treat that baseline as a passing full-project lint run.

The local SQL suite is transactional and rolls its fixtures back:

```bash
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/messages.sql
```

Browser checks use mocked BFF, PostgREST, Storage and Phoenix boundaries, with
real Chromium rendering, image compression and video thumbnail extraction.
They never create remote users, upload to remote Storage, or change remote data.
With Chromium and Playwright already available:

```bash
VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=test-anon \
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 127.0.0.1
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium node tests/messages-browser.mjs
```

The checklist covers initial/unread/deep-link positioning, prepending history,
new-message scrolling, optimistic send/retry, draft restore, mentions,
multiline text, pending request acceptance, self-chat empty state, read delays,
image compression/upload/lightbox, video thumbnails, cancelled upload cleanup,
all message renderers, safe links, offline emoji caret insertion, hidden tabs,
and desktop/mobile layout. Existing auth/settings/chat-list browser suites
remain regression checks. Presence intervals and remote delivery still need
an end-to-end smoke test with two real accounts after remote migration 0008.
