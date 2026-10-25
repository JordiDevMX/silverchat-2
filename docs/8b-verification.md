# Prompt 08b — Message Actions Verification Report

Date: 2026-10-25 · Branch: `verify/8b-message-actions` · Auditor: automated session (ZCode)

## Context loading

Read before auditing: `graphify-out/` (GRAPH_REPORT.md, manifest.json), `docs/FASE-2.md`,
`docs/message-actions.md`, `docs/messages.md` (skimmed via docs index), `.roadmap/08b-message-actions.md`,
`.agents/skills/` index, `supabase/migrations/0010_message_actions.sql`.

Notes that shaped the audit:

- The spec's migration `0009_message_actions.sql` was renumbered: **0009 is the device-fingerprint
  migration; message actions shipped as `0010_message_actions.sql`** (documented in
  `docs/message-actions.md`).
- The implementation uses hardened RPCs instead of raw client writes where the spec sketched direct
  Supabase calls: `set_message_pin`, `set_message_reaction`, `forward_chat_message`,
  `delete_chat_message_for_me`, `can_access_chat_message`. This is a deliberate, documented hardening
  (atomic forward, serialized pin contender check, idempotent reaction upsert) and is treated as
  spec-compliant.
- Per the spec's own recommendation, the MVP renders waveforms as static SVG from `media_peaks`
  plus a native `<audio>` element instead of wavesurfer.js; **no new dependency was added** (per
  `docs/message-actions.md`).

## Phase 1 — Static audit

All expected files exist and are wired in (grep-verified imports). `ReactionsDisplay.tsx` and
`ReplyPreview.tsx` pre-existed from 8a and were extended, as the spec allows.

| File | Exists | Spec-compliant | Wired in |
| --- | --- | --- | --- |
| components/MessageContextMenu.tsx | Y | Y (post-fix separators) | MessageActionsProvider |
| components/ReactionsPicker.tsx | Y | Y (post-fix mine-highlight) | MessageActionsProvider |
| components/ReactionsDisplay.tsx | Y | Y (post-fix count sort) | MessageBubble |
| components/EditMessageModal.tsx | Y | Y* | MessageActionsProvider |
| components/DeleteMessageModal.tsx | Y | Y* | MessageActionsProvider |
| components/ForwardModal.tsx | Y | Y* (max 5 enforced inline) | MessageActionsProvider |
| components/InChatSearch.tsx | Y | Y (debounce 150ms, counter, arrows, persistent local-only note) | chat route |
| components/PinnedMessagesBar.tsx | Y | Y | chat route |
| components/SearchHighlight.tsx | Y | Y (2s highlight; 0.15s fade transition vs keyframes — cosmetic) | MessageList |
| components/ReplyPreview.tsx | Y | Y (composer bar + bubble quote) | Composer, MessageBubble |
| components/VoiceRecorder.tsx | Y | Y (post-fix limit notice) | Composer |
| components/VoicePlayer.tsx | Y | Y (SVG waveform + seek slider + exclusive playback) | AudioMessage, VoiceRecorder |
| hooks/useMessageActions.ts | Y | Y (pin-limit toast on DB error message) | MessageActionsProvider |
| hooks/useReactions.ts | Y | Y (optimistic toggle/replace) | MessageActionsProvider |
| hooks/useInChatSearch.ts | Y | Y | InChatSearch, chat route |
| hooks/usePinnedMessages.ts | Y | Y | PinnedMessagesBar |
| hooks/useVoiceRecorder.ts | Y | Y (webm/opus → mp4 fallback, 5-min auto-stop, all-channel peaks) | Composer, VoiceRecorder |
| hooks/useVoicePlayback.ts + stores/audioStore.ts | Y | Y (exclusive playback via getState) | VoicePlayer |
| hooks/useSearchHighlight.ts | Y | Y | MessageList |
| lib/voicePeaks.ts | Y | Y (40 samples 0-100, trailing samples included) | recorder/player |
| lib/audioMimeType.ts | Y | Y (isTypeSupported webm→mp4) | useVoiceRecorder |
| lib/actionMatrix.ts | Y | Y (edit mine+text/img/video+15min; dfe mine+1h; system none; read-only aware) | Bubble/Menu/Provider |
| MessageBubble.tsx (modified) | Y | Y (3-dot hover, long-press, right-click, quote, forwarded+edited markers, reactions, highlight) | — |
| Composer.tsx (modified) | Y | Y (reply bar, mic when empty) | — |
| MessageList.tsx (modified) | Y | Y (pinned bar mount, scrollToMessage + 2s highlight) | — |
| useRealtimeMessages.ts (modified) | Y | Y — listens `postgres_changes` `message_reactions` `*` (lines 53-57), invalidates messages/pinned/replies | — |

`*` Deviation: RLS-failure feedback for edit/delete/forward is inline `role="alert"` text with
spec-equivalent wording instead of a toast. Behavior is equivalent; left as implemented
(deliberate design, consistent across all action modals).

## Phase 2 — Production schema verification

Production project `lmzbaxlojgsdwgcxkmzx` (read-only checks only):

| Check | Method | Result |
| --- | --- | --- |
| `messages.media_peaks` + `messages.forwarded_from_message_id` columns | PostgREST select via service role (HTTP 200) | **VERIFIED** |
| Trigger `messages_pin_limit` | Not probe-able without mutating production | **PENDING developer** (query 2 below) |
| `message_reactions` in `supabase_realtime` publication | Not probe-able read-only | **PENDING developer** (query 3 below) |

