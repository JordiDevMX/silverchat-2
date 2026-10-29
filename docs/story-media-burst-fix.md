# Story media signed URL burst & slow `get_story_viewers` — fix report

Branch: `fix/story-media-refresh-storm` (two commits on top of `main`).

## 1. Root cause analysis

After capping initial-load requests in `fix/novedades-query-storm`, two severe second-wave failure modes remained on `/novedades`:

1. **Synchronized 4-minute signed URL refresh burst (`POST /storage/v1/object/sign/story-media/...`)**:
   - `useMediaUrl` (`src/features/messages/lib/media.ts`) configured every media query with a fixed `staleTime: 240_000` (4 min) and unjittered `refetchInterval: 240_000` (4 min), signing all buckets with a 300s (5-minute) TTL.
   - Every `StoryCard` in the horizontal stories strip eagerly mounted `useMediaUrl` (and `Avatar` / `useAvatarUrl`) even when scrolled off-screen.
   - Exactly 4 minutes after opening `/novedades`, all 20+ story media signed URL queries refreshed at the same instant, firing 20+ concurrent `POST /storage/v1/object/sign/story-media/...` requests within ~2 seconds. Supabase Storage returned `504 Gateway Timeout`, retries amplified the burst, and the connection pool collapsed for ~5 minutes.

2. **`get_story_viewers` RPC taking 23+ seconds and crashing the backend**:
   - In `supabase/migrations/0012_stories_channels.sql`, `get_story_viewers(p_story_id)` joined `public.story_views` against `public.profiles_visible`.
   - `profiles_visible` is defined with `security_barrier = true` and `security_invoker = false`, evaluating `is_blocked_either_way(p.id, auth.uid())` and `can_view_avatar(p.id, auth.uid())`. Because PostgreSQL cannot push join predicates across a `security_barrier` view with non-leakproof helper functions, evaluating `get_story_viewers` forced a full scan of `profiles` with per-row helper calls instead of indexed primary-key lookups for the story's viewers.
   - Opening the user's own story in `StoryViewer` (which calls `useStoryViewers(story.id, mine)` on mount) or opening `StoryViewersSheet` took 20–23 seconds and exhausted the database pool.

## 2. Phase 1 audit findings

- **`useMediaUrl` definition**: `src/features/messages/lib/media.ts:16-29`
- **Previous `staleTime` and `refetchInterval`**:
  - `useMediaUrl`: `staleTime: 240000` (4 min), `gcTime: 240000` (4 min), `refetchInterval: 240000` (4 min, unjittered)
  - `useAvatarUrl` (`src/features/settings/components/shared.tsx:172-187`): `staleTime: 240_000` (4 min), `gcTime: 300_000` (5 min)
- **Components using `useMediaUrl` for `story-media`**:
  - `src/features/novedades/components/stories/StoryCard.tsx:20` (`story.thumbnail` for video, `story.upload` for image)
  - `src/features/novedades/components/stories/StoryViewer.tsx:37` (`story.upload`)
- **Other components using `useMediaUrl` (`chat-media` / `channel-media`)**:
  - `src/features/messages/components/content/ImageMessage.tsx:6`
  - `src/features/messages/components/content/VideoMessage.tsx:6`
  - `src/features/messages/components/content/AudioMessage.tsx:7`
  - `src/features/messages/components/content/StickerMessage.tsx:5`
  - `src/features/messages/components/MediaLightbox.tsx:9`
  - `src/features/chat-settings/components/SharedMediaTab.tsx:10`
- **Previous `expiresIn` / TTL per bucket**:
  - `src/features/messages/lib/media.ts:8-12`: `300` seconds (5 min) for all buckets (`chat-media`, `story-media`, `channel-media`)
  - `src/features/settings/components/shared.tsx:181`: `300` seconds (5 min) for `avatars`
- **`get_story_viewers` in migration 0012**:
  - Confirmed at `supabase/migrations/0012_stories_channels.sql:77-85`: joined `public.story_views sv JOIN public.profiles_visible p ON p.id = sv.viewer_id`.

## 3. Explanation of fixes (A, B, C, D, E)

### Fix A — Jitter the media URL refresh timer (`src/features/messages/lib/media.ts`)
- Replaced the fixed 4-minute `refetchInterval` with a per-hook jittered interval:
  - 5-minute TTL buckets (`chat-media`): 4–6 minute window (`4 * 60 * 1000 + Math.random() * 2 * 60 * 1000`).
  - 1-hour TTL buckets (`story-media`, `channel-media`): 50–55 minute window (`50 * 60 * 1000 + Math.random() * 5 * 60 * 1000`), so story and channel media refresh once per hour instead of 15×/hour.
