# TopBanner & In-App Security Alerts Design

## Intent & Scope

Replace the hardcoded connection-outage banner with a flexible, reusable `TopBanner` component and use it to surface two dismissible in-app security alerts:

1. **New-device login alert (Approach 1 — client-side, no DB migration):** Detects logins from other devices using the existing `public.devices` table (`auth-refresh.ts` already upserts `(user_id, device_fingerprint)`). Realtime (`supabase_realtime` migration) is deferred to a follow-up (Approach 2).
2. **2FA re-enrollment reminder (`requires_reenrollment`):** Moves the backup-code recovery reminder into `TopBanner` and persists dismissal so closing it prevents it from reappearing.

## Goals & Non-Goals

- **Goals:**
  - Reusable `TopBanner` component (`src/components/ui/top-banner.tsx`) supporting arbitrary content, `tone` (`danger` | `warning` | `info`), `role` (`alert` | `status`), optional `icon`, optional `action` element, optional `onDismiss` button, and `className`.
  - Keep `ConnectionBanner` working with its existing `.connection-banner-v2` selector, `role="alert"`, and `"Connection issues..."` copy so `tests/auth-infrastructure-browser.mjs` remains intact.
  - Detect new devices (`device_fingerprint !== currentFingerprint` created after the browser's initialized baseline) on auth load, window `focus` / `visibilitychange`, and a 60s visible-tab interval, with a link to `/settings/devices` and persistent per-device dismissal in `localStorage`.
  - Show the `"Backup code used. Please re-enable 2FA in settings."` notice in `TopBanner` with a link to `/settings/security` and persistent per-user dismissal in `localStorage` (auto-cleared once 2FA is re-enabled or `requires_reenrollment` clears).
- **Non-Goals:**
  - Database schema or `supabase_realtime` publication changes (Approach 2).
  - Sending transactional emails on login.

## Architecture & Trade-offs

- **Single top slot / priority order:** `ConnectionBanner` renders at app root (outside `AuthProvider`) whenever Supabase is down. `SecurityBanners` renders inside `AuthProvider` and yields while `useConnectionHealth()` is `true` so two fixed top banners never overlap. When multiple security alerts are active, the highest-priority one shows first (`new-device` > `requires_reenrollment`); dismissing it reveals the next.
- **Replacing duplicate inline 2FA notices:** Remove the duplicate inline `requires_reenrollment` notices in `src/features/chats/components/ChatList.tsx` and `src/app/router.tsx` (`AuthenticatedDestination`) so the reminder lives in one dismissible `TopBanner` across authenticated routes while preserving the exact string asserted by `tests/auth-browser.mjs`.
- **Desktop rail clearance & reduced motion:** Reuse `.connection-banner` / `.connection-banner-v2` layout rules and ensure the banner remains legible and accessible on mobile and desktop viewports with `prefers-reduced-motion` respected.

## Files Planned

- `src/components/ui/top-banner.tsx` (new `TopBanner` component)
- `src/app/connection-banner.tsx` (refactor to wrap `TopBanner`)
- `src/app/security-banners.tsx` & `src/lib/use-security-banners.ts` (new-device polling + 2FA re-enrollment dismiss state)
- `src/app/App.tsx` (mount `SecurityBanners` inside `AuthProvider`)
- `src/app/router.tsx` & `src/features/chats/components/ChatList.tsx` (remove duplicate inline `requires_reenrollment` notices)
- `src/app/providers/i18n-provider.tsx` (new EN/ES strings for new-device banner and dismiss label)
- `src/styles/globals.css` & `src/styles/auth.css` (tone styles + dismiss/action layout for `.top-banner`)
- Focused unit + browser verification updates (`tests/auth-browser.mjs` / `tests/auth-infrastructure-browser.mjs` / new unit test for banner persistence logic)
