# TopBanner & In-App Security Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flexible reusable `TopBanner` component, refactor `ConnectionBanner` onto it, and surface dismissible top-banner security alerts for new-device logins (Approach 1: client-side `public.devices` polling without DB migrations) and 2FA re-enrollment (`requires_reenrollment`).

**Architecture:** Extract `TopBanner` in `src/components/ui/top-banner.tsx` wrapping `InfrastructureNotice` with `tone` (`danger` | `warning` | `info`), `role`, `icon`, optional `action`, `onDismiss`, and `className`. Refactor `ConnectionBanner` to render `TopBanner` while keeping `.connection-banner-v2` and `role="alert"`. Add a pure state/persistence helper module (`src/lib/security-banners.ts`) + React hook/component (`src/app/security-banners.tsx`) mounted inside `Root()` in `src/app/router.tsx` (yielding when `useConnectionHealth()` is true, prioritizing new-device over 2FA re-enrollment, and removing duplicate inline 2FA re-enrollment notices).

**Tech Stack:** React 19, TypeScript, TanStack Router, Supabase JS (`public.devices`), Lucide icons, Biome, Node 24 `--experimental-strip-types` test runner, Playwright browser tests.

**Spec:** `docs/superpowers/specs/2026-11-19-top-banner-security-alerts-design.md`

## Global Constraints

- Reuse `TopBanner` (`src/components/ui/top-banner.tsx`) as the component name; accept arbitrary `children`, `tone?: "danger" | "warning" | "info"`, `role?: "status" | "alert"`, `icon?: ReactNode`, `action?: ReactNode`, `onDismiss?: () => void`, `dismissLabel?: string`, and `className?: string`.
- Preserve `.connection-banner-v2`, `role="alert"`, and `"Connection issues"` copy on `ConnectionBanner` (`tests/auth-infrastructure-browser.mjs`).
- Preserve the exact English string `"Backup code used. Please re-enable 2FA in settings."` (`tests/auth-browser.mjs`).
- Approach 1 only: no SQL migrations, no `supabase_realtime` changes, no new dependencies.
- Persist dismissals in `localStorage` so closed 2FA re-enrollment and dismissed new-device alerts do not reappear (and 2FA dismissal auto-clears once 2FA is re-enabled or `requires_reenrollment` becomes falsy).
- Respect `prefers-reduced-motion` and use English for all code, comments, tests, and default strings (with Spanish translations in `i18n-provider.tsx` / `t(en, es)`).

## Review Focus

1. **First-time browser initialization with existing devices:** A user opening SilverChat on an already-registered account with older rows in `public.devices` must not see false-positive "new sign-in" banners for historical devices; initializing `baselineAt` on first run prevents historical noise.
2. **Current device exclusion & missing `localStorage`:** If `currentFingerprint` matches a device row (or `localStorage` throws/is unavailable), never alert about the current device or crash; degrade safely.
3. **2FA re-enrollment re-arming:** Dismissing the 2FA re-enrollment banner hides it across reloads, but once the user re-enrolls TOTP (or `requires_reenrollment` clears), the stored dismissal flag clears so a future backup-code recovery still alerts them.
4. **Connection-outage priority (no overlapping fixed banners):** While `useConnectionHealth()` is `true`, `SecurityBanners` renders `null` so `ConnectionBanner` and `SecurityBanners` never overlap at the top of the viewport.
5. **Corrupt `localStorage` JSON:** Malformed JSON under `silverchat:device_alert_seen:<userId>` must not crash the app; fall back cleanly to a fresh baseline.

---

### Task 1: Reusable `TopBanner` Component & `ConnectionBanner` Refactor

**Files:**
- Create: `src/components/ui/top-banner.tsx`
- Modify: `src/app/connection-banner.tsx:1-16`
- Modify: `src/styles/globals.css:512-522`
- Modify: `src/styles/auth.css:173-183,219-227`
- Test: `tests/auth-infrastructure-browser.mjs` (existing contract check)

**Interfaces:**
- Produces:
  ```ts
  export type TopBannerTone = "danger" | "warning" | "info";
  export interface TopBannerProps {
    children: ReactNode;
    tone?: TopBannerTone;
    role?: "status" | "alert";
    icon?: ReactNode;
    action?: ReactNode;
    onDismiss?: () => void;
    dismissLabel?: string;
    className?: string;
  }
  export function TopBanner(props: TopBannerProps): JSX.Element;
  ```

- [ ] **Step 1: Verify existing infrastructure browser test baseline**

