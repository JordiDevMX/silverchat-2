# Novedades: Stories and broadcast Channels

Prompt 10 adds `/novedades`, `/channels/:channelId`, and
`/channels/:channelId/info`. Stories use a fullscreen modal. Explore links to
`/novedades/explore`, which intentionally reuses Discover without global search.

## Database and deployment

Apply **0012_stories_channels.sql after 0001–0011**, to staging first. Version
0011 is already used by chat settings. The migration is transactional; stop on
any error. Do not alter previously deployed migrations.

The migration adds the story reply FK, follower mute timestamp, private video
thumbnail FK, cursor/reference indexes, seven feature RPCs (six new plus the
hardened `create_channel`), and supporting authorization/Storage amendments.
It preserves the existing messages publication and adjusts the existing orphan
metadata cron job to protect referenced story thumbnails.

`create_story` takes the roadmap's five arguments plus optional
`p_thumbnail_upload_id` and `p_story_id`. The latter is a stable client UUID for
safe retries after a lost response. It locks the caller's profile before
counting active stories, validates text/caption/background/upload ownership,
and requires MFA assurance where applicable. Direct authenticated story INSERT
is revoked so clients cannot bypass the 10-story limit. A matching existing
story ID owned by the caller is returned on retry before the cap check.

`WHERE expires_at > now()` cannot be a PostgreSQL partial-index predicate;
0012 uses `(user_id, expires_at, created_at DESC)` instead. Channel history uses
`(channel_id, created_at DESC, id DESC)` with a matching composite cursor.

Ensure the four existing buckets `avatars`, `chat-media`, `story-media`, and
`channel-media` exist and are **private**. This change does not provision them
remotely. Existing developer-provisioned buckets can be retained. Verify MIME
and size settings permit supported uploads. Video duration is checked from
actual browser metadata before upload and from stored upload metadata in the
RPC; this is not server-side byte inspection/transcoding.

Staging deployment/type generation is pending; see
[novedades-implementation-status.md](novedades-implementation-status.md).

## Behavior and implementation choices

- Stories expire after 24 hours; privacy is enforced by existing story helpers
  plus MFA. The database serializes creations to enforce the 10-active cap.
- Reopening a story uses `ON CONFLICT DO NOTHING` for views; owner views are
  skipped. Only the owner can retrieve the complete viewers list.
- View timers use `requestAnimationFrame`, pause on hold, backgrounding,
  buffering, reply focus and sheets/menus, and resume from elapsed time.
  Images/text advance after five seconds; videos advance on end or at 15 seconds.
- Text supports eight existing avatar gradients, a custom hex color and 200
  characters. Image uploads use the existing WebP compression path. Video
  thumbnails are persisted by upload ID, never an expiring signed URL.
- Story replies create/reuse a direct chat through `create_direct_chat_request`
  before inserting the message/reference. The database checks that the reply is
  directed to the visible story owner. Stable message IDs make retries safe.
- Hard deletion cascades views and nulls reply references while preserving DM
  text. Story uploads are cleaned through the existing reference-aware client
  helper. Cron deletes orphan metadata, **not physical Storage objects**; the
  repository's existing object-cleanup limitation remains. Existing signed
  URLs can remain valid for their five-minute lifetime after privacy changes.
- Channel posts set `channel_id` and leave `chat_id` null under the existing
  exclusive-scope CHECK. ChannelHeader replaces the chat header. MessageList,
  Composer, media upload and message actions remain shared.
- Followers can react with eight emojis and copy text; they cannot compose,
  reply, edit or delete channel posts. Owners retain applicable message actions;
  chat reply/pin controls are omitted because channel conversations/pins are not
  part of this prompt. Verification badges have no user-facing management UI.
- Channel subscriptions use `channel_followers.muted_until`, separate from chat
  memberships. “Always” uses the existing far-future timestamp; no parallel
  boolean is introduced. Muting hides the unread badge. Opening marks read.
- Discover returns the top 20 non-followed channels, paging through ordered
  results so a large follow list does not produce an oversized URL. Search
  filters the already followed/discovered lists and visible story names.
- Stories and lists refetch on focus; viewer lists refetch on reopening.
  Channel views subscribe to messages INSERT scoped to the current channel;
  periodic refresh also reconciles updates/reactions. There are no story or
  channel push notifications.

## Reproduce local checks

```bash
pnpm build
pnpm lint
node --experimental-strip-types --test tests/*.test.ts
node tests/novedades-concurrency.mjs
# For each supabase/tests/*.sql, use psql with ON_ERROR_STOP=1 against LOCAL only.
# The SQL fixtures run in transactions and roll back.
```

Browser tests use Chromium/Playwright already provided by the environment;
`tests/novedades-browser.mjs` also uses the existing ffmpeg binary to generate
short and over-limit video fixtures. No package is installed by these tests.
Start Vite with disposable fake Supabase values, then run:

```bash
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs \
CHROMIUM_PATH=/usr/bin/chromium node tests/novedades-browser.mjs
```

These browser tests exercise the real React UI, codecs, compression, timer,
scrolling and gestures against mocked BFF/PostgREST/Storage/Realtime boundaries.
The SQL suites separately exercise real PostgreSQL RLS, RPCs and Storage policy
checks. Together they are useful local evidence, not an end-to-end staging pass.

## Manual staging release checklist

Use two authenticated users and at least one MFA-enabled account. All items are
still pending against staging, even where corresponding local tests pass.

- [ ] Apply 0012; verify columns/FKs, RPC grants, RLS, private buckets, cron and
  messages publication; regenerate types safely from the remote catalog.
- [ ] Open Novedades with no contact stories, then with contact stories. Confirm
  My story first, unseen before seen, and newest contacts first.
- [ ] Create image + caption, <=15-second video + thumbnail, and text stories;
  reject longer videos; verify eight backgrounds/custom color and 200 chars.
- [ ] Viewer: five-second advance, previous/next, physical-device long press and
  swipe-down, video playback/end/15-second cutoff, caption below media, and pause
  during buffering/background/reply/sheets. Verify camera capture on a phone.
- [ ] Owner viewers sheet, idempotent non-owner views, privacy restrictions,
  replies arriving as a DM with reference, owner hard deletion, expired stories,
  ten-story cap and retry after a lost response.
- [ ] Followed channels/empty state, Discover top 20, optimistic follow, unfollow,
  local search and Explore placeholder.
- [ ] Follower read-only posts and eight reactions; owner text/media/audio posts;
  50-message pagination, real Realtime INSERT, edit/delete/forward behavior.
- [ ] 99+ unread badge, reset on opening, muted badge suppression, unmute.
- [ ] Channel info/create modal: automatic/editable slug, collision handling,
  optional avatar, edit name/slug/description/photo, verified badge display.
- [ ] Delete channel confirmation, posts/followers cascade, redirect to Novedades.
- [ ] Recheck direct/group chats, settings and auth with staging AAL2 sessions.
- [ ] Open PR only after the required manual staging checks pass.
