# Public-Only Reporting & Rebuilt Report Modal Design

**Date:** 2026-11-19
**Branch:** `feat/public-reports-modal`
**Status:** Ready for owner approval (builder check passed)

## Intent & Why

SilverChat's core promise is absolute privacy inside personal conversations: private 1:1 chats, group chats, and invite-only communities must never expose a reporting path that sends private conversation metadata or content to moderators or the operator. However, **public spaces**—specifically public **Channels** and **Public Profiles**—must be moderatable to protect the community from spam, harassment, and abusive content.

Additionally, the existing `ReportModal` had a critical visual defect: a broad input selector in `src/styles/settings.css` (`.settings-dialog input:not([type="checkbox"]):not([type="range"]):not([type="file"])`) omitted `:not([type="radio"])`, stretching native radio inputs to `width: 100%` with text-input padding and rounded borders, producing huge misaligned circles. Beyond fixing that CSS bug, the modal needs a ground-up redesign tailored to SilverChat's visual identity and an integrated option to block the reported user/creator in the same flow.

## Goals, Non-Goals & Anti-Goals

### Goals
- Remove all UI entry points and backend permission for reporting private spaces (`direct` chats, `self` chats, `group` chats, `community_chat`s, and private `ContactProfileModal` dialogs).
- Keep personal **Block** (`user_blocks`) available in private chats and contact modals for individual protection.
- Add **Report** entry points exclusively to public spaces:
  1. **Channels** (for non-owners): in the channel header overflow menu (`ChatOptionsMenu` with `contextType="channel"`) and on `ChannelInfoScreen`.
  2. **Public Profiles** (`/profile/:username`, for other users): on `PublicProfilePage`.
- Rebuild `ReportModal` from scratch with SilverChat's surface/neon design tokens, aligned single-column reason cards, character-counted details field, accessible semantics, and an integrated **Also block user / channel creator** toggle.
- Enforce public-only reporting at the database layer via a new Supabase migration (`reported_channel_id` column, index, column-level privilege updates, and tightened RLS `INSERT` policy on `public.reports`).

### Non-Goals
- Reporting individual messages inside private chats or group chats.
- Moderation admin dashboard / review UI for `public.reports`.
- Reporting invite-only communities (communities are gated by membership, not public discovery).
- Adding new npm dependencies.

### Anti-Goals
- **Never leak channel creator identity:** On channels, the UI and report modal must never reveal the creator's `display_name`, `username`, or profile. Blocking a channel creator must refer to them anonymously ("this channel's creator").
- **Never regress native dialog accessibility:** Keep `MotionOverlay` / `SettingsDialog` (`<dialog showModal()>`, Escape/backdrop handling, focus restoration, `prefers-reduced-motion`).

## Constraints

- **Git & worktree isolation:** All work happens in `.worktrees/feat-public-reports-modal` on branch `feat/public-reports-modal`.
- **Database migrations:** Must use a timestamp-prefixed filename (`YYYYMMDDHHMMSS_public_reports.sql`), remain **LF-only**, be idempotent where applicable, never alter historical applied migrations, and pass `supabase` Postgres best practices (explicit `search_path`, `(SELECT auth.uid())` in RLS, indexed foreign keys).
- **Existing tests & i18n:** Support both English and Spanish (`say` / `t`), and update affected unit/browser/SQL tests so the suite stays green.

## Approaches Considered

1. **Approach A — Frontend-only (use existing `reports` columns):** Move report entry points to channels and public profiles, writing `reported_user_id` (channel owner or profile user).
   - *Trade-off:* Zero DB changes, but cannot record `reported_channel_id` cleanly (and fails when `channels.owner_id` is `NULL`), and leaves `public.reports` RLS open to `reported_chat_id` / `reported_message_id` inserts.
2. **Approach B — Frontend + Supabase Schema/RLS Migration (Selected):** Add `reported_channel_id` + index to `public.reports`, revoke `INSERT` on `reported_chat_id` / `reported_message_id`, tighten `reports_insert_own` RLS to allow only public channels or visible profiles, rebuild `ReportModal` with integrated blocking, and update public/private UI surfaces.
   - *Trade-off:* Requires explicit owner authorization for the schema/RLS migration (granted) and regenerating/updating `src/types/database.ts`, but enforces SilverChat's privacy guarantee at both UI and database boundaries.

## Architecture & Detailed Design

