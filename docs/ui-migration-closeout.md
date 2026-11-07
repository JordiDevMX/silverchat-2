# Historical UI migration closeout — Module 5C / TASK-006

**Superseded boundary:** the subsequently authorized [Module 6A](ui-module-6a.md) completes the chat-list family. Counts and evidence below describe the 5C baseline, not the current chat-list or DB harness status.

Completed 2026-11-06 against the approved `83ccc36` baseline on `feat/ui-transplant`. This is cleanup only. The accepted UI and business/data contracts remain intact; no further module or cosmetic work is included. Two separate database concurrency suites could not run because Docker is absent; this is an explicit verification limitation, not a green result.

## Cleanup and retained code

| Area | Result |
|---|---|
| `_ui_reference/` | Authorized deletion of 335 files, 5,392,559 bytes; untracked before deletion |
| `tsconfig.json` | Removed only the reference exclude; resulting content equals HEAD, including existing line endings |
| globals/settings/messages/chat-settings/novedades CSS | Removed 29 selector branches, 28 whole rules and one unused shimmer keyframe; 3,388 bytes removed |
| chats/auth CSS | Comment-only clarifications; total net reduction across all seven CSS files: 3,368 bytes, normalized to LF |
| Entire stylesheets removed | None: all six feature sheets and `app-shell.css` still have live consumers |
| Protected user state | SHA-256 verification of 56 files: root `graphify-out/`, all review fixtures/harnesses/tests, unrelated FAB edit unchanged |
| Dependencies/runtime/backend | No changes |

Removed selectors cover the superseded brand/text-link/sample-message/skeleton styles, old settings row icon/text and brand-mark wrappers, obsolete `.message-audio` wrappers, replaced contact-modal/banner/bio wrappers and old channel-menu layout. The `.message-file` and `.message-contact` branches of their shared rule remain. Static class scanning was checked against actual source/fixture consumers, including dynamic class families and the distinction between `data-slot` names and CSS classes.

The broad global form/header/native-control rules still affect active surfaces. Chat list/creation/swipe and shell rules also remain in use. Retaining these is intentional: finishing the migration does not make every pre-existing selector dead. No speculative stylesheet removal or unrelated redesign was performed.

Every UI primitive file has source or fixture consumers. The 31 exports without external references were retained: Badge/Button types and variants; Card composition parts; ChatMenuItem; Dialog/Sheet Close, Footer, Overlay and Portal; DropdownMenu composition parts; PopoverAnchor; and quickReactionEmoji. Some are used internally, others form the established public composition API. Lack of an external reference alone is insufficient evidence to break that API.

The map's stale chat-list/creation/swipe statuses now say **verified retained presentation**, not newly transplanted. T107/T108 are explicitly preserved providers. Historical donor paths and phase boundaries remain as provenance under a prominent archive notice. There are no executable, lint, script or harness dependencies on the removed reference.

## Final evidence

All 22 browser suites passed both before and after the CSS purge. They are screenshot-free and the harness files are unchanged. Browser runs used local Chrome with Playwright; app suites intercepted HTTP boundaries on an isolated frontend at 5175. These do not claim live Supabase, mail or CAPTCHA acceptance.

| Gate / suite | Result | Evidence |
|---|---|---|
| App TypeScript | GREEN | `pnpm exec tsc --noEmit -p tsconfig.app.json` |
| Project TypeScript | GREEN | `pnpm typecheck` |
| Unit tests | GREEN | `pnpm test`: 72/72 |
| Production build | GREEN | `pnpm exec vite build`: 2,583 modules transformed |
| Scoped Biome | GREEN | Seven changed CSS files; no fixes needed |
| Config Biome | GREEN | `--formatter-enabled=false tsconfig.json`; preserve existing CRLF formatting |
| auth-browser | GREEN | Public/auth/onboarding/session workflows |
| auth-infrastructure-browser | GREEN | Bootstrap/health/lazy-route failures and recovery |
| chats-browser | GREEN | Chat list, filtering, creation, requests and selection |
| messages-browser | GREEN | Paging, scroll, realtime, optimistic send/retry, media and drafts |
| message-actions-browser | GREEN | Actions, search, forwarding, deletion, recording and gestures |
| chat-settings-browser | GREEN | Settings, members, signed media, actions and navigation |
| communities-browser | GREEN | Membership, shared conversation and community surfaces |
| novedades-browser | GREEN | Stories, channels and their existing workflows |
| settings-browser | GREEN | Preferences, profile, privacy, MFA and account flows |
| voice-player-browser | GREEN | Playback lifecycle and audio controls |
| ui-foundation-browser | GREEN | Foundation primitives, themes, keyboard and responsive states |
| primary-fill-browser | GREEN | All 36 combinations; mode-invariant fills and glyph rules |
| conversation-gallery-browser | GREEN | All 36 combinations; timeline and attachment containment |
| interactive-gallery-browser | GREEN | All 36 combinations; interactive messaging surfaces |
| communities-gallery-browser | GREEN | All 36 combinations; community states and disclosure motion |
| stories-gallery-browser | GREEN | All 36 combinations; story surfaces and motion |
| channels-gallery-browser | GREEN | All 36 combinations; broadcast surfaces and interactions |
| settings-gallery-browser | GREEN | All 36 combinations; settings shell/preferences |
| settings-details-gallery-browser | GREEN | All 36 combinations; profile, crop, deletion and recovery |
| chat-settings-gallery-browser | GREEN | All 36 combinations; info/member/contact/media/dialog states |
| auth-gallery-browser | GREEN | All 36 combinations; forms, OTP, infrastructure and reduced motion |
| ui-review-path-browser | GREEN | Clean 5177 restart, fresh browser contexts, aliases and backend guides |
| Additional full-gallery before/after audit | GREEN | 10 sections × 36 combinations; 62,424 element comparisons, 58 computed properties; identical geometry |
| Protected state and whitespace | GREEN | 56-file SHA-256 comparison; `git diff --check` |
| message-actions-concurrency | RED — unavailable | Docker executable/container absent; database script not run |
| novedades-concurrency | RED — unavailable | Docker executable/container absent; database script not run |

