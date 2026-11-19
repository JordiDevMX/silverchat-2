# Chat Growth Card Design

**Date:** 2026-11-19
**Status:** Updated for inline presentation and server-state lifecycle

## Goal
Provide a single reusable inline growth CTA card (`ChatGrowthCard`) rendered inside empty conversations (`channel`, `group`, `community_chat`, and future types via config/adapters) for owners and admins, encouraging them to describe and grow their chat without blocking the header or composer.

## Scope & Architecture
- **Shared module (`src/features/chat-growth/`):**
  - `types.ts`: `SupportedGrowthChatType`, `GrowthChatModel`, `GrowthActionSpec`.
  - `lib/growthConfig.ts`: Pure per-type adapter/config table (`GROWTH_CHAT_CONFIG`), localized title/subtitle/story-text formatters with pluralization, model builders for `channel`, `group`, and `community_chat`, `countUserMessages`, and `shouldShowGrowthCard`.
  - `hooks/useChatGrowthController.ts`: Derives `visible` strictly from role + resolved messages state (`userMessageCount === 0`) and manages the triggered action modals (`StoryCreator`, `AddMembersModal`, `ChannelInviteAdminModal`) plus edit-description navigation.
  - `components/ChatGrowthCard.tsx`: Inline `<section aria-labelledby={titleId}>` region card in normal document flow inside `MessageList` (after `conversation-encryption-pill`, before any system events or `topNotices`). No `<dialog>`, backdrop, close button, or dismissal persistence.
  - `components/ChatGrowthHost.tsx`: Renders the action modals (`StoryCreator`, `AddMembersModal`, `ChannelInviteAdminModal`) when triggered by card buttons.
  - `components/ChannelInviteAdminModal.tsx`: Contact-picker DM invite + copy-link modal for channels (no DB schema changes) and fallback invite flows.

## Lifecycle & Visibility Rules
- Rendered **if and only if**:
  1. Chat type is supported (`channel`, `group`, `community_chat` — never `direct` or `self`).
  2. Viewer is owner or admin (`channel.owner_id === user.id`; group/community `!readOnly && (own.role === "admin" || community role/owner)`).
  3. Messages query has resolved cleanly (`!isPending && !isError`) and has zero user messages (`!hasNextPage && countUserMessages(messages) === 0`, where `type === "system"` events are excluded).
- Cannot be manually dismissed; persists across reloads/navigation until the first non-system message is sent by any participant (reacting immediately to optimistic local sends and realtime `INSERT` invalidations).
- Regular members never see the card.