Run (from worktree with isolated Vite dev server if running, or verify TypeScript baseline via `pnpm typecheck`):
`pnpm typecheck`
Expected: PASS (exit code 0)

- [ ] **Step 2: Create `src/components/ui/top-banner.tsx`**

Implement `TopBanner` wrapping `InfrastructureNotice`:
- Default `tone = "info"`, default `role = tone === "danger" ? "alert" : "status"`, default `dismissLabel = "Dismiss"`.
- Root `<div className={cn("top-banner", `top-banner-${tone}`, className)} data-tone={tone}>`.
- Renders `<InfrastructureNotice role={role} icon={icon}>` with text content, optional `<div className="top-banner-action">{action}</div>` if `action` is passed, and optional dismiss `<button type="button" className="top-banner-dismiss" aria-label={dismissLabel} onClick={onDismiss}><X size={16} aria-hidden="true" /></button>` when `onDismiss` is provided.

- [ ] **Step 3: Style `.top-banner`, tones, `.top-banner-action`, and `.top-banner-dismiss` in `src/styles/globals.css` and `src/styles/auth.css`**

- In `src/styles/globals.css`: replace `.connection-banner` with shared `.top-banner` (keeping `.connection-banner` as alias selector `.top-banner, .connection-banner` if anything references it):
  - `position: fixed; inset: 0 0 auto 0; z-index: 60; padding: 0.5rem 1rem; font-size: 0.85rem; background: var(--card); border-bottom: 1px solid var(--border); box-shadow: var(--shadow-silver);`
  - Tone variants:
    - `.top-banner-danger`: `color: var(--destructive); border-bottom-color: color-mix(in oklab, var(--destructive) 45%, var(--border));`
    - `.top-banner-warning`: `color: oklch(0.55 0.14 70); border-bottom-color: color-mix(in oklab, oklch(0.75 0.16 75) 55%, var(--border));` (and dark mode `[data-theme="dark"] .top-banner-warning { color: oklch(0.82 0.14 80); }`)
    - `.top-banner-info`: `color: var(--foreground); border-bottom-color: color-mix(in oklab, var(--primary) 45%, var(--border));`
- In `src/styles/auth.css`: update `.connection-banner-v2` rules to also apply to `.top-banner` (`animation: public-reveal 150ms ease-out both;`, reduced-motion override, flex alignment for content + `.top-banner-action` + `.top-banner-dismiss` with clear focus-visible outline and `min-width: 28px; min-height: 28px` hit target).

- [ ] **Step 4: Refactor `src/app/connection-banner.tsx` to use `TopBanner`**

Render:
```tsx
<TopBanner
  tone="danger"
  role="alert"
  icon={<WifiOff size={18} />}
  className="connection-banner connection-banner-v2"
>
  {t("Connection issues — some content may be unavailable. Retrying…")}
</TopBanner>
```

- [ ] **Step 5: Run `pnpm typecheck` and `pnpm lint`**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (exit code 0)

---

### Task 2: Pure Security Banner Logic & Persistence (`src/lib/security-banners.ts`)

**Files:**
- Create: `src/lib/security-banners.ts`
- Test: `tests/security-banners.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface DeviceRecord {
    id: string;
    device_name: string;
    device_fingerprint: string | null;
    created_at: string;
  }

  export interface DeviceAlertState {
    baselineAt: string;
    dismissedIds: string[];
  }

  export function findNewDeviceAlert(
    devices: readonly DeviceRecord[],
    currentFingerprint: string | null,
    state: DeviceAlertState | null,
    nowIso: string,
  ): { alertDevice: DeviceRecord | null; nextState: DeviceAlertState };

  export function dismissDeviceAlert(
    state: DeviceAlertState,
    device: Pick<DeviceRecord, "id" | "created_at">,
  ): DeviceAlertState;

  export function readDeviceAlertState(storage: Storage | null, userId: string): DeviceAlertState | null;
  export function writeDeviceAlertState(storage: Storage | null, userId: string, state: DeviceAlertState): void;

  export function shouldShowReenrollmentBanner(
    opts: { userId: string; requiresReenrollment: boolean; hasVerifiedFactor: boolean },
    storage: Storage | null,
  ): boolean;
  export function dismissReenrollmentBanner(userId: string, storage: Storage | null): void;
  export function syncReenrollmentDismissal(
    opts: { userId: string; requiresReenrollment: boolean; hasVerifiedFactor: boolean },
    storage: Storage | null,
  ): void;
  ```

- [ ] **Step 1: Write failing unit tests in `tests/security-banners.test.ts`**

