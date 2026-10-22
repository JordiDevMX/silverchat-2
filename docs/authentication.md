# SilverChat authentication

Six Netlify Functions implement magic-link-only authentication with a refresh
token in an HttpOnly, Secure, SameSite=Lax cookie and an access JWT in memory.
The client has ten screens; the server callback completes the prompt's eleven
screen/flow entries. No password, social/phone login, devices UI, avatar picker,
or toast system is included.

## Deployment status

Implementation and local validation are complete. Migration 0004 has been
applied to the disposable local database only. The remote project still has
migrations 0001–0003, which the developer previously applied through SQL Editor.
No remote link, push, migration, email, user creation, or auth-configuration
mutation was performed for this task. Apply 0004 manually through SQL Editor
before deploying this client/BFF. Stop on an SQL error and preserve its output.
Existing duplicate `(user_id, user_agent)` device rows will cause the new unique
constraint to fail; review duplicates instead of silently deleting device data.

`src/types/database.ts` was regenerated from the local database with 0004 and
formatted before atomic replacement. It describes the new schema, not the
currently deployed remote schema. After applying 0004 remotely, regenerate
again through the Management API if desired using the temporary-file pattern.

## Endpoint contract

| Endpoint | Behavior |
| --- | --- |
| POST `/api/auth/signin` | `{email, mode: 'login'|'signup'|'resend', redirect?, turnstileToken?}`. Signup requires Turnstile. Login sets `shouldCreateUser: false`. Email-provider outcomes remain `{ok:true}` to avoid enumeration. |
| GET `/api/auth/callback` | Exchanges default-template PKCE `code`, or validates `token_hash` with an allowed email OTP type. Writes the refresh cookie and redirects to post-login with an access token. |
| POST `/api/auth/refresh` | Normal cookie refresh, or `{totp_code, factor_id}` to upgrade the existing cookie session to AAL2. Returns `{accessToken, expiresAt, user, aal, mfaRequired, mfaChallengeId, factorId}`. |
| POST `/api/auth/logout` | Revokes the current session using its access JWT and `local` scope; clears the cookie. `/api/auth/logout-all` maps to the same function and uses `{scope:'global'}`. |
| POST `/api/auth/turnstile-verify` | Optional standalone verification; signup calls the shared verifier internally, so tokens are not consumed twice. |
| POST `/api/auth/backup-code-verify` | Requires a validated Bearer JWT plus `{code, mfaChallengeId}`. Atomically consumes a matching code, removes MFA factors, and marks the account for re-enrollment. Never trusts a submitted email as identity. |

POSTs require an exact allowlisted Origin and JSON content type. Callback GETs
from email clients normally have no Origin; a supplied Origin is validated.
Responses with session material are `no-store` with `Referrer-Policy: no-referrer`.
There are six function files, not a seventh logout-all or MFA-complete function.
The refresh endpoint also accepts `action: 'enroll'|'disable'|'replace_backups'`
for settings operations. Disabling and replacing codes require fresh TOTP
verification; replacement takes ten client-generated `backup_hashes` and runs
transactionally through a service-role-only RPC.

### AAL2 contract — supersedes the roadmap workaround

The SPA never calls `supabase.auth.mfa.verify()` directly. `/refresh` first uses
the existing refresh cookie to establish its per-request Supabase session,
then calls `mfa.challenge()` and `mfa.verify()`. It writes the **new refresh token
from the verify result** in the same response and returns `aal: 'aal2'`.

Invalid codes return HTTP 401 `{error:'invalid_totp'}` without clearing the
cookie. If the initial refresh rotated the token, that rotation is retained
even on an invalid TOTP response. The client distinguishes this retryable error
from an expired session. A subsequent page reload uses the AAL2 refresh cookie;
it does not require another code. No `/mfa-complete` endpoint or logout workaround
is used. Normal refreshes are deduplicated; cookie mutations are serialized in
the tab and, where supported, across tabs with Web Locks.

## Deliberate corrections to inconsistent examples

- Supabase default email templates use PKCE redirects with `code`. `@supabase/ssr`
  manages only the HttpOnly verifier cookie here; its session cookie writes are
  intentionally discarded. Refresh-token storage is handled explicitly. A default
  PKCE link must be opened in the browser that requested it. A second link request
  replaces that browser's verifier; use the latest link.
- Login cannot create users without captcha. A signed, ten-minute HttpOnly resend
  grant is bound to the captcha-verified signup email; changing the email cannot
  bypass signup captcha. Existing-account resends use the ordinary login path.
- `profiles` exposes only the caller's own row. Username availability therefore
  queries `profiles_visible` on submit; the unique constraint handles races and
  names hidden by privacy rules.
- The device insert/update sequence respects existing column grants instead of
  using an upsert that attempts to update the immutable user ID. The migration
  still adds the requested uniqueness constraint.
- Backup-code client inserts require AAL2, and there is no client UPDATE/DELETE
  permission. Consumption requires an unexpired challenge owned by the same user.
  Recovery failures are reported; success is not returned after partial factor
  deletion. Beginning a new enrollment clears the previous recovery-code set.
