# Module 6A — chat list, creation and final migration evidence

Baseline: `84df8e5` on `feat/ui-transplant`. The chat-list family now shares the row hierarchy, avatar treatment, metallic surfaces, neon unread badge and dialog motion used by communities, channels and settings. The migration is ready for final manual acceptance. No dependency, backend, schema, auth, RPC or prototype-router changes were made.

## Decisions and contracts

- Historical donors: ChatFilterBar, ChatListItem / ChatListPane, ChatList / ConversationPane and DeleteChatDialog, as recorded in the migration map. The reference directory is gone. Implementation used live `CommunityChatRowContent`, the channel/settings surfaces and existing Badge, Button, Input, Avatar, Skeleton, ChatMenuSurface and SettingsDialog components. No donor was restored or fetched.
- Step A: the direct and group picker routes still owned orchestration. `useNewChatPage` handles contact reuse vs direct requests, search/error coordination and focus; `useNewGroupPage` handles selected IDs, member cap, candidate filtering, validation and submission. The app typecheck passed before changing their presentation. Existing query/mutation hooks, IDs, validation, RPC arguments, failure/retry behavior and navigation remain in place.
- The authenticated row injects the existing signed/privacy-aware Avatar into a provider-free surface. Preview precedence, timestamps, media indicators, receipts, online/blocked state, draft persistence, muted badge exclusions, manual unread dots and 99+ capping are preserved. The list model has a message type and preview, not a typing subscription or attachment MIME record: the gallery shows a real file preview without inventing typing state or inferring a file family from message text.
- Search/filter URLs, browser back, archive/pin/favorite/mute/unread, collapsed requests, URL selection/ranges, bulk retry, self/group/direct creation, optimistic cache updates, realtime refresh and swipe/long-press behavior remain reachable. The menu keeps its chat heading, keyboard entry, mute presets, destructive choices and disabled community deletion. A deliberate pointer press is required to activate a menu item: releasing the opening long press over the mobile sheet cannot accidentally select it. Keyboard/assistive clicks remain supported.
- List reveal and dialog presence use the existing 200ms ease-out treatment; filter/row/swipe feedback is 150ms. Reduced motion is instant. Successful actions/navigation, busy guards, gesture thresholds, hold timers and haptics do not wait for decoration. Restoring a filter scrolls the strip only; it never scrolls the whole page to an offscreen gallery section.

## CSS disposition

The [selector-to-consumer index](ui-css-consumers.md) covers 1,295 branches (1,061 distinct selectors per sheet). Static class scanning distinguishes classes from `data-slot`, includes JSX/utility/template composition and dynamic theme/preview/avatar families, and is supplemented by browser outcomes. It is intentionally conservative about conditional selectors. The chat sheet removed **15** old distinct selectors and added **12** for the new presentation (143 → 140). Obsolete context-menu rules, flat badge styling, fixed-color swipe variants, old empty/chooser button selectors, skeleton span/i rules and the previous dialog backdrop were retired. No complete sheet is empty.

| Sheet | Distinct selectors | Why it remains |
|---|---:|---|
| `chats.css` | 140 | Migrated list/filter/row/picker, requests, swipe rails, selection bar and chooser; also responsive FAB clearance |
| `settings.css` | 250 | Settings shell, profile/account/privacy/MFA controls, shared dialogs/rows and preview states |
| `messages.css` | 206 | Conversation, bubble/media renderers, composer, voice player, search/actions and shared channel/community timeline |
| `chat-settings.css` | 123 | Chat info/members/media/contact screens and shared coordinate menu/mobile sheet |
| `communities.css` | 56 | Community shell, card disclosures, sidebar, info/settings and creation surfaces |
| `novedades.css` | 156 | Story viewer/creator/timer surfaces, channel discovery/follow/info and update layouts |
| `app-shell.css` | 22 | Authenticated shell/nav rail, mobile tabs, constrained conversation/community canvases and floating-action clearance |
| `globals.css` | 108 | Theme/transition tokens; app base; native header/footer/form/label/legend/input/select used by auth, welcome, profile and settings; remaining legacy button classes in conversation retry/request/confirmation controls |

## Evidence