### 1. Database Migration (`supabase/migrations/20261119210000_public_reports.sql`)
- Add `reported_channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE` to `public.reports`.
- Add partial index `idx_reports_reported_channel ON public.reports (reported_channel_id) WHERE reported_channel_id IS NOT NULL` to support FK cascades and lookups without bloating the index.
- Replace column-level `INSERT` privileges on `public.reports` for `authenticated`:
  - `REVOKE INSERT ON public.reports FROM authenticated;`
  - `GRANT INSERT(reporter_id, reported_user_id, reported_channel_id, reason, description) ON public.reports TO authenticated;`
  (Prevents clients from inserting `reported_chat_id` or `reported_message_id`, while leaving existing historical rows intact.)
- Replace `reports_insert_own` policy on `public.reports`:
  - `reporter_id = (SELECT auth.uid())`
  - `reported_chat_id IS NULL AND reported_message_id IS NULL`
  - `reason IN ('spam', 'harassment', 'inappropriate', 'other')`
  - `char_length(coalesce(description, '')) <= 500`
  - `(reason <> 'other' OR char_length(btrim(coalesce(description, ''))) > 0)`
  - Exactly one public target:
    - **Channel:** `reported_channel_id IS NOT NULL AND reported_user_id IS NULL AND EXISTS (SELECT 1 FROM public.channels c WHERE c.id = reported_channel_id AND c.owner_id IS DISTINCT FROM (SELECT auth.uid()))`
    - **Public profile:** `reported_user_id IS NOT NULL AND reported_channel_id IS NULL AND reported_user_id <> (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles_visible p WHERE p.id = reported_user_id)`
- Update `src/types/database.ts` for `reports` (`reported_channel_id: string | null`, plus relationship `reports_reported_channel_id_fkey`).

### 2. Visibility & Entry Points

#### Removed from Private Spaces
- `src/features/chat-settings/lib/chatActions.ts`: Remove `"report"` from `ChatAction` and `getAvailableChatActions(chat)` (both `readOnly` direct chats and active `direct` chats). Keep `"block"` in both.
- `src/features/chat-settings/components/ContactProfileModal.tsx`: Remove the `"Report"` button; keep `"Block"` when `userId !== user?.id`.
- `src/features/chat-settings/stores/uiStore.ts` & `ChatSettingsLayer.tsx`: Remove `"report"` modal state from private chat settings layer (channel/public-profile reporting uses dedicated local modal state or a shared `ReportModal` component).

#### Added to Public Spaces
- **Channels (`src/features/novedades/components/channels/` & `chatActions.ts`):**
  - Add `"report"` to `ChannelAction` and `ChannelActionContext` (`isOwner: boolean`).
  - `getAvailableChannelActions(context)` appends `"report"` when `!context.isOwner`.
  - `ChatOptionsMenu` renders `"Report channel"` / `"Reportar canal"` with `Flag` icon (marked `destructive` or separated cleanly) when `contextType === "channel"`.
  - `ChannelHeader.tsx` & `ChannelInfoScreen.tsx`:
    - When `c.owner_id !== user?.id`, `ChannelInfoScreen` renders a `SettingsRow` with `Flag` icon for `"Report channel"` / `"Reportar canal"`.
    - Both `ChannelHeader` and `ChannelInfoScreen` can open `ReportModal` targeting `{ kind: "channel", channelId: c.id, name: c.name, slug: c.slug, blockUserId: c.owner_id && c.owner_id !== user?.id ? c.owner_id : null }`.
- **Public Profiles (`src/routes/profile.$username.tsx` & `src/features/settings/hooks/usePublicProfile.ts`):**
  - When `p.id !== user?.id`, `PublicProfilePage` renders a secondary `"Report"` / `"Reportar"` button (with `Flag` icon) next to `"Send message"`.
  - Clicking opens `ReportModal` targeting `{ kind: "user", userId: p.id, name: p.display_name ?? p.username ?? "", username: p.username ?? "", blockUserId: p.id }`.

### 3. Rebuilt `ReportModal` UI & Behavior

#### Component API (`src/features/chat-settings/components/ReportModal.tsx` or `src/components/ui/` + feature adapter)
- Keep `ReportModal` in `src/features/chat-settings/components/ReportModal.tsx` (or `src/features/reporting/` — keeping `ReportModal.tsx` or moving cleanly with clear adapter hooks; keeping `useSubmitReport` in `chat-settings` or a clean shared module so both `novedades` and `settings` import cleanly without circular deps). Specifically:
  - Target union type:
    - `{ kind: "channel"; channelId: string; name: string; slug?: string | null; blockUserId?: string | null }`
    - `{ kind: "user"; userId: string; name: string; username?: string | null; blockUserId?: string | null }`
  - Props: `{ target: ReportTarget; onClose: () => void; onSubmitted?: (result: { blocked: boolean }) => void }`

