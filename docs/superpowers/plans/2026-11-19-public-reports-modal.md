# Public-Only Reporting & Rebuilt Report Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict reporting strictly to public spaces (Channels and Public Profiles) across both UI and Supabase RLS, remove reporting from private chats while keeping personal blocking, and rebuild `ReportModal` from scratch with aligned reason cards and an integrated block-user option.

**Architecture:** A new timestamped Supabase migration adds `reported_channel_id` to `public.reports`, revokes `INSERT` on private chat/message columns, and restricts `reports_insert_own` to public channels and visible profiles. On the frontend, `chatActions` removes `"report"` from private chat menus and adds `"report"` to non-owner channel menus; `ChannelHeader`, `ChannelInfoScreen`, and `PublicProfilePage` host a rebuilt `ReportModal` (using `MotionOverlay`/`SettingsDialog`, `Switch`, and fixed CSS radio inputs) that supports optional anonymous-safe creator/user blocking.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, Zustand, Tailwind CSS + SilverChat CSS tokens, Supabase Postgres/RLS, Node `node:test`, Playwright (`playwright-core`).

**Spec:** `docs/superpowers/specs/2026-11-19-public-reports-modal-design.md`

## Global Constraints

- Work only inside `.worktrees/feat-public-reports-modal` on branch `feat/public-reports-modal`.
- Never reveal a channel creator's identity (`display_name`, `username`, or profile) anywhere in channel UI or channel report flows.
- Migration files under `supabase/migrations/` must use LF line endings only and timestamped filenames (`YYYYMMDDHHMMSS_<name>.sql`).
- Keep `MotionOverlay` / `SettingsDialog` native `<dialog showModal()>` semantics, keyboard/Esc/focus behavior, EN/ES localization (`say`/`t`), and `prefers-reduced-motion: reduce`.
- Do not add new npm dependencies.

## Review Focus

- Native `<input type="radio">` elements inside `.settings-dialog` must stay compact (`<= 24px`) and aligned on a single vertical axis across all 4 options (prevent regression of `settings.css` `:not([type="radio"])`).
- Channel report modal when `channel.owner_id` is `null` must omit the block-creator switch without crashing or disabling report submission.
- Submitting a report with "Also block" enabled where `reports` succeeds but `user_blocks` fails must close the modal with a partial-success notice rather than leaving the modal open for duplicate report submission.
- Private direct chats, pending direct requests, groups, and community chats must expose zero report actions in menus or `ContactProfileModal`, while keeping `Block` available.
- Mobile viewports (`375x844` / `390x844`) must have zero horizontal overflow (`scrollWidth <= innerWidth`) inside `ReportModal`, `ChannelInfoScreen`, and `PublicProfilePage`.

---

### Task 1: Supabase Public-Reports Migration, Types & SQL Test Coverage

**Files:**
- Create: `supabase/migrations/20261119210000_public_reports.sql`
- Modify: `src/types/database.ts:1051-1170`
- Modify: `supabase/tests/chat_settings.sql:41-55`

**Interfaces:**
- Produces DB schema: `public.reports.reported_channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE`
- Produces DB index: `idx_reports_reported_channel`
- Produces RLS/privileges: `authenticated` can `INSERT(reporter_id, reported_user_id, reported_channel_id, reason, description)` on `public.reports`; `reports_insert_own` enforces `reported_chat_id IS NULL AND reported_message_id IS NULL` and a single valid public target (non-owned channel or visible non-self user).

- [ ] **Step 1: Write the LF-only migration `supabase/migrations/20261119210000_public_reports.sql`**