The additional temporary comparison script captured all fixture elements with reduced motion before/after cleanup. Chromium serialized the unchanged outer fixture's `margin:auto` as `0px` versus its used `80px` value at desktop width; exact x/width/height matched. Only those two outer margins were normalized after verifying the unchanged author rule and equal geometry. All other computed properties were compared verbatim; no differences remained. This audit supplements the existing interactive/motion assertions, rather than replacing them. It produced JSON only, no images.

An initial Biome invocation including formatting on `tsconfig.json` flagged its existing CRLF line endings. The authorized exclusion removal restores that file to HEAD; changing unrelated formatting would exceed the requested surgical edit. Final CSS formatting/lint and config lint pass separately as recorded above.

## Reproduction

Use the standing [review procedure](ui-feedback-review.md) for manual review. In one terminal, run `pnpm review:ui`; the clean review server remains available at **http://127.0.0.1:5177/**. It redirects to **http://127.0.0.1:5177/tests/ui-foundation.html** and does not host authenticated routes. The user's existing app process on 5173 was left untouched; the isolated 5175 test server was stopped after verification.

For this Windows host, configure the screenshot-free harness runtime:

```powershell
$env:PLAYWRIGHT_MODULE_PATH='file:///C:/Users/Mystic/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs'
$env:CHROMIUM_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:UI_BASE_URL='http://127.0.0.1:5177'
$env:UI_REVIEW_URL='http://127.0.0.1:5177'
$gallerySuites=@('ui-foundation','primary-fill','conversation-gallery','interactive-gallery','communities-gallery','stories-gallery','channels-gallery','settings-gallery','settings-details-gallery','chat-settings-gallery','auth-gallery','ui-review-path')
foreach ($suite in $gallerySuites) {
  node "tests/$suite-browser.mjs"
  if ($LASTEXITCODE -ne 0) { throw "$suite failed" }
}
```

For mocked app regression, launch a separate terminal with:

```powershell
$env:VITE_SUPABASE_URL='https://supabase.test'
$env:VITE_SUPABASE_ANON_KEY='test-anon'
$env:VITE_TURNSTILE_SITE_KEY=''
pnpm dev --port 5175
```

In the harness terminal, retain the Playwright/Chrome variables and run:

```powershell
$env:UI_BASE_URL='http://127.0.0.1:5175'
$env:TEST_ORIGIN='http://127.0.0.1:5175'
$env:TEST_BASE_URL='http://127.0.0.1:5175'
$appSuites=@('auth','auth-infrastructure','chats','chat-settings','communities','novedades','settings','voice-player')
foreach ($suite in $appSuites) {
  node "tests/$suite-browser.mjs"
  if ($LASTEXITCODE -ne 0) { throw "$suite failed" }
}
@'
import fs from 'node:fs';
for (const name of ['messages','message-actions']) {
  const code = fs.readFileSync('tests/'+name+'-browser.mjs','utf8')
    .replaceAll('http://127.0.0.1:5173','http://127.0.0.1:5175');
  try { await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')); }
  catch (error) { console.error(error.message); process.exit(1); }
}
'@ | node --input-type=module
```

The last two suites hardcode 5173; only their origin was adapted in memory to protect the user's running app. Their files and assertions were unchanged. The concurrency scripts separately require Docker and `supabase_db_silverchat-backend-validation`; no database was provisioned or modified during cleanup.

## Migration record and preserved contracts

| Milestone | Verified commit |
|---|---|
| Audit baseline | `d8863d1` |
| Foundation, glow and app shell | `ff3b4eb` |
| Conversation timeline (2A) | `346d1a9` |
| Primary-fill feedback and mode parity | `fa1b03a`, `d621b6f` |
| File-type tiles | `6c15a6b` |
| Interactive messaging (2B) | `6bad65e` |
| Communities (3A), disclosure feedback | `093d38f`, `5d7c3f9` |
| Stories (4A) | `dfa2028` |
| Broadcast channels (3B) | `ad5a272` |
| Settings (4B shell/remainder) | `551328c`, `3b26ad5` |
| Chat settings/info (5A) | `81eacc7` |
| Auth/onboarding/infrastructure (5B) | `83ccc36` |
| Final cleanup (5C) | This TASK-006 commit; hash reported in handoff |

The migration retains current routes/guards/Outlet composition, query keys/RPC payloads, auth/session/MFA behavior, signed media URLs and privacy hooks, realtime and optimistic send/retry semantics, drafts/search/deep links, shared community/channel conversation behavior, theme/accent persistence, keyboard/focus handling and functional timers independent of reduced-motion decoration. No prototype router tree, mock backend or SSR runtime was transplanted. The cleanup does not alter those contracts.