- Restrictive MFA policies protect all application tables and Storage. The privacy
  view, thirteen existing definer RPCs, and thirteen boolean helpers also receive
  assurance checks, because route guards and table RLS alone do not protect those
  definer entry points. Migrations 0001–0003 are unchanged.
- The existing project used code-based TanStack routes. Route components are split
  into the requested files and lazy-loaded; the pathless authenticated layout is
  registered explicitly without introducing a route-generation plugin.
- Theme/accent selections work and preferences save to `user_settings`. Language
  selection saves the preference; full application translation remains Prompt 14.
  The welcome screen's avatar suggestion has no picker. Messaging destinations
  are protected placeholders until their feature prompts are implemented.

## Environment checklist

Use an ignored `.env.local` for local development, and Netlify's environment
settings for production. Never expose server secrets through a `VITE_` prefix.

| Variable | Scope | Where to obtain it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser/build | Supabase Project Settings → API, project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser/build | Supabase API settings, anon key; RLS is mandatory |
| `VITE_TURNSTILE_SITE_KEY` | Browser/build | Cloudflare dashboard → Turnstile, site key |
| `SUPABASE_URL` | Functions | Same project URL |
| `SUPABASE_ANON_KEY` | Functions | Same anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions only | Supabase API settings, service-role key |
| `TURNSTILE_SECRET_KEY` | Functions only | Cloudflare Turnstile secret |
| `SITE_URL` | Functions | Canonical HTTPS application origin |
| `ALLOWED_ORIGINS` | Functions | Comma-separated exact HTTPS origins, without trailing slashes |

Set the server values in Netlify's Functions scope and Vite values in Builds.
Restrict Turnstile widget hostnames to the site hostname; the server checks
both hostname and the `signup` action. Preview environments need matching
Supabase redirect allowlists, Turnstile hostnames, SITE_URL and origins.
The Supabase Management API token is not an application auth key and is never
included in the frontend or Functions configuration.

In Supabase Auth settings:

1. Enable email OTP/magic links and TOTP MFA; keep default email templates.
2. Set the site URL and allow the HTTPS callback URL, including its redirect
   query parameters (for example `https://your-site.netlify.app/api/auth/callback**`).
3. Explicitly set email OTP expiry to **600 seconds**. Ten minutes is a product
   setting, not a guaranteed Supabase default.
4. Review actual Auth rate limits and email delivery quotas. The prompt's
   “30/hour per email” is not a guaranteed default; limits vary by project and
   mail provider. Do not enable global Supabase captcha if it would also require
   captcha on login; this BFF verifies Turnstile for signup specifically.
5. Supply the server service-role key securely; never use it in browser requests.

## Dependencies and local workflow

Installed with pnpm and recorded in the lockfile:

```bash
pnpm add @supabase/ssr @marsidev/react-turnstile @hookform/resolvers @fontsource-variable/inter
pnpm add -D @netlify/functions
pnpm install --frozen-lockfile
pnpm test:auth
pnpm build
pnpm lint
```

Use Node 24 for the built-in TypeScript test runner. `pnpm build` checks both
SPA and Netlify Function types. `pnpm dev` runs only Vite; it does not serve the
BFF. Use Netlify CLI (`netlify dev`, if installed) with an HTTPS tunnel to port
8888 for a complete local magic-link flow. Set SITE_URL/ALLOWED_ORIGINS to that
HTTPS origin and allow it in Supabase/Turnstile. Do not remove Secure to work
around local cookies. Browsers have differing localhost Secure exceptions;
plain HTTP is not a reliable end-to-end verification environment, and Netlify
Dev alone does not automatically make a public HTTPS callback.

The browser smoke test uses existing external Playwright tooling and Chromium;
it is not an application dependency:

```bash
# Start Vite with mock-only browser configuration in one terminal:
VITE_SUPABASE_URL=https://supabase.test VITE_SUPABASE_ANON_KEY=test-anon \
  VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA pnpm dev --host 0.0.0.0
# In this cloud workspace:
PLAYWRIGHT_MODULE_PATH=/workspace/.onboarding-tools/node_modules/playwright-core/index.mjs \
  node tests/auth-browser.mjs
# Or provide your own Playwright module and CHROMIUM_PATH.
```

## Validation evidence

- 23 BFF tests pass with mocked GoTrue/Cloudflare/PostgREST boundaries, including
  PKCE, Origin checks, captcha, cookie rotation, invalid-TOTP retry, AAL2 reload,
  concurrent backup redemption, and both logout scopes.
- 19 rollback-only SQL checks pass against local Supabase, exercising real grants,
  RLS, challenge ownership, single-use consumption, atomic replacement, and the
  privacy-view/definer-RPC MFA gates.
- All 67 existing backend regression checks pass after updating the expected
  table count from 21 to 22 for `two_factor_backup_codes`.
- The complete final 0004 migration was replayed against the pre-0004 definitions
  inside an isolated local transaction, followed by the auth SQL checks and a
  rollback. An earlier development syntax error in helper wrapping was corrected;
  the final migration validation succeeds.