| Gate / screenshot-free suite | Result | Evidence |
|---|---|---|
| App TypeScript | GREEN | `pnpm exec tsc --noEmit -p tsconfig.app.json`, including extraction checkpoints |
| Project TypeScript | GREEN | `pnpm typecheck` |
| Unit tests | GREEN | `pnpm test`: 72/72 |
| Production build | GREEN | `pnpm exec vite build` |
| Scoped Biome | GREEN | Changed TS/TSX/CSS/browser scripts; unrelated FAB excluded |
| `auth-browser` | GREEN | Public/auth/onboarding/session routes |
| `auth-infrastructure-browser` | GREEN | Bootstrap, health, lazy-route recovery |
| `chats-browser` | GREEN | Filters/URL/back, drafts, requests, realtime, range/bulk, optimistic rollback, partial deletion, mobile long press/swipe, direct reuse/request, group selection/validation/retry/payload/navigation |
| `chat-settings-browser` | GREEN | Contact creation, busy locks, members and signed media |
| `communities-browser` | GREEN | Community workflows, shared conversation and membership |
| `novedades-browser` | GREEN | Stories, broadcast channels, realtime and owner workflows |
| `settings-browser` | GREEN | Profile, privacy, account, devices, MFA and theme persistence |
| `voice-player-browser` | GREEN | Real player lifecycle/exclusive playback |
| `messages-browser` | GREEN | Paging, realtime, optimistic send/retry, drafts and renderers |
| `message-actions-browser` | GREEN | Actions, search, forwarding, audio and gestures |
| `ui-foundation-browser` | GREEN | Primitives, focus, reduced motion, themes and viewport widths |
| `primary-fill-browser` | GREEN | Mode-invariant fills/glyphs across 36 combinations |
| `chat-list-gallery-browser` | GREEN | All 11 frames contained at all 36 combinations; row/filter/picker/toolbar/dialog behavior, clean entry scroll, reduced motion, zero remote requests |
| `conversation-gallery-browser` | GREEN | Timeline/attachment states × 36 |
| `interactive-gallery-browser` | GREEN | Composer/actions/voice/search × 36 |
| `communities-gallery-browser` | GREEN | Cards/keyboard/disclosure motion × 36 |
| `stories-gallery-browser` | GREEN | Story viewer/creator/replies × 36 |
| `channels-gallery-browser` | GREEN | Channel/follow/owner states × 36 |
| `settings-gallery-browser` | GREEN | Shell/preferences × 36 |
| `settings-details-gallery-browser` | GREEN | Profile/security/deletion/crop × 36 |
| `chat-settings-gallery-browser` | GREEN | Info/contact/members/menu/focus × 36 |
| `auth-gallery-browser` | GREEN | Auth/onboarding/infrastructure × 36 |
| `ui-review-path-browser` | GREEN | Clean `pnpm review:ui` restart on 5177, fresh browser contexts, redirect/aliases/backend guides, zero console/auth requests |
| `message-actions-concurrency` | RED — environment blocked | Missing Docker executable, explicit `SKIPPED` and exit **77**; DB assertions deferred to CI |
| `novedades-concurrency` | RED — environment blocked | Missing Docker executable, explicit `SKIPPED` and exit **77**; DB assertions deferred to CI |

Both concurrency scripts probe `docker --version` and skip only `ENOENT`. A stopped daemon, missing container, SQL error or failed assertion still fails normally. With Docker present, the original setup, two-session contention, assertions and cleanup are unchanged. The skip message is **“SKIPPED: requires Docker — DB-level concurrency tests, unaffected by the UI migration; deferred to CI”**. CI needs Docker and `supabase_db_silverchat-backend-validation` (or its configured override). Exit 77 is a skip, not evidence that DB assertions passed.

Browser commands follow the [5C reproduction procedure](ui-migration-closeout.md#reproduction), with `node tests/chat-list-gallery-browser.mjs` added to the gallery list. The isolated mocked frontend used 5175, including the in-memory origin substitution for the two unchanged suites hardcoding 5173. No screenshots or image artifacts. The user's app on 5173, root graph data and unrelated FAB edit remain untouched.

Manual entry: [chat-list gallery](http://127.0.0.1:5177/tests/ui-foundation.html#chat-list-gallery); [standing checklist and authenticated route procedure](ui-feedback-review.md). Implementation stops here pending user acceptance.
