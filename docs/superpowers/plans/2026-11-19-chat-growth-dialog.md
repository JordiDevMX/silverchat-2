# Chat Growth Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a reusable, accessible, localized `ChatGrowthDialog` for owners and admins of empty channels, groups, and community chats, integrated with real story-sharing, invite/add-member, and edit-description flows.

**Architecture:** A pure config/adapter layer (`src/features/chat-growth/lib/growthConfig.ts` and `dismissal.ts`) drives one shared `ChatGrowthDialog` native `<dialog>` component across `ChannelView`, `Conversation` (`group` and `community_chat`), `ChannelInfoScreen`, and `GroupSettingsScreen`. `StoryCreator` gains optional prefill props, and `ChannelInviteAdminModal` handles channel admin DM/link invites without schema changes.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Lucide React, Tailwind CSS + CSS custom properties, Node test runner + Playwright Chromium browser suites.

**Spec:** `docs/superpowers/specs/2026-11-19-chat-growth-dialog-design.md`

## Global Constraints
- English for all repo artifacts (code, comments, identifiers, tests, commits); bilingual `en`/`es` UI strings via `useMessageText`.
- Never use hardcoded colors for the empty-description accent affordance (`var(--primary)` / `text-primary`).
- Follow native `<dialog>` + `closedby="any"` + outside-click fallback + `overscroll-behavior: contain` guidance.
- Do not modify DB schemas or `graphify-out/`.

## Review Focus
- Populated chats (`messages.length > 0`) or loading/error message states must never flash or auto-open the dialog.
- Regular members (non-owner, non-admin) and `direct`/`self` chats must never auto-open or show reopen menu/info actions.
- Clicking inside dialog padding/gaps or dragging a text selection onto the backdrop must not accidentally dismiss the dialog.
- Long chat names and mobile viewports (`390x844`) must not cause horizontal overflow or clip the header/composer behind the backdrop.
- Existing `tests/novedades-browser.mjs` and `tests/communities-browser.mjs` tests on empty owned/admin chats must handle/verify the auto-shown dialog cleanly without breaking composer interaction.

---

### Task 1: Pure Growth Config, Trigger Logic, and Dismissal Storage (TDD)

**Files:**
- Create: `src/features/chat-growth/types.ts`
- Create: `src/features/chat-growth/lib/growthConfig.ts`
- Create: `src/features/chat-growth/lib/dismissal.ts`
- Test: `tests/chat-growth.test.ts`

**Interfaces:**
- Produces: `SupportedGrowthChatType`, `GrowthChatModel`, `shouldAutoShowGrowthDialog`, `buildChannelGrowthModel`, `buildChatGrowthModel`, `readGrowthDismissed`, `writeGrowthDismissed`, `buildStoryShareText`.

- [ ] **Step 1: Write failing unit tests in `tests/chat-growth.test.ts`** covering `shouldAutoShowGrowthDialog` (owner/admin + empty + ready regardless of follower/member count; regular member blocked; non-empty blocked; loading/error blocked; dismissed blocked; unsupported blocked), `buildChannelGrowthModel` & `buildChatGrowthModel` (title creator vs admin variant, singular/plural subtitles in en/es, empty description flag, channel vs group vs community config), `buildStoryShareText` (<= 200 chars), and `readGrowthDismissed` / `writeGrowthDismissed` (per-user/per-chat isolation + corrupt/throwing storage safety).
- [ ] **Step 2: Run `node --experimental-strip-types --test tests/chat-growth.test.ts`** and verify failure (`ERR_MODULE_NOT_FOUND`).
- [ ] **Step 3: Implement `types.ts`, `growthConfig.ts`, and `dismissal.ts`** with minimal, clean, well-documented functions.
- [ ] **Step 4: Run `node --experimental-strip-types --test tests/chat-growth.test.ts`** and verify PASS.

### Task 2: Chat Options Menu Actions for Reopening Growth Dialog (TDD)

**Files:**
- Modify: `src/features/chat-settings/lib/chatActions.ts`
- Modify: `tests/chat-settings.test.ts`

**Interfaces:**
- Produces: `"grow_chat"` in `ChatAction`, `"grow_channel"` in `ChannelAction`, `ChannelActionContext.isOwner?: boolean`.

- [ ] **Step 1: Update `tests/chat-settings.test.ts`** to assert `"grow_chat"` appears for group/community admins (not members, direct, self, or readOnly) and `"grow_channel"` appears when `isOwner: true` (not for followers/non-owners).
- [ ] **Step 2: Run `pnpm test:chat-settings`** and verify failure.
- [ ] **Step 3: Implement `"grow_chat"` and `"grow_channel"` in `src/features/chat-settings/lib/chatActions.ts`**.
- [ ] **Step 4: Run `pnpm test:chat-settings`** and verify PASS.