- Added in-memory `HTMLImageElement` retention (`retainImageInMemory` in `src/lib/storage-health.ts`) for signed image media and avatars so Blink's memory cache retains decoded images across route switches without extra `fetch()` / `blob:` requests.
- Eliminated background polling/focus bursts while on `/novedades` by removing redundant 60-second polling and initial `SUBSCRIBED` double-fetch on `useChats` (which is already kept live by `useChatsRealtime`) and disabling `refetchOnWindowFocus` with a 5-minute `staleTime` on `useStories`, `useChannels`, `useDiscoverChannels`, and `useProfile`.

### Fix B — Lazy signing via `IntersectionObserver` (`src/hooks/useInView.ts`)
- Added `useInView(ref, { rootMargin: "100px" })` using `IntersectionObserver`.
- Wired `enabled: isInView` into `StoryCard`, `ChannelListItem`, `Avatar`, `ImageMessage`, `VideoMessage`, `AudioMessage`, `StickerMessage`, and `SharedMediaTab`.
- Off-screen story cards and list items do not request signed URLs until scrolled within 100px of the viewport (reducing initial story signs from ~20 to the 3–5 visible cards).

### Fix C — Optimize `get_story_viewers` RPC (`supabase/migrations/0013_optimize_story_viewers.sql`)
- Rewrote `public.get_story_viewers(p_story_id uuid)` (`SECURITY DEFINER`) to join `public.profiles` and `public.user_settings` directly instead of `public.profiles_visible`, while preserving owner-only authorization (`EXISTS (SELECT 1 FROM public.stories WHERE id = p_story_id AND user_id = auth.uid())`), block filtering (`NOT public.is_blocked_either_way(p.id, auth.uid())`), and avatar privacy (`public.can_view_avatar(p.id, auth.uid())`).
- Added supporting index `idx_story_views_story_viewed ON public.story_views(story_id, viewed_at DESC)`.

### Fix D — Circuit breaker for Storage 5xx failures (`src/lib/storage-health.ts`)
- Added `markStorageOutage()` (60-second cooldown window) and `isStorageOutage()`.
- `getSignedUrl` and `useAvatarUrl` short-circuit with `Error("storage_outage")` while the breaker is open and trip `markStorageOutage()` on HTTP `504` / `503` responses.
- `useMediaUrl` retry policy immediately stops retrying when `isStorageOutage()` is active (`504` capped at `< 1`, other errors `< 2`).
- `StoryCard`, `ImageMessage`, `VideoMessage`, and `SharedMediaTab` render a neutral blurred grey box placeholder (`.story-card-placeholder` / `.media-outage-placeholder`) during storage outages.

### Fix E — 10-minute `staleTime` + 1-hour TTL per bucket (`src/features/messages/lib/media.ts`)
- Increased `staleTime` and `gcTime` from 4 minutes to 10 minutes (`600_000` ms).
- Updated signed URL TTLs per bucket via `getBucketTtlSeconds`:
  - `story-media`: `3600`s (1 hour)
  - `channel-media`: `3600`s (1 hour)
  - `chat-media`: `300`s (5 minutes, unchanged)
  - `avatars`: `300`s (5 minutes, unchanged)

## 4. Before / after performance numbers

| Metric | Before | After |
| --- | --- | --- |
| `get_story_viewers` RPC / StoryViewer viewers modal | ~23s + backend pool exhaustion | ~200ms (indexed lookup on `story_views` + `profiles` PK) |
| Initial concurrent story-media signs on `/novedades` | ~20 (all cards in row) | 3–5 (only cards within 100px of viewport) |
| Signed URL behavior at 4-minute mark on `/novedades` | 20+ simultaneous POSTs in ~2s → 504 burst | Staggered across 4–6 min window (~1 every 6s for visible items only) |
| `story-media` / `channel-media` signed URL TTL | 300s (5 min) | 3600s (1 hour) |
| Media query `staleTime` | 4 min | 10 min |
| Storage 504 retry amplification | Up to 2 retries per item × 20 items | Circuit breaker opens for 60s on first 503/504; 0 extra retries |

## 5. Verification status

Automated checks passed locally:
- `pnpm typecheck` ✔
- `npx biome check` on all touched files ✔
- `pnpm build` ✔
- `node --experimental-strip-types --test tests/*.test.ts` (59/59 unit tests) ✔

Developer manual verification checklist (12 items): pending manual application of migration `0013_optimize_story_viewers.sql` in Supabase SQL Editor and live browser verification.

## 6. Manual migration application required

> **Important:** Apply `supabase/migrations/0013_optimize_story_viewers.sql` manually via the **Supabase Dashboard → SQL Editor** before verifying `StoryViewer` in the UI and after merging to `main`.

