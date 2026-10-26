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

Developer verdicts (2026-10-25): **23 / 24 PASS.**

| # | Item | Verdict |
| --- | --- | --- |
| 1 | Context menu on long-press / right-click | PASS |
| 2 | Context menu on hover 3-dot | PASS |
| 3 | Reply → quote in composer → renders in sent bubble | PASS |
| 4 | React 👍 → pill appears | PASS |
| 5 | Same emoji → pill disappears | PASS |
| 6 | Different emoji → replaces | PASS |
| 7 | Edit → "Edited" marker | PASS |
| 8 | Edit after 15 min not allowed | PASS |
| 9 | Delete for me | PASS |
| 10 | Delete for everyone → tombstone | PASS |
| 11 | Delete-for-everyone after 1h unavailable | PASS |
| 12 | Copy | PASS |
| 13 | Forward to 3 chats with "Forwarded" label | PASS |
| 14 | 6th forward selection blocked | PENDING — see below |
| 15 | Pin 3 → bar shows count | PASS |
| 16 | 4th pin → error | PASS |
| 17 | Bar expands to list | PASS |
| 18 | "Go" → scroll + 2s highlight | PASS |
| 19 | Record → waveform → preview → send | PASS |
| 20 | Exclusive playback A/B | PASS |
| 21 | 5-min auto-stop | PASS |
| 22 | Search counter/arrows/highlight | PASS |
| 23 | Loaded-messages-only note | PASS |
| 24 | Persistence after reopen | PASS |

**Item 14 disposition:** untestable manually — the developer is the only user, so a 6-chat
selection cannot be exercised in production. Verified instead at both enforcement layers:
client-side `ForwardModal.tsx` blocks selection 6 with "You can select at most 5 chats."
(`selected.length < 5` guard), and the `forward_chat_message` RPC rejects
`cardinality(p_chat_ids) > 5` server-side (migration `0010` lines 139-142, also enforcing
distinct chats, covered by `supabase/tests/message_actions.sql`). No manual FAIL was recorded.

## Phase 5 — Gap analysis

No MISSING or BROKEN features. FASE-2 deferrals do not intersect 8b scope (FASE-2.md only documents
the migration-history repair note). Full matrix (Condensed: Spec = in `.roadmap/08b`, Code =
implemented, Schema = migration 0010 checked in + columns verified, UI = developer checklist 23/24 PASS (item 14 see Phase 4)):

| Feature | Spec | Code | Schema | UI | Verdict |
| --- | --- | --- | --- | --- | --- |
| Context menu (long-press/right-click/3-dot) | Y | Y | n/a | PASS | OK |
| Reply (bar + quote + scroll-to-original) | Y | Y | Y | PASS | OK |
| Reactions (8 fixed, toggle/replace, realtime) | Y | Y | Y | PASS | OK |
| Edit (15-min window, Edited marker) | Y | Y | Y | PASS | OK |
| Delete for me / for everyone (tombstone) | Y | Y | Y | PASS | OK |
| Copy text | Y | Y | n/a | PASS | OK |
| Forward (max 5, Forwarded marker, media reuse) | Y | Y | Y | PASS | OK |
| Pin (max 3, bar, Go/unpin) | Y | Y | Y (trigger in 0010) | PASS | OK |
| In-chat search (local, counter, 2s highlight, warning) | Y | Y | n/a | PASS | OK |
| Voice record (webm/opus→mp4, 5-min cap, peaks) | Y | Y | Y (media_peaks) | PASS | OK |
| Voice playback (exclusive, waveform, seek) | Y | Y | n/a | PASS | OK |
| Realtime reactions/deletions invalidation | Y | Y | Y (publication in 0010) | PASS | OK |

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

**Outstanding issues:** (1) two production schema checks (`messages_pin_limit` trigger,
`message_reactions` realtime publication) await developer SQL Editor output — both are present in
checked-in migration 0010 and covered by the local SQL suite; (2) checklist item 14 was verified by
code + server-side inspection instead of manual UI (single-user environment, see Phase 4). Manual
UI verification: 23/24 PASS, 0 FAIL. All automated checks pass. PR opened with these two caveats
documented.