Cover all behaviors and Review Focus cases:
1. First initialization (`state === null`): initializes `baselineAt` (using `currentFingerprint`'s `created_at` if present, otherwise `nowIso`) and returns `alertDevice: null` so pre-existing devices do not trigger false positives.
2. Subsequent check with a new device (`device_fingerprint !== currentFingerprint`, `created_at > baselineAt`, not in `dismissedIds`): returns that newest `alertDevice`.
3. Current device row (`device_fingerprint === currentFingerprint`) created after `baselineAt`: never returned as `alertDevice`.
4. Dismissed device (`dismissDeviceAlert`): adds `id` to `dismissedIds` and advances `baselineAt` so subsequent checks return `alertDevice: null`.
5. Corrupt JSON in `storage` (`readDeviceAlertState`): returns `null` without throwing.
6. `shouldShowReenrollmentBanner`: returns `true` when `requiresReenrollment && !hasVerifiedFactor` and not dismissed; returns `false` after `dismissReenrollmentBanner`; `syncReenrollmentDismissal` clears stored flag once `hasVerifiedFactor` becomes `true` or `requiresReenrollment` becomes `false`, so a future recovery re-arms it.
7. Null/throwing `Storage`: degrades safely without throwing.

- [ ] **Step 2: Run unit test to verify it fails**

Run: `node --experimental-strip-types --test tests/security-banners.test.ts`
Expected: FAIL with module not found (`src/lib/security-banners.ts`).

- [ ] **Step 3: Implement `src/lib/security-banners.ts`**

Implement the exact exported functions with strict bounds (`dismissedIds` capped at e.g. 50 most recent entries, safe `try/catch` around `Storage` access, ISO timestamp comparison via `Date.parse`).

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `node --experimental-strip-types --test tests/security-banners.test.ts`
Expected: PASS (all tests passing).

---

### Task 3: `SecurityBanners` Integration, Polling Hook & Duplicate Cleanup

**Files:**
- Create: `src/app/security-banners.tsx`
- Modify: `src/app/router.tsx:39-77`
- Modify: `src/features/chats/components/ChatList.tsx:87-95`
- Modify: `src/app/providers/i18n-provider.tsx` (add Spanish translations)

**Interfaces:**
- Consumes: `TopBanner` (`src/components/ui/top-banner.tsx`), `useAuth` (`src/lib/auth-provider.tsx`), `useConnectionHealth` (`src/lib/use-connection-health.ts`), `useI18n` (`src/app/providers/i18n-provider.tsx`), `getOrCreateDeviceFingerprint` (`src/lib/devices.ts`), helpers from `src/lib/security-banners.ts`.
- Produces: `export function SecurityBanners(): JSX.Element | null`

- [ ] **Step 1: Create `src/app/security-banners.tsx`**

Implement `SecurityBanners`:
- Reads `auth = useAuth()`, `down = useConnectionHealth()`, `const { t } = useI18n()`.
- Active user gate: `const user = auth.user; const active = Boolean(user && !auth.mfaRequired);`
- **2FA re-enrollment state:**
  - `requiresReenrollment = Boolean(user?.user_metadata.requires_reenrollment)`
  - `hasVerifiedFactor = Boolean(user?.factors?.some((f) => f.status === "verified"))`
  - Sync dismissal via `syncReenrollmentDismissal` when `user` updates, and track `reenrollDismissed` in React state backed by `shouldShowReenrollmentBanner`.
- **New-device polling (Approach 1):**
  - When `active && user`, fetch `supabase.from("devices").select("id, device_name, device_fingerprint, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)`.
  - Run on mount/`user.id` change, on `window` `"focus"`, on `document` `"visibilitychange"` (when `visibilityState === "visible"`), and every `60_000` ms while `visibilityState === "visible"`.
  - Feed results through `findNewDeviceAlert`, persist initialized `nextState` when `state === null`, and set `newDevice` in React state.
  - On dismiss: update `localStorage` via `dismissDeviceAlert` and clear `newDevice` (or recompute next unacknowledged device).
- **Render priority:**
  - If `!active || down`, return `null`.
  - If `newDevice`: render `<TopBanner tone="warning" role="status" icon={<ShieldAlert size={18} />} action={<Link to="/settings/devices" onClick={handleDismissDevice}>{t("Review devices")}</Link>} onDismiss={handleDismissDevice} dismissLabel={t("Dismiss")}>{t(...)}</TopBanner>` showing `newDevice.device_name`.
  - Else if `showReenrollment`: render `<TopBanner tone="warning" role="status" icon={<ShieldAlert size={18} />} action={<Link to="/settings/security" onClick={handleDismissReenroll}>{t("Open security settings")}</Link>} onDismiss={handleDismissReenroll} dismissLabel={t("Dismiss")}>{t("Backup code used. Please re-enable 2FA in settings.")}</TopBanner>`.
  - Else return `null`.

- [ ] **Step 2: Mount `<SecurityBanners />` in `Root()` and clean up duplicates**

- In `src/app/router.tsx`: mount `<SecurityBanners />` inside `Root()` right above `<Outlet />`. Remove the duplicate `<InfrastructureNotice>` for `requires_reenrollment` in `AuthenticatedDestination()` (lines 62–67) and clean up unused `InfrastructureNotice` import if no longer used in `router.tsx` (check line 93 first — line 93 uses `InfrastructureNotice` for 404, so keep the import!).
- In `src/features/chats/components/ChatList.tsx`: remove the duplicate `requires_reenrollment` `<p role="status" className="chats-notice">` block (lines 87–95).

- [ ] **Step 3: Add Spanish translations in `src/app/providers/i18n-provider.tsx`**

Add keys:
- `"Review devices": "Revisar dispositivos"`
- `"Open security settings": "Abrir seguridad"`
- `"Dismiss": "Cerrar"`
- `"Backup code used. Please re-enable 2FA in settings.": "Usaste un código de respaldo. Reactiva 2FA en ajustes."`
- Plus the new-device message formatting helper (e.g., `language === "es" ? `Nuevo inicio de sesión detectado en ${name}.` : `New sign-in detected on ${name}.``).

- [ ] **Step 4: Run unit tests, typecheck, and lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS (all unit tests, typecheck, and Biome checks pass).

---

### Task 4: Browser End-to-End Verification

**Files:**
- Modify: `tests/auth-browser.mjs` (verify dismissible 2FA re-enrollment banner stays dismissed after reload)
- Modify: `tests/auth-infrastructure-browser.mjs` (verify `ConnectionBanner` still works and `SecurityBanners` yields during outage if needed, or keep `auth-infrastructure-browser.mjs` passing as-is)

- [ ] **Step 1: Update `tests/auth-browser.mjs` to cover `TopBanner` 2FA dismissal + new-device alert**

- In `tests/auth-browser.mjs`:
  - Existing assertion at line 285 (`await page.getByText("Backup code used. Please re-enable 2FA in settings.").waitFor();`) verifies `TopBanner` renders the reminder.
  - Add assertion right after line 285: click the dismiss button (`page.getByRole("button", { name: "Dismiss", exact: true }).click()`), wait for the text to detach, reload `/chats`, and assert the banner stays dismissed (`count() === 0`).
  - Also test new-device alert: when `devices` REST mock returns a newly created device with a different `device_fingerprint` after baseline initialization, `TopBanner` displays `"New sign-in detected on ..."` and dismissing it hides it persistently.

- [ ] **Step 2: Run browser suites against isolated Vite dev server**

Start isolated Vite dev server on port 5175 with disposable env vars, then run:
- `node tests/auth-browser.mjs`
- `node tests/auth-infrastructure-browser.mjs`
Expected: Both PASS with zero uncaught page errors.

- [ ] **Step 3: Run full unit tests, typecheck, build, and lint**

Run: `pnpm test && pnpm build && pnpm lint`
Expected: PASS (all checks green).

- [ ] **Step 4: Review git diff & commit on worktree branch**

Run: `git log --oneline main..HEAD` and `git diff --stat main..HEAD`, verify only task files are included (including spec & plan), then commit with an English commit message.

---

## Self-Review Check

- **Spec coverage:** Every spec item (`TopBanner` component + props, `ConnectionBanner` refactor preserving `.connection-banner-v2`, Approach 1 `public.devices` polling + baseline + dismiss persistence, `requires_reenrollment` banner + dismiss persistence + duplicate cleanup, priority/non-overlap with connection outage, tests) maps directly to Tasks 1–4.
- **Step scan:** Every step specifies exact file paths, exported symbols/signatures, test cases, and verification commands.
- **Type consistency:** `TopBanner`, `TopBannerProps`, `TopBannerTone`, `DeviceRecord`, `DeviceAlertState`, `findNewDeviceAlert`, `dismissDeviceAlert`, `readDeviceAlertState`, `writeDeviceAlertState`, `shouldShowReenrollmentBanner`, `dismissReenrollmentBanner`, `syncReenrollmentDismissal`, and `SecurityBanners` match across tasks.
- **Review Focus:** All 5 edge cases have explicit tests in Task 2 / Task 4.