Create `supabase/migrations/20261119210000_public_reports.sql` (with `\n` line endings only) to:
1. `ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS reported_channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE;`
2. `CREATE INDEX IF NOT EXISTS idx_reports_reported_channel ON public.reports (reported_channel_id) WHERE reported_channel_id IS NOT NULL;`
3. `REVOKE INSERT ON public.reports FROM authenticated;`
4. `GRANT INSERT (reporter_id, reported_user_id, reported_channel_id, reason, description) ON public.reports TO authenticated;`
5. `DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;` and recreate `"reports_insert_own"` `FOR INSERT TO authenticated WITH CHECK (...)` enforcing `(SELECT auth.uid())`, `reported_chat_id IS NULL`, `reported_message_id IS NULL`, valid `reason` (`'spam','harassment','inappropriate','other'`), `description` length `<= 500` and non-empty when `reason = 'other'`, and XOR target: either existing non-owned channel in `public.channels` (`reported_user_id IS NULL`) or visible non-self user in `public.profiles_visible` (`reported_channel_id IS NULL`).

- [ ] **Step 2: Update `src/types/database.ts` for `reports.reported_channel_id`**

Add `reported_channel_id: string | null` to `reports.Row`, `reported_channel_id?: string | null` to `reports.Insert` and `reports.Update`, and add `reports_reported_channel_id_fkey` relationship referencing `channels`.

- [ ] **Step 3: Expand `supabase/tests/chat_settings.sql` assertions**

Add SQL assertions verifying:
- `INSERT INTO public.reports(reporter_id, reported_chat_id, reason)` is rejected (column privilege / RLS).
- `INSERT INTO public.reports(reporter_id, reported_user_id, reason, description)` for `auth.uid()` (self-report) is rejected.
- `INSERT INTO public.reports(reporter_id, reported_channel_id, reason)` succeeds for a non-owned channel and is rejected for the channel's owner.

- [ ] **Step 4: Verify migration formatting and TypeScript types**

Run: `node --experimental-strip-types --test tests/db-guard.test.ts` and check `findCrlfMigrations` on the repo (`node -e "import('./scripts/db-guard.mjs').then(m => { const c = m.findCrlfMigrations(process.cwd()); if (c.length) throw new Error(c.join(',')); console.log('LF OK'); })"`), plus `npm run typecheck`.
Expected: PASS (`LF OK`, 0 CRLF files, `tsc -b` exits 0).

---

### Task 2: Public-Only Action Matrix & Report Submission Contracts (TDD)

**Files:**
- Modify: `src/features/chat-settings/lib/chatActions.ts:1-85`
- Modify: `src/features/chat-settings/hooks/useReportUser.ts:1-28`
- Modify: `tests/chat-settings.test.ts:40-97`

**Interfaces:**
- Produces `ChatAction` (without `"report"`), `getAvailableChatActions(chat: ChatDetails): ChatAction[]`
- Produces `ChannelAction` (with `"report"`), `ChannelActionContext` (`{ following: boolean; canSearch: boolean; hasLink: boolean; isOwner?: boolean }`), `getAvailableChannelActions(context: ChannelActionContext): ChannelAction[]`
- Produces `ReportTarget` (`{ kind: "channel"; channelId: string; name: string; slug?: string | null; blockUserId?: string | null } | { kind: "user"; userId: string; name: string; username?: string | null; blockUserId?: string | null }`)
- Produces `buildReportPayload(reporterId: string, target: ReportTarget, reason: ReportReason, description: string)` and `useSubmitReport()` mutation returning `{ blocked: boolean; blockFailed: boolean }`.

- [ ] **Step 1: Write failing unit tests in `tests/chat-settings.test.ts`**

Update and add assertions in `tests/chat-settings.test.ts`:
- `getAvailableChatActions(chat("direct"))` has length `7` and does NOT include `"report"` while still including `"block"`.
- `getAvailableChatActions({ ...chat(), readOnly: true, status: "pending_request" })` equals `["view_profile", "search_in_chat", "block"]`.
- `getAvailableChannelActions({ following: true, canSearch: true, hasLink: true, isOwner: false })` includes `"report"` at the end; when `isOwner: true`, it omits `"report"`.
- `buildReportPayload` sets `reported_channel_id` (and omits/nulls `reported_user_id`) for `kind: "channel"`, and sets `reported_user_id` (and omits/nulls `reported_channel_id`) for `kind: "user"`.

