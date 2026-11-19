# Chat Growth Dialog Design

**Date:** 2026-11-19
**Status:** Approved by owner

## Goal
Provide a single reusable floating CTA dialog (`ChatGrowthDialog`) for owners and admins of empty chats across SilverChat (`channel`, `group`, `community_chat`, and future types via config/adapters), encouraging them to describe and grow their chat without obscuring the header or composer behind it.

## Scope & Architecture
- **Shared module (`src/features/chat-growth/`):**
  - `types.ts`: `SupportedGrowthChatType`, `GrowthChatModel`, `GrowthActionSpec`.
  - `lib/growthConfig.ts`: Pure per-type adapter/config table (`GROWTH_CHAT_CONFIG`), localized title/subtitle/story-text formatters with pluralization, model builders for `channel`, `group`, and `community_chat`, and `shouldAutoShowGrowthDialog(...)`.
  - `lib/dismissal.ts`: Safe per-user, per-chat `localStorage` dismissal persistence (`silverchat:growth-dismissed:<userId>:<type>:<id>`).
  - `hooks/useChatGrowthController.ts`: Coordinates auto-show, once-per-chat dismissal, manual reopen, story sharing, secondary invite flow, and edit-description navigation.
  - `components/ChatGrowthDialog.tsx`: Native `<dialog>` (`showModal()`) with `closedby="any"` + pointerdown/pointerup outside-bounds fallback, `Escape` / `onCancel` handling, top-right close button, focus return, and `overscroll-behavior: contain`.
  - `components/ChannelInviteAdminModal.tsx`: Contact-picker DM invite + copy-link modal for channels (no DB schema changes) and fallback invite flows.
- **Reused existing flows:**
  - `StoryCreator` / `StoryTextEditor` extended with optional `initialMode` and `initialText` props for prefilled `"Share to my status"` (`Compartir en mi estado`).
  - `AddMembersModal` reused for group (`context="group"`) and community (`context="community"`) member addition.
  - `ChannelInfoScreen` (`?edit=1`) and `GroupSettingsScreen` (`?focus=description`) for opening the edit-description flow when clicking the empty-description affordance.
  - `ChatOptionsMenu` and info screens (`ChannelInfoScreen`, `GroupSettingsScreen`) include a reopen action visible only to owners/admins.

## Trigger Rules
- Auto-opens when:
  1. Chat type is supported (`channel`, `group`, `community_chat` — never `direct` or `self`).
  2. Viewer is owner or admin (`channel.owner_id === user.id`; group/community `!readOnly && (own.role === "admin" || createdBy === user.id)`).
  3. Initial messages query has finished without error and `messages.length === 0`.
  4. Not previously dismissed for `(userId, type, chatId)` in `localStorage`.
- Does **not** depend on `follower_count` or `member_count`.
- Regular members never see auto-open or reopen menu/info actions.

## Content & Visuals
1. Centered floating card (`min(400px, calc(100vw - 32px))`) with subtle translucent backdrop (`oklch(0 0 0 / 0.24)` + light blur) so the chat header and bottom composer stay visible behind it.
2. Circular chat avatar (`Avatar` when `avatarUrl` is present; per-type gradient circle fallback icon when absent).
3. Centered title (`Creaste '{name}'` / `You created '{name}'` for creator; `Administras '{name}'` / `You manage '{name}'` for non-creator admin).
4. Centered subtitle (`Canal - {n} seguidor(es)`, `Grupo - {n} miembro(s)`, `Comunidad - {n} miembro(s)`).
5. Description text if present, or accent-colored (`var(--primary)`) interactive button `agregar una descripción` / `add a description` when empty.
6. Two stacked outlined ghost buttons (`background: transparent`, thin `var(--border)` outline, left icon + label):
   - Button 1: `CircleArrowOutUpRight` + `Compartir en mi estado` / `Share to my status`
   - Button 2: `Plus` + `Invitar a administradores` / `Invite admins` (channel), or `UserPlus` + `Añadir miembros` / `Add members` (group/community).
