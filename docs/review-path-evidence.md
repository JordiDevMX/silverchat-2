# Review-path diagnosis and verification — 2026-11-03

No screenshots or image artifacts were generated. Evidence below comes from fresh Chromium contexts, HTTP responses, document script entries, DOM markers and computed styles. The pre-fix command was exactly `pnpm dev`, with no environment overrides.

## Reproduction before edits

An existing Vite process belonging to this checkout occupied 5173. `pnpm dev` printed “Port 5173 is in use, trying another one…” and started at **http://localhost:5174/**. Both processes were identified as this repository's Vite executable before the old process was stopped.

| Request / condition | Observed result |
|---|---|
| `http://localhost:5174/` | HTML 200; `/src/app/main.tsx`; existing AuthFrame headings “A little more space…” / “Let's reconnect”; POST `/api/auth/refresh` 404 |
| `http://localhost:5174/chats` | HTML 200 with app entry; no redirect; same reconnect frame and auth refresh 404; no migrated brand/FAB markers |
| `http://localhost:5174/communities` | Same app-entry/reconnect/404 outcome |
| `http://localhost:5174/tests/ui-foundation.html` | HTML 200; `/tests/ui-foundation.tsx`; SilverChat, Chats and Message requests headings; 8 combined brand/bubble/FAB markers; computed own-bubble gradient and 24px halo |
| `http://localhost:5173/tests/ui-foundation.html` | Also rendered current fixture markers; stale CSS was **not** reproduced in this run |
| `http://localhost:5174/ui-foundation.html` | HTML 200 but served the SPA fallback `/src/app/main.tsx`, then the reconnect frame; this short path did not select the fixture |
| Fixture opened from disk | Browser document loaded, but `/tests/ui-foundation.tsx` resolved to `file:///C:/tests/ui-foundation.tsx`; CORS blocked the module, `net::ERR_FAILED`, empty React root |
| Fresh HTTP fixture context | Console 404 for `/favicon.ico` (confirmed console location); no explicit favicon existed in the fixture HTML |

The fixture's intentional broken-avatar test requested `/foundation-missing-avatar.png`, which returned HTML 200 and triggered image fallback. This was not the console 404; the favicon was. The existing avatar recovery assertion was left unchanged.

## Authentication hypotheses checked separately

Using the same plain server with browser-only BFF/data mocks:

| State | `/` | `/chats` | `/communities` |
|---|---|---|---|
| Proper logged-out backend response (`401 no_session`) | Existing public landing, “Good conversations need their own space” | Client redirect to `/auth/login`, “Welcome back” | Same login redirect |
| Mocked authenticated session | Client redirect to `/chats` | Chats heading, one navigation, one brand lockup, chat FAB | Communities heading, one navigation, group FAB |

No uncaught runtime errors occurred in these mocked route probes. No real account session or live backend writes were used. The app's guards and authenticated rendering work; bare Vite's missing Netlify functions prevented reaching them in the original instructions.

## Root-cause conclusions

- **Confirmed:** silent port shifting made it easy to keep reviewing a different server.
- **Not confirmed in this run:** old CSS/assets on the still-running 5173 server. Current fixture markers were present on both servers; no unsupported claim that caches caused the missing migration.
- **Confirmed:** opening the app root does not select the fixture. With normal logged-out auth, it is the still-unmigrated public landing (T131); without the auth backend it is the existing reconnect frame.
- **Confirmed:** plain Vite does not serve `/api/auth/*`. Netlify's rewrites/functions are a separate runtime, already described in `docs/authentication.md`.
- **Confirmed:** the short `/ui-foundation.html` path fell through to the SPA, and `file://` cannot execute the fixture's TypeScript module graph.
- **Discarded:** missing MPA registration or a harness-only fixture environment. The exact canonical fixture URL worked on plain Vite with no special environment. The corrected review mode additionally disables .env loading.

## Fixed user journey

After stopping the stale checkout process and the diagnostic servers, ran exactly **`pnpm review:ui`** with no VITE environment overrides. Vite printed **http://127.0.0.1:5177/** and its canonical fixture URL. The review mode uses a separate dependency cache and does not load .env files.

The new `tests/ui-review-path-browser.mjs` navigates each documented review URL in a fresh browser context without auth/data mocks:

| URL on `http://127.0.0.1:5177` | HTTP evidence | Assertions |
|---|---|---|
| `/` | 302 → `/tests/ui-foundation.html` 200 | Real fixture module, 2 brand lockups, 2 bubble surfaces, 4 FAB tiles, closed requests, borderless metallic search, own-bubble halo |
| `/tests/ui-foundation.html` | 200 | Same markers |
| `/ui-foundation.html` | 302 → fixture 200 | Same markers |
| `/ui-review` | 302 → fixture 200 | Same markers |
| `/chats`, `/communities`, `/settings/appearance` | Each 200 | Explicit review-server/backend explanation and working fixture link; no application script mounted |

All seven HTTP journeys had **zero console errors, zero failed HTTP responses, zero uncaught errors, zero auth/app-entry requests and zero external-service requests**. Opening the disk HTML remains unsupported, but now shows a readable startup command and working HTTP link instead of a blank page.

Plain `pnpm dev` was also restarted without environment overrides: it bound to 127.0.0.1:5173, printed the canonical fixture link, and served the canonical and both short fixture URLs with zero console errors. Its root/protected routes still correctly require the separate backend; their known bare-Vite refresh 404 is documented rather than hidden or bypassed.

Starting a second `pnpm dev` while 5173 was occupied exited 1 with “Port 5173 is already in use.” A second `pnpm review:ui` likewise exited 1 for occupied 5177. Neither selected another port.

## Regression verification

- `pnpm exec tsc --noEmit -p tsconfig.app.json`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 69 passed, zero failed.
- `pnpm exec vite build`: passed; production app JS/CSS asset hashes match the previous build. Review middleware applies only to the dev server; the fixture remains outside the production entry.
- Scoped Biome and `git diff --check`: passed.
- New review-path journey and existing foundation harness: passed against the credential-free review server, including 12 theme/accent combinations and responsive/focus checks.
- Existing chats, settings and communities browser harnesses: passed, unchanged, against ordinary Vite using their established mocked-service environment.

No feature source files, auth contracts, existing harness assertions, dependency versions or Module 2 surfaces were changed. Visual acceptance remains the user's review via the verified command, rather than generated screenshots.