- [ ] **Step 2: Run unit tests to verify RED**

Run: `npm run test:chat-settings`
Expected: FAIL on the updated `getAvailableChatActions`, `getAvailableChannelActions`, and `buildReportPayload` assertions.

- [ ] **Step 3: Implement `chatActions.ts` and `useReportUser.ts` (`useSubmitReport` + `buildReportPayload`)**

Update `src/features/chat-settings/lib/chatActions.ts`:
- Remove `"report"` from `ChatAction` and `getAvailableChatActions`.
- Add `"report"` to `ChannelAction`, `isOwner?: boolean` to `ChannelActionContext`, and return `"report"` in `getAvailableChannelActions` when `!context.isOwner`.
- Export `ReportTarget` and `buildReportPayload` (or place `ReportTarget` + `buildReportPayload` cleanly in `chatActions.ts` so `tests/chat-settings.test.ts` imports pure functions without React/Supabase runtime).

Update `src/features/chat-settings/hooks/useReportUser.ts`:
- Export `useSubmitReport()` accepting `{ target: ReportTarget; reason: ReportReason; description: string; alsoBlock: boolean }`.
- Inserts into `reports` via `buildReportPayload`.
- If `alsoBlock && target.blockUserId && target.blockUserId !== user?.id`, runs `blockUser(target.blockUserId, user.id)` and invalidates `["blocked"]`, `["contacts"]`, `["public-profile"]`, `["avatar-url"]`, `["chats"]` inside a `try/catch` so if `blockUser` throws after `reports` succeeded, it returns `{ blocked: false, blockFailed: true }` instead of failing the report mutation.

- [ ] **Step 4: Run unit tests to verify GREEN**

Run: `npm run test:chat-settings`
Expected: PASS (all unit tests green).

---

### Task 3: Fix Radio CSS Bug & Rebuild `ReportModal` From Scratch

**Files:**
- Modify: `src/styles/settings.css:1206-1215`
- Modify: `src/features/chat-settings/components/ReportModal.tsx:1-74`
- Modify: `src/features/chat-settings/hooks/useChatDialogActions.ts:1-42`
- Modify: `src/styles/chat-settings.css:110-120,511-545,749-770`

**Interfaces:**
- Consumes `ReportTarget`, `ReportReason`, `validReport` from `chatActions.ts` and `useSubmitReport` from `useReportUser.ts`.
- Produces `<ReportModal target={ReportTarget} onClose={onClose} />` wrapping `<ChatSettingsDialog>` (`MotionOverlay`) with `<form>`, target context header, 4 aligned `<input type="radio">` reason cards, details `<textarea>` with live `0/500` counter, optional `<Switch>` for blocking the user or anonymous channel creator, error alert, and submit/cancel footer.

- [ ] **Step 1: Fix `.settings-dialog input:not(...)` in `src/styles/settings.css`**

Update line 1207 in `src/styles/settings.css` to `.settings-dialog input:not([type="checkbox"]):not([type="range"]):not([type="file"]):not([type="radio"])` so native radio inputs across all dialogs never stretch to `100%` width or inherit text-box padding/borders.

- [ ] **Step 2: Update `useReportDialog` in `src/features/chat-settings/hooks/useChatDialogActions.ts`**

Refactor `useReportDialog(target: ReportTarget, onClose: () => void)` to manage `reason`, `description`, `alsoBlock` (`false` by default), `useSubmitReport()`, and notification messages (`useChatUIStore.getState().notify(...)` for `"Report submitted..."`, `"Report submitted and user blocked."`, or partial-success `"Report submitted, but blocking failed. You can block them from Privacy settings."`, localized in EN and ES).

- [ ] **Step 3: Rebuild `src/features/chat-settings/components/ReportModal.tsx`**

