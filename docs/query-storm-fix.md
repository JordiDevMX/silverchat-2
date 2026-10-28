# Novedades query storm — fix report

Branch: `fix/novedades-query-storm` (one commit per fix, on top of
82e08af). Baseline incident: opening `/novedades` fired ~50 requests in
~2 seconds, saturated the Supabase free-tier pool and produced a
10-minute 5xx cascade. This document records the audit, the fixes, and
what remains for developer-assisted verification.

## Phase 1 — baseline audit (code-derived)

The exact per-request count depends on how many story owners and
followed channels exist, so it was derived from the code and matches
the reported incident (~50 with ~20 story owners and ~5 channels):

| Source (before) | Requests on open |
| --- | --- |
| `useStories` story rows + profiles/uploads/views chunks (size 50) | ~4 |
| Story-card media signed URL, one per group (`StoryCard` → `useMediaUrl`) | ~1 per story group |
| Avatar signed URL, one per avatar (`useAvatarUrl`) | ~1 per avatar, **re-signed every 45s** (`refetchInterval: 45_000`, 60s TTL) |
| `useChannels` follows + unread counts (chunked 8-parallel) | ~1 per followed channel |
| `useDiscoverChannels` follows + channel pages | ~2 |
| `mark_story_viewed` | 1 per viewed story, **duplicated** by StrictMode remounts |
| Window focus | `refetchOnWindowFocus: "always"` re-fired the whole page on every tab switch |

After the fixes the same first open issues each request at most once,
repeat opens inside 30s are served entirely from cache, and avatars no
longer re-sign on a timer. The exact before/after counts from DevTools
remain for the developer checklist below.

### B5 audit — `from("profiles")`

All seven direct `profiles`-table usages are the user's **own row**
(fetch/update), which the spec explicitly allows; none were changed:

- `src/lib/auth-provider.tsx:74` — own profile fetch after auth
- `src/lib/auth-provider.tsx:121` — own `last_seen_at` update
- `src/lib/avatar-upload.ts:86` — own `avatar_url` update
- `src/routes/onboarding.pick-username.tsx:43` — own username update
- `src/routes/settings.profile.tsx:88` — own profile update
- `src/routes/settings.profile.social.tsx:41` — own social links update
- `src/features/settings/hooks.ts:30` — own profile (`useProfile`)

Every cross-user read already goes through `profiles_visible`
(15 call sites verified). The incident's 500 on `/rest/v1/profiles` was
the own-profile fetch failing under pool saturation, addressed by the
storm fixes, not by a view change.

### B3 audit — `expiresIn`

`src/features/messages/lib/media.ts` already signed at 300s with
`staleTime`/`gcTime` 240s. The offender was
`src/features/settings/components/shared.tsx` `useAvatarUrl`: 60s TTL +
40s staleTime + 45s refetchInterval.

### B2 audit — `mark_story_viewed`

Only caller: `StoryViewer.tsx` `Segment` mount effect with no guard,
so React StrictMode double-mounting sent the same `p_story_id` twice.

### E4 audit — discover LIMIT 20

`useDiscoverChannels.ts` already returns exactly the top 20
non-followed channels: ordered scan loop with
`result.length < 20` guard and `result.slice(0, 20)`
(`src/features/novedades/hooks/channels/useDiscoverChannels.ts:23-34`).
No change needed.

### E2 audit — server-side video duration

Already enforced by the database. `create_story` in
`supabase/migrations/0012_stories_channels.sql` (lines 42-45) rejects
video uploads whose stored `file_uploads.duration_seconds` is NULL or
outside `BETWEEN 1 AND 15`. **Migration 0013 is therefore not needed;
do not apply one.**

## Fixes (commits)

| Commit | Fix |
| --- | --- |
| `9a86cdc` | B1 — avatar signed URLs cached by path in TanStack Query (staleTime 4 min, refetch interval removed) |
| `2e5385e` | B2 — session-wide `Set` dedupe in `useMarkStoryViewed` + cancellable 500ms delay in the viewer segment |
| `8d52b13` | B3 — avatar signed URL TTL 60s → 300s |
| `d500fbf` | B4 — `staleTime: 30_000` on `useStories`/`useChannels`/`useDiscoverChannels`; focus refetches now staleTime-gated instead of `"always"` |
| — | B5 — audit only; all direct `profiles` queries are own-row and stay |
| `f04491c` | B6 — bounded global retries (2 on 5xx, 0 on 429, 3 otherwise, backoff ≤8s), Zustand outage flag from `QueryCache.onError`, app-shell banner with 15s recovery probe, `focusManager` pause while open |
| `a12a1d3` | B7 — 10s race timeout around `auth-refresh`'s `refreshSession` (clear 503 instead of 30s Lambda timeout) + bounded 20s client fetch |
| — | E2/E4 — already satisfied by existing code, see audits above |

Notes:

- PostgREST error bodies carry SQLSTATE/PGRST codes without an HTTP
  status field, so B6 detects server errors via numeric `status`
  (storage/auth) **or** 5-class codes (`5xxxx`, `PGRST5*`, `XX000`,
  `08006`) — see `src/lib/supabase-health.ts`.
- postgrest-js 2.118 additionally auto-retries 503/520 internally;
  the TanStack-level caps above bound total amplification.
- `useMediaUrl` keeps its 4-minute protective refresh for long-mounted
  components (one request per visible media per 4 min, aligned with the
  5-minute URL lifetime).

## Verification

Automated gates pass on the branch:

- `pnpm typecheck` ✔
- `npx biome check --formatter-enabled=false .` ✔ (the stock
  `pnpm lint` output still contains the ~253 pre-existing CRLF
  formatting diagnostics present on `main`; none are new)
- `pnpm build` ✔
- `node --experimental-strip-types --test tests/*.test.ts` ✔ 59/59

### Developer checklist (required before merge — 13 items)

Automated checks cannot see DevTools network traffic or a real
authenticated session (magic link + TOTP), so these remain to run:

Performance:

1. Open `/novedades` → count supabase.co requests (was ~50; expect each
   item once; repeat opens within 30s → 0)
2. Open 3× consecutively → no 5xx, no timeouts
3. Open, wait 10s, reopen → signed URLs served from cache
4. Open a story → `mark_story_viewed` fires exactly once
5. StoryViewer modal opens in <2s (was ~15s)

Regression:

6. Chats list loads; 7. send message; 8. contact profile modal;
9. chat options menu; 10. create new chat; 11. create new group;
12. settings screens

Auth resilience (B7):

13. Offline mode → "Connection issues" banner appears instead of a 30s
    hang; clearing offline recovers via the probe

## Result

The 13-item checklist requires the developer, so per the task mandate
**the branch is pushed but no PR is opened** until those items pass.
Staging remains desynced (at 0007) and was not touched; production was
not touched.