### Task 3: Prefilled `StoryCreator` & `StoryTextEditor` + `ChatGrowthDialog` + `ChannelInviteAdminModal` + Styles

**Files:**
- Modify: `src/features/novedades/hooks/stories/useStoryCreator.ts`
- Modify: `src/features/novedades/components/stories/StoryCreator.tsx`
- Modify: `src/features/novedades/components/stories/StoryTextEditor.tsx`
- Create: `src/styles/chat-growth.css`
- Modify: `src/styles/globals.css`
- Create: `src/features/chat-growth/components/ChatGrowthDialog.tsx`
- Create: `src/features/chat-growth/components/ChannelInviteAdminModal.tsx`
- Create: `src/features/chat-growth/hooks/useChatGrowthController.ts`

- [ ] **Step 1: Add optional `initialMode` / `initialText` props to `StoryCreator`, `useStoryCreator`, and `StoryTextEditor`** (preserving all existing behavior when omitted).
- [ ] **Step 2: Create `src/styles/chat-growth.css`** and import it in `src/styles/globals.css` with theme-token-driven card, translucent backdrop, circular avatar fallback, accent empty-description link, two stacked outlined ghost buttons, mobile responsiveness, and `prefers-reduced-motion` support.
- [ ] **Step 3: Implement `ChatGrowthDialog.tsx`** using native `<dialog>` (`showModal()`, `closedby="any"`, pointerdown/pointerup outside fallback, `onCancel`, `X` close button, `aria-labelledby`, circular `Avatar`/fallback, localized title/subtitle/description, two stacked ghost buttons).
- [ ] **Step 4: Implement `ChannelInviteAdminModal.tsx` and `useChatGrowthController.ts`**.

### Task 4: Wire Integration Across Views, Menus, and Info Screens

**Files:**
- Modify: `src/features/chat-settings/components/ChatOptionsMenu.tsx`
- Modify: `src/features/chat-settings/stores/uiStore.ts`
- Modify: `src/features/chat-settings/hooks/useChatSettingsLayer.ts`
- Modify: `src/features/chat-settings/components/ChatSettingsLayer.tsx`
- Modify: `src/features/novedades/hooks/channels/useChannelHeaderActions.ts`
- Modify: `src/features/novedades/components/channels/ChannelHeader.tsx`
- Modify: `src/features/novedades/components/channels/ChannelView.tsx`
- Modify: `src/features/novedades/components/channels/ChannelInfoScreen.tsx`
- Modify: `src/features/chat-settings/components/GroupSettingsScreen.tsx`
- Modify: `src/routes/_authenticated.chats.$chatId.tsx`

- [ ] **Step 1: Wire `ChatOptionsMenu`, `uiStore`, `useChatSettingsLayer`, `ChatSettingsLayer`, `useChannelHeaderActions`, and `ChannelHeader`** for `"grow_chat"` and `"grow_channel"`.
- [ ] **Step 2: Wire `ChannelView.tsx` and `Conversation` (`_authenticated.chats.$chatId.tsx`)** with `useChatGrowthController`, `ChatGrowthDialog`, prefilled `StoryCreator`, and `ChannelInviteAdminModal` / `AddMembersModal`.
- [ ] **Step 3: Wire `ChannelInfoScreen.tsx` and `GroupSettingsScreen.tsx`** with `?edit=1` / `?focus=description` deep-linking plus a `SettingsRow` reopen button for owners/admins.

### Task 5: Full Verification (Build, Lint, Unit Tests, Browser Suites Desktop & Mobile)

**Files:**
- Modify: `tests/novedades-browser.mjs`
- Modify: `tests/communities-browser.mjs` (if needed for empty `General` community chat auto-show)
- Create: `tests/chat-growth-browser.mjs`

- [ ] **Step 1: Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm test`**.
- [ ] **Step 2: Run existing `novedades-browser.mjs`, `chat-settings-browser.mjs`, `chats-browser.mjs`, `conversation-shell-browser.mjs`, `communities-browser.mjs`** against an isolated Vite dev server to see any interactions.
- [ ] **Step 3: Write and run `tests/chat-growth-browser.mjs`** verifying all 3 chat types (`channel`, `group`, `community_chat`) at desktop (`1280x820`) and mobile (`390x844`): auto-show for owner/admin on empty chat (both 0/1 and 100+ members/followers), no auto-show for regular members or non-empty chats, dismissal persistence across reload (X, backdrop click, Escape + focus return), reopen from `ChatOptionsMenu` and info screens, empty-description accent affordance opening edit flow, and both action buttons per type.
- [ ] **Step 4: Re-run `pnpm lint`, `pnpm build`, `pnpm test`, and browser suites after final edit, then inspect `git diff --stat main..HEAD` and commit cleanly.**
