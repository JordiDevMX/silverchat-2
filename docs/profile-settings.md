# Profile and settings (Prompt 06)

Implemented on `feat/profile-settings`: migrations 0005/0006, a daily Netlify account-cleanup function, the settings layout and 13 settings/public-profile pages (14 screens including the existing security page), six reusable confirmation/editor modals plus the global deletion banner. Account/email and other-device confirmation dialogs are inline to their owning screens. Avatars use SHA-256's first byte modulo the twelve locked palettes, consistent initials, a circular crop and WebP below 100,000 bytes. Social links support five fixed platforms and **up to twenty** custom links, as specified by the locked limit. Account deletion has a full thirty-day grace period.

## Deployment order

1. Apply `supabase/migrations/0005_profile_settings.sql`, then `0006_account_deletion_rpcs.sql` in the Supabase SQL Editor. Stop on the first error. **These have only been applied locally in this implementation session.** Remote 0001–0004 remain unchanged. No `supabase link` or remote `db push` was run.
2. Confirm the four private Storage buckets exist: `avatars`, `chat-media`, `story-media`, `channel-media`. They previously required manual creation; this task does not create them remotely. Keep `avatars` private and allow `image/webp`. Its object keys start with the owner UUID (`<uid>/avatar-<uuid>.webp`), without an extra `avatars/` segment. Existing Storage RLS checks the first path component.
3. In Supabase Authentication settings, disable **Secure email change** so only the **new** address confirms. Keep existing secure email templates/redirect allow-list configuration. The email-change template must send the token hash to the BFF, for example:

   ```html
   <a href="{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=email_change&redirect=/settings/account">Confirm your new email</a>
   ```

   Configure Supabase Site URL as the application origin. Never put the raw token into application logs. The callback supports `email_change` and still routes through the existing memory-only access-token handoff. Test delivery with real SMTP on a disposable account before release.
4. Keep the server-only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL` and `ALLOWED_ORIGINS` bindings configured on Netlify, along with the existing authentication bindings. No service key belongs in a `VITE_*` variable. Email changes go through the current cookie session in `/api/auth/refresh`, because the browser SDK intentionally does not persist a GoTrue session.
5. Regenerate remote types using the Management API after the migrations are applied. Write the successful HTTP JSON `types` result to a temporary file, validate it contains `avatar_initials`, `device_fingerprint`, `scheduled_deletion_at` and the two deletion RPCs, then atomically replace `src/types/database.ts`. The checked-in snapshot for this implementation was generated against **local migrations 0001–0006**, so it includes the forthcoming schema. Generator version differences explain additional computed-field metadata and the lack of remote PostgREST-version metadata.
6. Deploy the functions and SPA together. Netlify discovers `cleanup-deleted-accounts` with `schedule: '0 4 * * *'`. Scheduled functions are platform-invoked; do not add a public API redirect to this destructive handler. The job was tested against mocked HTTP boundaries, **not invoked against production**.

## Dependencies

```sh
pnpm add react-easy-crop browser-image-compression
```

Both packages ship TypeScript declarations, so no `@types/react-easy-crop` package is needed. Image compression was mentioned in the roadmap as already installed, but was absent from this repository. The install retained the existing `vite-tsconfig-paths` / `tsconfck` peer warning about TypeScript 6; build and lint verification are independent of that warning.

## Automated verification

```sh
pnpm build
pnpm lint
pnpm test:auth
pnpm test:settings

# Disposable local Supabase database only; each suite rolls its fixtures back.
psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/backend_foundation.sql
psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/authentication.sql
psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/profile_settings.sql
```

Browser checks require Chromium and an existing `playwright-core` installation; neither is a project dependency. Start Vite with mock values:

```sh
VITE_SUPABASE_URL=https://supabase.test \
VITE_SUPABASE_ANON_KEY=test-anon \
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 0.0.0.0

PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node tests/auth-browser.mjs
PLAYWRIGHT_MODULE_PATH=/path/to/playwright-core/index.mjs node tests/settings-browser.mjs
```

The settings browser harness exercises real form/crop/canvas code against mocked HTTP, including reload persistence, theme/language, visibility exclusions, notification controls, email change and global cancellation. It writes desktop, dark-mode and mobile screenshots to `/tmp/silverchat-settings-*.png`. It is not evidence of real email delivery, remote RLS or deployed scheduling.

## Manual verification checklist

- [ ] Change display name, first/last names and bio; reload. Confirm the 50/50/50/160 limits and unchanged-save disabled state.
- [ ] Change username once. Confirm immediate repeat is disabled, and a direct second authenticated update raises the cooldown error. Test a concurrent name collision; the unique constraint must remain authoritative.
- [ ] Upload or take a photo, crop with the slider, save, and inspect a 512×512 WebP below 100 KB. Confirm it appears on settings, header and public profile. Remove it and check gradient/initials return and previous Storage/metadata entries disappear.
- [ ] Save all five social fields and custom text/links. Add twenty custom rows and confirm the add action disables. Arbitrary text is accepted; a `javascript:` string must remain inert on the public page.
- [ ] Change email. Confirm the old address remains active until the new address's single confirmation is clicked; follow the BFF callback and reload account settings.
- [ ] Use two browser profiles. Confirm different fingerprint rows, a stable current-device badge after reload, and **Sign out all other devices** preserves the current session. The device list is historical activity, not an authoritative active-session list. Existing access JWTs on other devices remain usable until their provider-defined expiry; refresh tokens are revoked immediately.
- [ ] Test local logout and the optional all-device checkbox. Checked logout performs one global revocation before clearing the current cookie. Adding another account first signs out the current one.
- [ ] Integrate/reuse `BlockUserModal` from the later chat menus, or insert a block using an authenticated test client. Confirm the management list shows it while `profiles_visible` hides that user; both directions of a direct message, including pending requests, fail. Unblock and retry. The chat must remain intact.
- [ ] With a second real user, test photo/story everyone, contacts, contacts-except and nobody rules. Excluded contacts must lose avatar access. Signed image URLs have a maximum sixty-second lifetime; an already-issued URL can remain usable for that interval.
- [ ] Disable presence. Disable read receipts, first cancel the warning, then confirm. Confirm server settings reflect the choice and the existing fair-trade receipt rules apply to both users.
- [ ] Change dark theme, purple accent and Español. Check immediate UI changes, localStorage values and one debounced server write; reload and sign in on another browser to confirm hydration. Preferences stay mounted across routes and are flushed before logout. Failed saves remain visible with retry.
- [ ] Turn off master notifications: sound/previews become disabled and the sample in-app notification is suppressed. Turn previews off: only generic text appears. Sound obeys its switch. Browser autoplay restrictions may suppress sound until user interaction; Web Push remains a later phase.
- [ ] Schedule deletion by typing DELETE. Confirm the deadline is thirty days away, repeated scheduling preserves it, and the banner appears on every authenticated route and another browser. Cancel within the grace period and confirm the banner disappears. The deadline is also displayed in the banner; after it passes, cancellation is disabled because permanent deletion may have begun.
- [ ] **Disposable local account only:** set its deadline to yesterday as the database owner, invoke the scheduled function locally, and verify Auth/profile removal, Storage cleanup, and retained messages with `sender_id = NULL`. Repeat with a failing Storage request and ensure the account remains for retry. Never run this test against a real user's account.
- [ ] Compare storage totals with completed upload rows, including more than 1,000 rows; the breakdown is paginated. Soft upload limits are an indicator, not an enforced account quota.
- [ ] Check keyboard focus/Escape in dialogs, narrow mobile layouts, light/dark contrast and reduced-motion mode. Terms and privacy rows are explicitly marked “Coming soon”; supply real destinations before product launch.

## Integration details and pitfalls

- Username cooldown is enforced by the database trigger, including onboarding's first change; protected timestamps cannot be changed through authenticated column grants. Unchanged usernames do not consume the cooldown. Placeholder-format targets are rejected even from a placeholder account.
- The message trigger uses `SECURITY DEFINER` for cross-user block reads and the canonical direct pair. A pending request has only the requesting chat member, so checking `chat_members` alone would miss the recipient. It does not call an MFA-gated helper from a privileged no-session context.
- `create_direct_chat_request(target, '')` now opens a request without inserting an empty message. Existing MFA, block checks, rejection cooldown and serialization are retained. The actual conversation UI is still a later prompt; this session only establishes navigation to `/chats/:id`.
- `profiles_blocked` is an own-block-list, MFA-gated management view. It exposes only ID, display name, username and computed avatar initials. It never reveals the blocked person's avatar, presence, bio or links. A join to `profiles_visible` would silently drop every blocked row. Both views expose computed initials, not first/last-name fields, so public avatars match the owner's avatar algorithm.
- Nullable fingerprints represent unavailable localStorage. The browser sends `null` and skips persistent device registration instead of inventing a new device on every refresh. BFF upserts by `(user_id, device_fingerprint)` after sufficient MFA and never stores access/refresh tokens in `devices`.
- Preferences use the existing **`user_settings.accent`** column. React Query mutations are serialized; immediate optimistic state keeps switches responsive while the network saves. Theme/accent/language are also persisted locally. No realtime settings subscription is added. English/Spanish cover the new settings surfaces; the full application localization system remains Prompt 14.
- Avatar paths are private Storage keys, not public URLs. Upload bookkeeping is pending → uploading → completed → profile update → old-object cleanup. If the new upload fails, cleanup is attempted; if old-object deletion fails after the profile succeeds, the UI reports pending cleanup and retains metadata. The old orphan job now excludes avatar metadata so active photos are not misclassified after seven days.
- Daily cleanup paginates due users and upload metadata, removes tracked Storage objects first, then calls `auth.admin.deleteUser`. The existing FK cascade removes personal rows and nulls message senders. Failed Storage/Auth operations produce a non-success result and leave the account due for retry. Legacy untracked owned Storage objects can still block Auth deletion; inspect provider logs and reconcile those objects rather than silently skipping the failure.
- Cancellation takes a row lock and is available for the full thirty-day grace period. Once the deadline passes it returns an explicit error, preventing a cross-service cancellation race during Storage/Auth deletion. The cleanup function rechecks eligibility before removal and before deleting Auth. Out-of-band administrator changes during an active job are not supported; pause the job before editing deadlines manually.
- The deletion banner belongs to `_authenticated`, so it is not limited to `/settings`. SHA-256 palettes need no database column and remain consistent across devices. Client WebP optimization reduces storage/bandwidth. Social JSON is normalized without URL validation on save; rendering only links HTTP(S) schemes to prevent script execution.

## Recorded local results

- `pnpm build`: passed (TypeScript application, functions and test compilation; Vite production bundle).
- `pnpm lint`: passed with no diagnostics.
- Node tests: 34 passed, 0 failed (29 authentication/BFF + 5 settings/cleanup).
- SQL: backend foundation (67 checks), authentication (19 checks), and profile/settings integration suites passed; all fixtures rolled back.
- Chromium: authentication regression and settings browser suites passed with no uncaught page errors. Desktop/light, desktop/dark and 390px mobile screenshots were inspected.
- Remote migrations, real email delivery, real two-browser revocation and the deployed scheduled function remain developer deployment checks, not local test claims.