Migration `0010_message_actions.sql` (checked in) contains all three, applied idempotently, and the
local SQL suite `supabase/tests/message_actions.sql` plus `tests/message-actions-concurrency.mjs`
cover the trigger and publication locally (all passing per `docs/message-actions.md`).

For the two pending checks, run in the production SQL Editor:

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'messages_pin_limit';
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions';
```

## Phase 3 — Automated verification

| Check | Result |
| --- | --- |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS (built in ~0.5s) |
| `pnpm lint` | 253 diagnostics — **all formatting-only diffs, pre-existing on `main`** (linter with formatter disabled: 0 errors). Not touched per task constraints. |
| `pnpm test:auth` | 33/33 pass |
| `pnpm test:settings` | 5/5 pass |
| `pnpm test:chats` | 7/7 pass |
| `pnpm test:messages` | 3/3 pass |
| `pnpm test:message-actions` | 5/5 pass |
| `pnpm test:novedades` | 2/2 pass |
| `pnpm test:chat-settings` | 4/4 pass |
| **Total** | **59 / 59 pass, 0 failed** |

## Phase 4 — Manual UI checklist (developer-assisted)

**PENDING — requires the developer.** The 24-item checklist from the task is reproduced in the
final report of this session. Until all 24 items have PASS/FAIL verdicts, the PR is not opened and
8b is not declared complete.

## Phase 5 — Gap analysis

No MISSING or BROKEN features. FASE-2 deferrals do not intersect 8b scope (FASE-2.md only documents
the migration-history repair note). Full matrix (Condensed: Spec = in `.roadmap/08b`, Code =
implemented, Schema = migration 0010 checked in + columns verified, UI = pending Phase 4):

| Feature | Spec | Code | Schema | UI | Verdict |
| --- | --- | --- | --- | --- | --- |
| Context menu (long-press/right-click/3-dot) | Y | Y | n/a | pending | OK |
| Reply (bar + quote + scroll-to-original) | Y | Y | Y | pending | OK |
| Reactions (8 fixed, toggle/replace, realtime) | Y | Y | Y | pending | OK |
| Edit (15-min window, Edited marker) | Y | Y | Y | pending | OK |
| Delete for me / for everyone (tombstone) | Y | Y | Y | pending | OK |
| Copy text | Y | Y | n/a | pending | OK |
| Forward (max 5, Forwarded marker, media reuse) | Y | Y | Y | pending | OK |
| Pin (max 3, bar, Go/unpin) | Y | Y | Y (trigger in 0010) | pending | OK |
| In-chat search (local, counter, 2s highlight, warning) | Y | Y | n/a | pending | OK |
| Voice record (webm/opus→mp4, 5-min cap, peaks) | Y | Y | Y (media_peaks) | pending | OK |
| Voice playback (exclusive, waveform, seek) | Y | Y | n/a | pending | OK |
| Realtime reactions/deletions invalidation | Y | Y | Y (publication in 0010) | pending | OK |

Nine LOW spec deviations were found by audit; four fixed (Phase 6), five accepted as documented:

| # | Deviation | Disposition |
| --- | --- | --- |
| 1 | ReactionsDisplay pills not sorted by count | **FIXED** (sorted desc) |
| 2 | ReactionsPicker does not highlight the user's current emoji | **FIXED** (`mine` prop + `aria-pressed` + CSS) |
| 3 | Context menu lacks section separator before destructive rows | **FIXED** (`<hr>` + CSS) |
| 4 | No notice on 5-minute auto-stop | **FIXED** (`limitReached` state + "Maximum 5 minutes reached" status text) |
| 5 | Edit/delete/forward errors are inline alerts, not toasts | Accepted — equivalent behavior, deliberate pattern |
| 6 | Forward confirm button says "Forward" (count shown separately) | Accepted — cosmetic |
| 7 | PinnedMessagesBar collapsed row shows Go/unpin buttons | Accepted — superset of spec |
| 8 | Menu is floating-near-cursor on both form factors (no mobile bottom sheet) | Accepted — viewport-clamped, keyboard-accessible |
| 9 | Highlight uses 0.15s fade transition instead of 2s keyframe animation | Accepted — highlight still lasts exactly 2s |

## Phase 6 — Fixes applied

- `src/features/messages/components/ReactionsDisplay.tsx` — reaction groups sorted by count desc.
- `src/features/messages/components/ReactionsPicker.tsx` — `mine` prop; current reaction marked
  `aria-pressed` + highlighted.
- `src/features/messages/components/MessageActionsProvider.tsx` — passes the user's current emoji
  to the picker.
- `src/features/messages/components/MessageContextMenu.tsx` — separator before destructive rows.
- `src/features/messages/hooks/useVoiceRecorder.ts` + `VoiceRecorder.tsx` — `limitReached` flag set
  by the 5-minute deadline; UI shows "Maximum 5 minutes reached".
- `src/styles/messages.css` — styles for the new separator and picker highlight.

No new migration required.

## Phase 7 — Final verification

Re-ran after fixes: `pnpm typecheck` PASS · `pnpm build` PASS · `pnpm test:message-actions` 5/5 ·
`pnpm test:messages` 3/3 · Biome lint clean (linter-level) on all changed files.

## Conclusion

**Outstanding issues:** (1) Phase 4 manual UI checklist awaits developer verdicts — 24 items listed
in the session report; (2) two production schema checks (`messages_pin_limit` trigger,
`message_reactions` realtime publication) await developer SQL Editor output; (3) PR intentionally
not opened until both are green. Code, schema-checked-in, and automated verification are complete;
all automated checks pass.