Build the new `ReportModal` from scratch:
- `MotionOverlay` / `ChatSettingsDialog` (`className="report-dialog"`) with accessible title (`Report channel` / `Reportar canal` or `Report user` / `Reportar usuario`) and top-right close button (`X` icon).
- `.report-target-card`: `Flag` icon badge + target name + secondary `@handle`/`@slug` + `"Public channel"` / `"Public profile"` pill (never displaying creator info for channels).
- `<form onSubmit={(e) => { e.preventDefault(); submit(); }}>`:
  - `<fieldset className="report-reasons">`: `<legend>` + 4 `.report-reason-option` `<label>` cards (icon + title + 1-line description + fixed `18px` right-aligned `<input type="radio" name="report-reason" />`).
  - Details `<label htmlFor={detailsId}>` with `"Required"` / `"Optional"` indicator, `<textarea id={detailsId} rows={3} maxLength={500} ... />`, and `tabular-nums` counter.
  - Conditional `.report-block-option` card when `target.blockUserId && target.blockUserId !== user?.id`: `<Switch id={blockId} checked={alsoBlock} onCheckedChange={setAlsoBlock} />` + `<label htmlFor={blockId}>` (anonymous creator text for channels; `target.name` for public profiles).
  - Inline `role="alert"` on mutation error.
  - `.modal-actions` with `Cancel` (`type="button"`) and primary submit button (`type="submit"`, text `"Report and block"` / `"Reportar y bloquear"` when `alsoBlock` is true, else `"Submit report"` / `"Enviar reporte"`).

- [ ] **Step 4: Style `.report-dialog` in `src/styles/chat-settings.css`**

Replace obsolete `.report-reason` styles with clean SilverChat tokens (`--card`, `--muted`, `--border`, `--neon`, `--destructive`, `--shadow-silver`), ensuring `flex: 0 0 18px; width: 18px; height: 18px; margin: 0;` on `.report-reason-option input[type="radio"]`, uniform vertical alignment, responsive mobile sizing (`max-width: 640px`), and `prefers-reduced-motion: reduce`.

- [ ] **Step 5: Verify build & typecheck**

Run: `npm run typecheck`
Expected: PASS (no TS errors in `ReportModal.tsx` or hooks).

---

### Task 4: Wire Public Entry Points & Remove Private Chat Report Paths

**Files:**
- Modify: `src/features/chat-settings/stores/uiStore.ts`
- Modify: `src/features/chat-settings/components/ChatSettingsLayer.tsx`
- Modify: `src/features/chat-settings/hooks/useChatSettingsLayer.ts`
- Modify: `src/features/chat-settings/components/ContactProfileModal.tsx`
- Modify: `src/features/chat-settings/components/ChatOptionsMenu.tsx`
- Modify: `src/features/novedades/hooks/channels/useChannelHeaderActions.ts`
- Modify: `src/features/novedades/components/channels/ChannelHeader.tsx`
- Modify: `src/features/novedades/components/channels/ChannelInfoScreen.tsx`
- Modify: `src/routes/profile.$username.tsx`
- Modify: `src/app/providers/i18n-provider.tsx`

**Interfaces:**
- Consumes `<ReportModal target={...} onClose={...} />` from Task 3.

- [ ] **Step 1: Remove `"report"` from private chat settings UI**

- In `uiStore.ts`: remove `"report"` from `ChatModal` (`{ kind: "contact" | "block"; userId: string; name?: string }`).
- In `ChatSettingsLayer.tsx` and `useChatSettingsLayer.ts`: remove `case "report"` and `action === "report"` branch.
- In `ContactProfileModal.tsx`: remove the `Report` button (`lines 121-129`), keeping `Block` (`lines 112-120`).

- [ ] **Step 2: Support `"report"` in channel menus (`ChatOptionsMenu`, `useChannelHeaderActions`, `ChannelHeader`) and `ChannelInfoScreen`**