#### Visual & Structural Redesign
1. **CSS Root-Cause Fix (`src/styles/settings.css`):**
   - Fix `.settings-dialog input:not([type="checkbox"]):not([type="range"]):not([type="file"])` to also exclude `:not([type="radio"])`, preventing native radios from stretching across any settings dialog.
2. **Modal Layout (`MotionOverlay` / `SettingsDialog`, `report-modal` class):**
   - **Header & Close:** Title (`"Report channel"` / `"Reportar canal"` or `"Report user"` / `"Reportar usuario"`) with an accessible top-right `X` icon button (`aria-label={say("Close", "Cerrar")}`).
   - **Target Context Chip (`.report-target-card`):** Compact surface showing a `Flag` badge, the target title (`channel.name` or `user.name`), secondary handle (`@${slug}` or `@${username}`), and a subtle `"Public channel"` / `"Public profile"` pill. Never shows creator identity on channels.
   - **Reason Selection (`<fieldset>` + `<legend>`):**
     - Single-column list (`.report-reason-list`, `gap: 8px`) of 4 `<label className="report-reason-option">` rows.
     - Each row uses a clean 3-zone horizontal flex layout (`align-items: center; gap: 12px`):
       1. Left icon (`16px` Lucide icon matching the category: `Ban`, `ShieldAlert`, `EyeOff`, `MessageSquareWarning`).
       2. Middle text stack (`strong` reason title + `small` 1-line explanation).
       3. Right-aligned fixed `18px × 18px` native `<input type="radio" name="report-reason" />` (`flex: 0 0 18px; width: 18px; height: 18px; margin: 0; accent-color: var(--neon)`). Every radio sits on the exact same vertical axis with identical sizing, alignment, and depth.
     - Selected state highlights via `:has(input:checked)` with subtle `--neon` border/tint (`color-mix(in oklab, var(--neon) 9%, var(--card))`), smooth `150ms` transition, and `prefers-reduced-motion: reduce` support.
   - **Details Field:**
     - `<label>` with dynamic badge (`"Required for Other"` / `"Requerido para Otro"` vs `"Optional"` / `"Opcional"`), `<textarea rows={3} maxLength={500}>`, and `tabular-nums` live counter (`{description.length}/500`).
   - **Integrated Block Option (`.report-block-option`):**
     - Rendered whenever `target.blockUserId` is present and not equal to `user?.id`.
     - Uses SilverChat's `Switch` component (`@/components/ui/switch`) paired with `<label htmlFor={blockSwitchId}>`:
       - For `kind === "user"`: `"Also block ${target.name}"` / `"Bloquear también a ${target.name}"`
       - For `kind === "channel"`: `"Also block this channel's creator"` / `"Bloquear también al creador de este canal"` (strictly anonymous!)
     - Helper text: `"They won't be able to message you, and you won't see their messages."` / `"No podrá enviarte mensajes ni verás sus mensajes."`
     - Default: unchecked (`false`) so blocking is always an explicit opt-in action.
   - **Submission & Partial-Failure Handling:**
     - Submit button (`type="submit"`) inside `<form>` (`method` handled via `onSubmit` with `e.preventDefault()`). Label updates cleanly when block is toggled on (`"Submit report"` / `"Enviar reporte"` vs `"Report and block"` / `"Reportar y bloquear"`).
     - Inserts the report row (`reported_channel_id` for channels, `reported_user_id` for users).
     - If `alsoBlock` is checked and `blockUserId` is set, calls `blockUser(blockUserId, user.id)` and invalidates `["blocked"]`, `["contacts"]`, `["public-profile"]`, `["avatar-url"]`, `["chats"]`.
     - If the report fails, keeps modal open and shows inline `role="alert"` error.
     - If the report succeeds and blocking fails, closes the modal and emits a partial-success notice (`"Report submitted, but blocking failed. You can block them from Privacy settings."`) so the user does not re-submit duplicate reports.
     - If both succeed (or report succeeds without blocking), closes the modal and emits confirmation notice (`useChatUIStore.getState().notify(...)` or inline toast/banner).

## What Is Left to the Builder

- Exact CSS spacing, responsive mobile breakpoints (`<= 640px`), dark/light mode contrast verification, and Lucide icon selection for the four report reasons.
- Refactoring shared notification/feedback rendering on `PublicProfilePage` if `PublicProfilePage` does not mount `ChatSettingsNotice`.
- Updating and expanding unit (`tests/chat-settings.test.ts`), SQL (`supabase/tests/chat_settings.sql`), and browser (`tests/chat-settings-browser.mjs`, `tests/novedades-browser.mjs`, `tests/settings-browser.mjs`) tests.
