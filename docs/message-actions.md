# Message actions and voice notes (Prompt 08b)

This adds message menus, reply drafts and quotes, reactions, editing, deletion,
forwarding, local conversation search, pinned messages, and voice recording/playback.
The menus support right-click, a keyboard-accessible ellipsis, and a 500 ms touch
hold that cancels after 10 px of movement. English and Spanish labels follow the
existing preference. Typing indicators, sticker selection, message info, server
search, and multi-message copy remain outside this implementation.

## Deployment

Apply **`supabase/migrations/0010_message_actions.sql` after 0001–0009** through
the Supabase SQL Editor before deploying this frontend. Version 0009 is already
occupied by the device-fingerprint migration. This session applied 0010 only to
the local validation database; it did not change the remote project or run
`supabase link` / `supabase db push`. Stop if applying a migration returns an error.
Do not blindly reapply migrations that are already installed.

The existing private `chat-media` bucket is required. No new bucket, environment
variable, endpoint, or package is needed. Microphone capture requires HTTPS (or
localhost) and browser permission. Test the MP4 recording fallback on a physical
Safari/iOS device before release; automated recording coverage uses Chromium/Opus.

The message fields and RPC typings were generated from the migrated local schema
through a temporary file. The existing remote-derived profile view definitions
were preserved: the older local views have `avatar_initials`, while the checked-in
remote types do not. Regenerate the full file through the Management API after
applying the remote migration, writing to a temporary file and replacing the
checked-in types only after a successful response.

## Database and access rules

- `media_peaks` stores exactly 40 integer samples in 0–100 for recorded audio.
  `forwarded_from_message_id` records the source with an indexed, nullable FK.
  Recorded audio requires completed media and a duration of 1–300 whole seconds.
- `set_message_pin` serializes contenders on the parent chat before updating a
  message. The trigger counts all live pins, including messages hidden by a
  viewer's personal deletions, and rejects the fourth pin. This prevents the
  race inherent in a client-side count. The ordinary authenticated role gains
  no unrestricted pin-update permission.
- `set_message_reaction` uses the existing `(message_id, user_id)` primary key
  and an upsert, with explicit desired emoji or null for removal. Client retries
  cannot accidentally toggle a committed result back on. Membership, MFA,
  deleted/system messages and personal visibility are checked server-side.
- `forward_chat_message` validates 1–5 distinct active, unarchived destination
  memberships, source access, and the existing block trigger. The batch is
  atomic. Stable client UUIDs make an ambiguous-response retry idempotent. It
  copies text, type, location/contact payloads, waveform, and main/thumbnail upload
  references, while clearing reply and mention context. Upload ownership stays
  with the original uploader; no media is uploaded a second time.
- A private Storage SELECT policy grants recipients access through a visible
  shared message reference. Personal deletion removes that reference from the
  viewer's access check. Existing orphan cleanup already protects shared main
  and thumbnail references. Previously issued signed URLs retain their existing
  five-minute lifetime.
- Replies must reference a visible, non-system message in the same chat. Reply
  rows and profiles are fetched in batches rather than one query per bubble.
- Existing owner/time RLS and the update guard enforce the strict 15-minute
  editing and one-hour deletion windows. A new trigger restricts edit types and
  the 500-character caption limit. Client updates request a returned row so an
  RLS update affecting zero rows is treated as a failure.
- `delete_chat_message_for_me` also handles redacted tombstones. The bounded
  history RPC redacts peaks and forward provenance on deleted messages.
- Reaction and personal-deletion tables are included in Realtime idempotently.
  Live changes invalidate history, pins, and reply drafts. The existing 30-second
  reconciliation remains necessary when RLS hides deleted rows from a recipient's
  Realtime subscription; cross-client delete-for-everyone is not guaranteed to
  appear immediately. Local deletion updates optimistically.

## Frontend behavior

`actionMatrix.ts` is pure and applies ownership, timestamps, type, deleted state,
and request read-only state. Local pending/failed outbox messages have no action
menu. Failed mutations restore cached history/pins and refetch authoritative data.
Delete-for-everyone replaces content with a tombstone; delete-for-me removes it.

Search debounces for 150 ms over loaded history only. Its limitation stays visible;
previous/next navigation highlights the target for two seconds. Reply and pin
navigation can load older history. Reply state persists in the existing user-scoped
draft storage, and a successful send clears only the reply it captured.

Voice capture uses `MediaRecorder` (Opus WebM, then MP4), an analyser for live
feedback, and `decodeAudioData` for the final waveform. Peak extraction includes
all channels and trailing samples. Recording auto-stops at five minutes. Discard,
permission failures, and navigation stop microphone tracks, close audio contexts,
clear timers, and revoke preview URLs. A late permission result is discarded if
its recording session was cancelled. Whole-second upload metadata uses ceiling
so a valid short recording does not become a zero-second voice note.

The roadmap's final section recommends static SVG plus native audio over
wavesurfer for MVP; this implementation follows that recommendation and adds no
library. `audioStore.getState()` coordinates audio elements directly without
subscribing React to every playback tick. It stops/resets the previous audio,
handles rejected or late play promises, and releases playback on unmount/end.
The waveform has a keyboard-operable seek slider. The preview and received audio
share the same exclusive-playback mechanism.

## Verification

Run the unit suites, build, and lint:

```sh
pnpm test:auth
pnpm test:settings
pnpm test:chats
pnpm test:messages
pnpm test:message-actions
pnpm build
pnpm lint
```

Apply the migrations to a local validation database, then run the SQL assertions:

```sh
docker exec -i supabase_db_silverchat-backend-validation \
  psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/tests/message_actions.sql
node tests/message-actions-concurrency.mjs
```

The SQL suite rolls back its fixtures. The concurrency test uses two independent
local Postgres sessions and removes its committed fixtures in `finally`. It proves
that contenders for the final pin slot cannot produce four pins. The existing
foundation, authentication, settings, chats, and messages SQL suites also remain
part of the regression check.

Browser checks use Playwright Core and Chromium supplied by the test environment,
with mocked BFF/PostgREST/Storage/Realtime boundaries. They do not replace remote
integration testing. Start Vite with test-only values, then run:

```sh
VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=test-anon \
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 127.0.0.1
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node tests/messages-browser.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node tests/message-actions-browser.mjs
```

Manual release checklist:

- Right-click, keyboard menu navigation, outside-click/Escape, and mobile hold work;
  scrolling does not open a menu, and releasing a hold does not open media.
- Replies survive reload, render quoted context, and navigate to older messages.
- Same reaction removes; another replaces; other users' changes appear live.
- Edit deadlines and media caption limits are enforced even with a stale dialog.
- Personal deletion removes only the viewer's row; global deletion shows a placeholder.
- Forwarding preserves private media/thumbnail/voice payloads in up to five chats;
  retrying a lost response does not duplicate copies.
- Search stays local, shows its limitation, and navigates/highlights each result.
- A fourth pin fails even under concurrent requests; unpinning frees a slot.
- Record, stop, preview, send, discard, slide-to-cancel, permission denial,
  navigation during permission requests, and the five-minute stop all work.
- Starting audio B stops audio A; seeking works with touch and keyboard.
- Verify Safari/iOS MP4 behavior and two real remote users after deploying migration 0010.

Verified in this implementation session: 52 unit tests, all six local SQL suites,
the concurrent-pin test, both conversation/action browser suites, production
build, and lint. Browser coverage includes actual Opus capture/decoding/upload,
late microphone permission cleanup, denied permission, automatic five-minute
stop using the browser clock, and mobile slide-to-cancel. The remote migration
and physical Safari/iOS checks are still pending.