- In `ChatOptionsMenu.tsx`: set `report: props.contextType === "channel" ? say("Report channel", "Reportar canal") : say("Report", "Reportar")` (with `Flag` icon, `destructive: action === "report"` for channel, `separator: action === "report"`).
- In `useChannelHeaderActions.ts` & `ChannelHeader.tsx`: add `reportOpen` state, pass `isOwner: c.owner_id === user?.id` in `channel` prop of `ChatOptionsMenu`, handle `case "report"` by setting `reportOpen(true)`, and render `<ReportModal>` for the channel when `reportOpen` is true (with `blockUserId: c.owner_id && c.owner_id !== user?.id ? c.owner_id : null`).
- In `ChannelInfoScreen.tsx`: for non-owners (`c.owner_id !== user?.id`), add `SettingsRow` with `<Flag />` (`className="text-destructive [&_svg]:text-destructive"`, `label={say("Report channel", "Reportar canal")}`) that opens `<ReportModal>` for the channel.

- [ ] **Step 3: Add `"Report"` entry point to `PublicProfilePage` (`src/routes/profile.$username.tsx`)**

- In `src/routes/profile.$username.tsx`: when `p.id !== user?.id`, render a `.public-profile-actions` row containing the primary `"Send message"` button and an outline `"Report"` button (`Flag` icon + `t("Report")`), opening `<ReportModal>` with `{ kind: "user", userId: p.id, name: p.display_name ?? p.username ?? "", username: p.username, blockUserId: p.id }`.
- Add `"Report": "Reportar"` to `spanish` map in `src/app/providers/i18n-provider.tsx` (and check `src/styles/settings.css` `.public-profile-actions` spacing).

- [ ] **Step 4: Verify typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS with zero errors.

---

### Task 5: Browser & Unit Test Verification Across Private Chats, Channels & Public Profiles

**Files:**
- Modify: `tests/chat-settings-browser.mjs:490-512`
- Modify: `tests/novedades-browser.mjs:750-805`
- Modify: `tests/settings-browser.mjs:398-405`

- [ ] **Step 1: Update `tests/chat-settings-browser.mjs`**

Verify that in direct/pending chats:
- `ChatOptionsMenu` has 7 items (not 8) and zero `"Report"` menu items.
- `ContactProfileModal` has `"Block"` button and zero `"Report"` buttons (updating lines 499-510 & 558).

- [ ] **Step 2: Expand `tests/novedades-browser.mjs` for channel reporting + layout geometry + anonymous creator privacy**

- Update line 752 menu item count (`6` -> `7` for non-owner) and verify owner channel does NOT expose `"Report channel"`.
- Mock `POST /reports` and `POST /user_blocks` in `novedades-browser.mjs`.
- Test opening `"Report channel"` from `ChannelHeader` menu and `ChannelInfoScreen`:
  - Assert no creator name/username (`sofia`) appears anywhere in the modal.
  - Assert all 4 radio inputs have identical `width` and `height` (`<= 24px`) and identical `x` alignment (within 1px).
  - Select `"Other"`, verify submit disabled until description filled, toggle `"Also block this channel's creator"`, submit, and verify `POST /reports` (`reported_channel_id: followed`, `reported_user_id: null`) and `POST /user_blocks` (`blocked_id: sofia`) + confirmation toast.

- [ ] **Step 3: Expand `tests/settings-browser.mjs` for public profile reporting + blocking**

- On `/profile/bob`, click `"Report"`, select `"Spam"`, toggle `"Also block Bob Stone"`, submit `"Report and block"`, and verify `POST /reports` (`reported_user_id: otherId`, `reported_channel_id: null`) + `POST /user_blocks` (`blocked_id: otherId`) + confirmation toast, plus mobile (`390x844`) zero horizontal overflow on the open modal.

- [ ] **Step 4: Run full verification suite**

Run:
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Isolated Vite dev server + `node tests/chat-settings-browser.mjs`, `node tests/novedades-browser.mjs`, `node tests/settings-browser.mjs`
Expected: Every unit test, typecheck, lint, build, and browser test passes with zero console/page errors.