- Browser checks pass for desktop/mobile rendering, protected return URLs, email
  submission and cooldown, callback URL cleanup, onboarding, invalid TOTP retry,
  AAL2 reload, security dialogs, enrollment, ten hashed backup codes, recovery
  reminders, and session-expiry modal behavior. No uncaught page errors.
- `pnpm build` and `pnpm lint` pass. Vite reports a non-failing initial bundle-size
  warning; auth route screens are already split into lazy chunks. Dependency
  installation reports the existing `vite-tsconfig-paths`/TypeScript peer warning.

These checks do not claim real email delivery, real Cloudflare challenges,
Netlify deployment, or remote migration application. Runtime auth bindings are
not present in this task's process; the browser tests use explicit mock values.

## Manual deployment verification

- [ ] Apply 0004 through SQL Editor; verify 22 public tables and RLS on every table.
- [ ] Signup with a new email and solve Turnstile; receive the magic link.
- [ ] Open the latest link in the requesting browser; choose a username, reach
      welcome, then skip or save preferences and arrive at `/chats`.
- [ ] Request a protected URL with query/hash while logged out; verify it survives
      login, MFA if enabled, and onboarding.
- [ ] Open a second tab to `/chats`; verify the HttpOnly cookie restores the session.
- [ ] Inspect `sb-refresh-token`: HttpOnly, Secure, SameSite=Lax, Path=/, seven days.
      `document.cookie`, localStorage and sessionStorage must not contain auth tokens.
- [ ] Enable 2FA: scan QR or use the key, enter TOTP, save/download ten backup codes.
      Confirm the modal cannot close before acknowledging that they are saved.
- [ ] Sign out and back in: enter an invalid code, retry successfully, then reload.
      `/refresh` must return `aal:'aal2'` without another challenge after reload.
- [ ] Regenerate backup codes with fresh TOTP; verify the old codes no longer work.
- [ ] Use a backup code during login; verify factors are removed, replay fails,
      and the application prompts re-enrollment. Re-enable 2FA afterward.
- [ ] Disable 2FA with fresh TOTP; verify backup codes are removed.
- [ ] Submit signup with an invalid Turnstile token → 400, no email sent.
- [ ] POST `/api/auth/refresh` with allowed Origin and no cookie → 401 `no_session`.
      GET is not supported (405 when Origin is valid); it is not the cookie test.
- [ ] POST signin with a bad Origin → 403. Verify arbitrary external redirect
      values never become callback/navigation targets.
- [ ] Verify configured email throttling using provider logs and delivery results.
      A public 31st-request failure is deliberately not asserted: uniform signin
      responses hide provider/account-specific outcomes, including throttling.
- [ ] Expire/remove the refresh cookie during an established session and let an
      access-token refresh occur (or expire the access JWT). Verify the session-
      expired modal and Log in return URL. Removing the cookie alone does not
      invalidate an unexpired in-memory access token.
- [ ] Confirm single-session logout leaves other sessions valid; verify global
      logout separately via the BFF. The devices management UI is deferred.

## Pitfalls and limitations

`persistSession:false` keeps the browser SDK from writing session tokens to local
storage. `autoRefreshToken:false` prevents an SDK refresher from competing with
the BFF's refresh rotation. Never add a browser refresh token to fix SDK MFA;
MFA verification belongs in `/refresh` with this architecture.

SameSite=Lax permits the email navigation used for PKCE. Strict would prevent
the verifier cookie from accompanying that initial cross-site navigation.
Origin verification complements SameSite for mutation endpoints; legitimate
email callback GETs are the deliberate exception to requiring an Origin header.

Turnstile applies to signup, while login uses Supabase throttling. The in-memory
backup limiter is five attempts per fifteen minutes per IP **per warm function
instance**; cold starts and multiple instances do not share it. A distributed
limiter remains a later-phase improvement, not an implemented global guarantee.

Backup codes use cryptographic randomness, are SHA-256 hashed before insertion,
and are compared server-side in constant time before atomic consumption. The
server validates the user's login JWT and challenge ownership, not a body email.
Codes can be consumed before an upstream factor-deletion failure; such failures
return `recovery_incomplete`, and support/retry may be necessary. Revoked access
JWTs can remain valid until their expiry; logout revokes refresh sessions.

The access JWT briefly appears in the callback redirect URL, as accepted by the
prompt. It is removed when the token module loads, before React mounts. No-store
and no-referrer headers reduce exposure but do not remove network/proxy logging
risk. No fixed “100 ms” cleanup time is guaranteed, and one-time exchanges remain
deferred. Third-party analytics must not run on callback/post-login URLs.

`handle_new_user()` intentionally creates `user_xxxxxxxx`; route guards force a
real username immediately. Backup-code hashes and all application tables are
protected by MFA-aware RLS. The four private Storage buckets (`avatars`,
`chat-media`, `story-media`, `channel-media`) still need separate provisioning.
No custom email templates, avatar picker, devices UI, or orphan-file cleanup
were added. Production social-card image/canonical URL belongs to Prompt 16.
