# SILVERCHAT — PROMPT #5: AUTHENTICATION (SPA + BFF)

You are a senior full-stack engineer implementing **authentication** for
SilverChat, a privacy-first messaging web app. This is the login/signup/2FA
system — the first experience every user has.

This prompt covers:

- The BFF architecture (Netlify Functions + httpOnly cookies)
- Supabase Auth integration (magic link only, no password)
- 2FA TOTP enrollment + backup codes
- Turnstile captcha on signup
- 11 screens + flows
- Protected routes + redirect behavior
- Session management + heartbeat

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| Decision                  | Value                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------- |
| **Session storage**       | `@supabase/ssr` with httpOnly cookie for refresh token; access token in memory          |
| **Password**              | NOT implemented in MVP. Magic link only.                                                |
| **2FA availability**      | Settings only (after login). Not offered in onboarding.                                 |
| **2FA method**            | TOTP (authenticator apps) + 10 single-use backup codes                                  |
| **Onboarding steps**      | Username (required) → Welcome (skippable: avatar, theme, language, 2FA hint) → `/chats` |
| **Magic link expiry**     | 10 minutes (Supabase default)                                                           |
| **Error messages**        | Uniform (never reveal if email exists)                                                  |
| **Rate limit**            | Supabase default (30 emails/hour per email)                                             |
| **Captcha**               | Cloudflare Turnstile on signup only (not login)                                         |
| **Email templates**       | Supabase default (no custom Resend template in MVP)                                     |
| **Username availability** | On submit only (no live check)                                                          |
| **Session persistence**   | Unlimited concurrent sessions per user                                                  |
| **Device management**     | `/settings/devices` (table `devices` — 4a)                                              |
| **Heartbeat**             | Client POST every 60s while active (updates `profiles.last_seen_at`)                    |
| **Protected routes**      | Redirect to `/auth/login?redirect=<original>` with URL preservation                     |
| **Session expired UX**    | Modal + redirect, not silent reload                                                     |

---

## 2. BFF ARCHITECTURE

### 2.1 Why a BFF

The app is a SPA (TanStack Router, decided in Prompt #2). SPAs cannot set
httpOnly cookies from client-side JS — only the server can. The BFF (Backend
For Frontend) is a thin serverless layer that handles the 4 cookie-related
auth operations.

**Security model:**

- **Refresh token** (long-lived) → httpOnly, Secure, SameSite=Lax cookie
  → JS can NEVER read it → immune to XSS exfiltration
- **Access token** (1h lifespan) → held in JS memory only
  → never persisted → XSS theft limited to 1h, no refresh possible
- **CSRF** → SameSite=Lax + Origin header verification in every BFF endpoint

### 2.2 Flow overview

┌─────────────────────────┐
│ SPA (TanStack Router) │
│ │
│ accessToken in memory │
└───────────┬─────────────┘
│
┌────────┴─────────┐
│ │
▼ ▼
┌──────────────┐ ┌─────────────────────────┐
│ Supabase │ │ Netlify Functions (BFF)│
│ (direct │ │ │
│ with Bearer)│ │ • /api/auth/signin │
│ │ │ • /api/auth/callback │
│ │ │ • /api/auth/refresh │
│ │ │ • /api/auth/logout │
└──────────────┘ │ • /api/auth/turnstile-verify │
│ • /api/auth/backup-code-verify │
└─────────────────────────┘
│
▼
┌──────────────────┐
│ Supabase Admin │
│ (service role) │
└──────────────────┘

text

- **Client calls Supabase directly** for all data queries (with `Authorization:
Bearer <accessToken>` header). RLS still enforces security.
- **BFF endpoints** handle only the 4 cookie-related operations + Turnstile
  verification + backup code verification.

### 2.3 Folder structure additions

silverchat/
├── netlify.toml
├── netlify/
│ └── functions/
│ ├── auth-signin.ts
│ ├── auth-callback.ts
│ ├── auth-refresh.ts
│ ├── auth-logout.ts
│ ├── auth-turnstile-verify.ts
│ ├── auth-backup-code-verify.ts
│ └── \_lib/
│ ├── supabase-admin.ts
│ ├── cookies.ts
│ └── cors.ts

text

---

## 3. NETLIFY FUNCTIONS

All functions use **Netlify Functions 2.0** (modern API):

```ts
export default async (req: Request, context: Context): Promise<Response> => {
  // ...
};
3.1 Common utilities (netlify/functions/_lib/)
cookies.ts
ts
export const REFRESH_COOKIE = 'sb-refresh-token';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function buildSetCookie(
  name: string,
  value: string,
  maxAgeSeconds: number
): string {
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function clearCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
}
supabase-admin.ts
ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const supabaseAnon = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
cors.ts
ts
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? [];
  return !!origin && allowed.includes(origin);
}
3.2 POST /api/auth/signin
Purpose: Send magic link via Supabase.

Request body: { email: string, turnstileToken: string }

Logic:

verifyOrigin(req) → 403 if bad origin

Validate email with Zod → 400 if invalid

Verify Turnstile token via Cloudflare API (see 3.6) → 400 if invalid

supabaseAnon.auth.signInWithOtp({ email, options: { emailRedirectTo:${SITE_URL}/api/auth/callback} })

Always respond 200 { ok: true } — never reveal if email exists

Response: { ok: true } regardless of internal outcome.

3.3 GET /api/auth/callback
Purpose: Handle magic link click. Sets refresh cookie and redirects.

Query params: token_hash + type (Supabase sends these)

Logic:

Read token_hash and type from query

If missing → redirect to /auth/error?code=missing_token

Call supabaseAnon.auth.verifyOtp({ token_hash, type })

On success:

Extract session.refresh_token and session.access_token

Set-Cookie: sb-refresh-token=<refresh>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800

Redirect to /auth/post-login?at=<access_token> (short-lived, URL will be cleaned immediately)

On error → redirect to /auth/error?code=invalid_token or expired_token

Post-login screen (client-side):

Reads at from URL

Stores it in memory (auth store)

Calls router.navigate({ to: redirect || '/chats' }) with replace: true

Cleans URL via window.history.replaceState({}, '', '/chats')

Security note: The at token in URL is visible in browser history for
~100ms until cleanup. To eliminate this, consider a one-time exchange code
(Fase 2). For MVP, the cleanup is acceptable.

3.4 POST /api/auth/refresh
Purpose: Exchange refresh token cookie for new access token.

Request: no body (uses cookie)

Logic:

verifyOrigin(req) → 403 if bad

Parse sb-refresh-token from cookie

If missing → 401 { error: 'no_session' }

supabaseAnon.auth.refreshSession({ refresh_token })

On success:

Set-Cookie with rotated refresh token (Supabase rotates on refresh)

Return { accessToken, expiresAt, user: { id, email } }

On error → 401 { error: 'invalid_refresh' } + clear cookie

Response: { accessToken: string, expiresAt: number, user: {...} }

3.5 POST /api/auth/logout
Purpose: Sign out + clear cookie.

Logic:

verifyOrigin(req) → 403 if bad

Call supabaseAdmin.auth.admin.signOut(userId) using access token from
Authorization header (to sign out only this session) — optional

Clear cookie: Set-Cookie: sb-refresh-token=; Max-Age=0; HttpOnly; Secure; SameSite=Lax

Return { ok: true }

3.6 POST /api/auth/turnstile-verify
Purpose: Verify Cloudflare Turnstile token server-side.

Request body: { token: string }

Logic:

verifyOrigin(req)

POST to https://challenges.cloudflare.com/turnstile/v0/siteverify with:

secret: process.env.TURNSTILE_SECRET_KEY

response: token

Return { success: boolean }

Note: This is called by auth-signin.ts internally (not directly by client).
The signup screen calls it via /api/auth/signin (which includes the token).
This endpoint exists for potential standalone use.

3.7 POST /api/auth/backup-code-verify
Purpose: Verify a backup code during MFA challenge. On success, removes
all MFA factors (forces re-enrollment).

Request body: { email: string, code: string, mfaChallengeId: string }

Logic:

verifyOrigin(req)

Look up user by email via supabaseAdmin.auth.admin.listUsers() (or
cached lookup table — Fase 2 optimization)

Query two_factor_backup_codes via service role:
WHERE user_id = <uid> AND used_at IS NULL

Hash the submitted code with SHA-256

Compare against each code_hash (constant-time comparison)

If match:

UPDATE two_factor_backup_codes SET used_at = now() WHERE id = <matched>

Delete all MFA factors: supabaseAdmin.auth.admin.mfa.deleteFactor(...)
for each factor returned by listFactors()

Return { success: true, requires_reenrollment: true }

If no match → { success: false }

Rate limit: 5 attempts per 15 min per IP (via memory cache — Fase 2: Redis)

Security note: After successful backup code use, MFA is fully removed.
The user is now at AAL1. On next app load, the UI prompts re-enrollment.
This is intentional — the user has proven email + backup code ownership,
but the current TOTP device is presumed lost.

4. CLIENT-SIDE SUPABASE SETUP
4.1 src/lib/supabase.ts
ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getAccessToken, refreshAccessToken } from './auth';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init = {}) => {
        const token = getAccessToken();
        const headers = new Headers(init.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const res = await fetch(input, { ...init, headers });
        if (res.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            headers.set('Authorization', `Bearer ${newToken}`);
            return fetch(input, { ...init, headers });
          }
        }
        return res;
      },
    },
  }
);
Key points:

persistSession: false → Supabase does NOT try to store tokens in
localStorage (which would defeat the BFF approach)

autoRefreshToken: false → We handle refresh manually via BFF

Custom fetch → Injects Bearer token + auto-retries on 401 once

4.2 src/lib/auth.ts — token manager
ts
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refreshes
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const { accessToken: newToken } = await res.json();
      accessToken = newToken;
      return newToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}
4.3 src/lib/auth-provider.tsx — Auth context
tsx
interface AuthState {
  user: User | null;
  isLoading: boolean;
  mfaRequired: boolean;
  mfaChallengeId: string | null;
  signIn: (email: string, turnstileToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  completeMfa: (code: string) => Promise<void>;
  completeMfaWithBackupCode: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}
Lifecycle:

On mount: call /api/auth/refresh → if success, set token + fetch user via supabase.auth.getUser()

If /api/auth/refresh returns 401 → user is logged out → set isLoading=false, user=null

If /api/auth/refresh returns mfaRequired: true → set mfaRequired=true + mfaChallengeId → routes redirect to /auth/2fa-verify

Auto-refresh: setInterval every 50 minutes while user is logged in

Before unload: no-op (cookie persists)

Provider tree (add to App.tsx):

text
<QueryClientProvider>
  <ThemeProvider>
    <I18nProvider>
      <AuthProvider>       ← NEW
        <RouterProvider />
      </AuthProvider>
    </I18nProvider>
  </ThemeProvider>
</QueryClientProvider>
5. PROTECTED ROUTES
5.1 beforeLoad pattern (TanStack Router)
tsx
// src/routes/_authenticated.tsx  (pathless layout route)
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location, context }) => {
    if (!context.auth.user) {
      throw redirect({
        to: '/auth/login',
        search: { redirect: location.href },
      });
    }
    if (context.auth.mfaRequired) {
      throw redirect({ to: '/auth/2fa-verify' });
    }
  },
});
All authenticated routes (/chats, /channels, /communities, /calls,
/settings, /profile, /onboarding/) live under _authenticated pathless
layout.

5.2 Session loading state
While AuthProvider is hydrating (calling /api/auth/refresh on mount),
render a full-screen skeleton, not a spinner. Rationale: skeleton feels
faster (perceived performance), reduces "flicker" perception.

tsx
if (auth.isLoading) {
  return <AppSkeleton />; // full-page skeleton matching app shell
}
5.3 Session expired UX
If /api/auth/refresh returns 401 after the user was already
authenticated (i.e., refresh token expired mid-use):

AuthProvider sets user=null and dispatches a custom event

A global listener shows a modal: "Your session has expired. Please log in
again." with a single "Log in" button

On click → router.navigate({ to: '/auth/login', search: { redirect: location.href } })

This is handled by a small <SessionExpiredModal /> component mounted at
the router root.

6. SCREENS (11 total)
All screens use the SilverChat design system (Prompt #3). All form screens
use React Hook Form + Zod. All buttons show loading state while awaiting
async operations. All errors use toast notifications (Prompt #6 will define
the toast system — for now, use console.error + inline error text).

6.1 / — Landing (public)
Purpose: Public entry point. Explains the app + CTA.

Content:

Logo + tagline "SilverChat — Privacy-first messaging"

Hero text + 2 CTA buttons: "Get started" (→ /auth/signup) and "Log in"
(→ /auth/login)

If user already authenticated (checked via refresh on mount) → auto-redirect
to /chats

Meta tags: Full OG card (defined in Prompt #16).

6.2 /auth/login — Login
Route: /auth/login?redirect=<url>

Content:

Title: "Welcome back"

Email input (type=email, autocomplete=email)

Button: "Send magic link"

Divider: "Don't have an account? Sign up" (→ /auth/signup)

Logic:

On submit → POST /api/auth/signin with email (no Turnstile on login)

On success → router.navigate({ to: '/auth/check-email', search: { email, redirect } })

Uniform error message regardless of email existence

Zod schema:

ts
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
});
6.3 /auth/signup — Signup
Route: /auth/signup?redirect=<url>

Content:

Title: "Create your account"

Subtitle: "We'll send you a magic link — no password needed."

Email input

Turnstile widget (invisible or visible depending on Cloudflare's assessment)

Button: "Create account"

Divider: "Already have an account? Log in"

Logic:

On submit → validate email + Turnstile widget must have token

POST /api/auth/signin with { email, turnstileToken }

On success → navigate to /auth/check-email

Uniform error message

Zod schema: same as login.

6.4 /auth/check-email — Email sent confirmation
Content:

Icon: envelope (large, accent color)

Title: "Check your email"

Body: "We sent a magic link to {email}. Click it to continue. The link
expires in 10 minutes."

Button: "Resend email" (disabled for 60s after mount, then enabled, with
countdown visible: "Resend in 45s")

Link: "Change email" → /auth/login (or /auth/signup)

Link: "Didn't receive it? Check spam folder"

Logic:

Read email + redirect from search params

"Resend" → re-calls /api/auth/signin (no Turnstile required for resend,
rate limit applies)

On "Resend" success → reset 60s cooldown + toast "Email sent again"

6.5 /auth/callback — Magic link handler
This route is handled server-side by GET /api/auth/callback (Netlify
Function, section 3.3). The client-side route does not exist — the function
redirects directly to /auth/post-login?at=... or /auth/error.

6.6 /auth/post-login — Token injection
Purpose: Receive access token from URL, store in memory, redirect to app.

Content: full-screen skeleton with "Signing you in..." text.

Logic:

Read at from search params

setAccessToken(at)

Fetch user via supabase.auth.getUser() → hydrate AuthContext

Determine if MFA is required: check supabase.auth.mfa.getAuthenticatorAssuranceLevel()

If currentLevel === 'aal1' AND nextLevel === 'aal2' → MFA required

Get challenge: supabase.auth.mfa.challenge({ factorId })

router.navigate({ to: '/auth/2fa-verify', search: { challengeId, redirect } })

Else → router.navigate({ to: redirect || '/chats' })

window.history.replaceState({}, '', finalUrl) to clean URL

Security note: The URL is visible in browser history for ~100ms. This
is accepted for MVP (Fase 2: use one-time exchange code).

6.7 /auth/error — Error screen
Query: ?code=<error_code>

Content by code:

Code	Message	Action
missing_token	"This link is invalid."	"Request a new link" → /auth/login
invalid_token	"This link is invalid."	Same
expired_token	"This link has expired."	Same
rate_limited	"Too many attempts. Try again in a few minutes."	Back button
unknown	"Something went wrong."	Back button
Design: Centered card, error icon (accent color), large message, primary
button.

6.8 /onboarding/pick-username — Force username pick
Route: /onboarding/pick-username (protected, but does NOT redirect away
if the profile has placeholder username)

Trigger logic: On login success, check profile.username:

If matches ^user_[a-f0-9]{8}$ (placeholder pattern from handle_new_user)
→ redirect to /onboarding/pick-username

Else → normal app flow

Content:

Title: "Pick your username"

Subtitle: "This is how others will find you. You can't change it easily."

Input with prefix @ + live preview below

Validation feedback (only on submit, not live): "Available!" or "This
username is taken" or "Username must be 3-20 characters, lowercase letters,
numbers, and underscores only"

Button: "Continue"

Zod schema:

ts
const usernameSchema = z.object({
  username: z.string()
    .min(3).max(20)
    .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
});
Submit logic:

Check availability: SELECT 1 FROM profiles WHERE username = $1 AND id != auth.uid()

If taken → inline error, no DB write

If available → UPDATE profiles SET username = $1 WHERE id = auth.uid()

Handle race condition: UNIQUE violation → retry with error message

Navigate to /onboarding/welcome

6.9 /onboarding/welcome — Suggestions (skippable)
Content:

Title: "Welcome to SilverChat, {display_name}!"

Cards/rows for optional setup:

Avatar — opens avatar picker (implementation in Prompt #6)

Theme — light/dark/system toggle + accent color picker

Language — en/es dropdown (default from browser)

2FA — "Enable two-factor authentication" → opens /settings/security

Big "Skip for now" button (text link)

Primary button: "Get started" → /chats

Logic: All optional. On "Get started" or "Skip" → navigate to /chats.

6.10 /auth/2fa-verify — MFA challenge during login
Route: /auth/2fa-verify?challengeId=<id>&redirect=<url>

Content:

Icon: lock

Title: "Two-factor authentication"

Subtitle: "Enter the 6-digit code from your authenticator app."

6-digit input (auto-advance between digits, paste support)

Button: "Verify"

Link: "Use a backup code instead" → expands backup code input

Link: "Lost access? Use a backup code" (same)

Logic — TOTP path:

On 6-digit complete → supabase.auth.mfa.verify({ factorId, challengeId, code })

On success → session upgraded to AAL2 → refresh token cookie is rotated
(the BFF's refresh endpoint will return the new aal2 refresh token on next
call... actually, this needs rework: AAL2 sessions have a different
refresh token in Supabase's model. See "Known complication" below.)

Navigate to redirect or /chats

Logic — Backup code path:

User enters a 10-char backup code

POST /api/auth/backup-code-verify with { email, code, mfaChallengeId }

On success → backend removes MFA factors

Frontend re-runs /api/auth/refresh (now returns non-MFA state)

Toast: "Backup code used. Please re-enable 2FA in settings."

Navigate to redirect or /chats

Known complication (documented, handled in Fase 2):
MFA verification and refresh cookie rotation don't play perfectly together
with a BFF. The verify call returns a new session with new refresh token —
we must set the cookie again. MVP workaround: after successful
mfa.verify(), frontend calls POST /api/auth/refresh (which returns new
tokens) and the backend updates the cookie. If the refresh fails, user is
logged out and must log in again with magic link (now going straight to AAL2).

Fase 2 improvement: dedicated /api/auth/mfa-complete endpoint that
takes the new session from mfa.verify() and sets the cookie directly.

6.11 /settings/security — 2FA management
Content:

Section "Two-factor authentication"

If not enabled:

Description + button "Enable 2FA"

On click → opens enrollment flow (see below)

If enabled:

Green badge "Enabled"

TOTP device name (e.g., "Authenticator app")

Button: "Regenerate backup codes" (with warning modal)

Button: "Disable 2FA" (with warning modal + TOTP verification)

Enrollment flow:

supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' })

Show QR code (from enrollData.totp.qr_code) + secret text (for manual entry)

User scans → enters 6-digit code to confirm

supabase.auth.mfa.challenge({ factorId }) → supabase.auth.mfa.verify(...)

Generate 10 backup codes client-side:

Format: 10-char uppercase alphanumeric (e.g., A3F9B2C7D1)

Hash each with SHA-256

INSERT INTO two_factor_backup_codes (user_id, code_hash) VALUES ...

Show backup codes in a modal: "Save these codes. You won't see them again."

"Download as .txt" button

"Copy all" button

"I've saved them" checkbox (required to close)

Only then can user leave the modal

Disable flow:

Warning modal: "This will remove 2FA from your account. Anyone with access
to your email will be able to sign in."

Require TOTP code to confirm

supabase.auth.mfa.unenroll({ factorId })

DELETE FROM two_factor_backup_codes WHERE user_id = auth.uid()

Regenerate backup codes:

Warning: "This will invalidate all existing backup codes."

Require TOTP code

DELETE FROM two_factor_backup_codes WHERE user_id = auth.uid()

Generate 10 new codes (same flow as enrollment step 5-6)

7. TURNSTILE INTEGRATION
7.1 Frontend (/auth/signup)
Use @marsidev/react-turnstile (small wrapper, MIT):

tsx
import { Turnstile } from '@marsidev/react-turnstile';

<Turnstile
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  options={{ theme: 'auto', size: 'flexible' }}
  onSuccess={(token) => setTurnstileToken(token)}
  onError={() => setTurnstileToken(null)}
  onExpire={() => setTurnstileToken(null)}
/>
The button "Create account" is disabled until turnstileToken is non-null.

7.2 Environment variables
.env.example:

text
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
.env.local (Netlify env vars for production):

text
TURNSTILE_SECRET_KEY=0x4AAAAAAA...
Both are obtained from the Cloudflare Turnstile dashboard.

8. USERNAME AVAILABILITY CHECK
On submit only (no live debounce). Rationale: reduces DB queries, is
good enough for MVP (usernames are picked once).

Race condition handling:

Client does SELECT 1 FROM profiles WHERE username = $1

If 0 rows → client does UPDATE profiles SET username = $1

If UPDATE raises 23505 (unique violation) → race lost → show "Someone
just took this username. Try another."

Why two queries instead of one: the SELECT provides friendlier UX
immediate feedback; the UNIQUE constraint on UPDATE is the safety net.

9. SESSION HEARTBEAT (presence)
Client-side interval:

tsx
useEffect(() => {
  if (!user) return;
  const update = () => {
    supabase.from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id);
  };
  update();
  const interval = setInterval(update, 60_000); // 60s
  return () => clearInterval(interval);
}, [user]);
Note: RLS on profiles allows UPDATE for own row (Prompt #4b-1). No
custom RPC needed.

Optimization (Fase 2): debounce writes, batch with other presence events,
use Supabase Realtime Presence for live updates.

10. LOGOUT & SESSION MANAGEMENT
10.1 Logout (single device)
Client calls POST /api/auth/logout with Authorization: Bearer <accessToken>

Backend calls supabaseAdmin.auth.admin.signOut(accessToken, 'local')
(signs out current session only)

Backend clears cookie

Client clears accessToken in memory

Client navigates to /

Client clears TanStack Query cache: queryClient.clear()

10.2 Logout all devices
Button in /settings/devices:

Client calls POST /api/auth/logout-all

Backend calls supabaseAdmin.auth.admin.signOut(userId, 'global')

Backend clears cookie

Same client-side cleanup as 10.1

10.3 Device list
The devices table (Prompt #4a) needs to be populated. Row creation:

On every successful login (post-mfa or post-magic-link), the frontend
inserts/updates a device row:

ts
await supabase.from('devices').upsert({
  user_id: user.id,
  device_name: parseUserAgent(navigator.userAgent).browser,
  device_type: 'web',
  user_agent: navigator.userAgent,
  last_active_at: new Date().toISOString(),
}, { onConflict: 'user_id,user_agent' });
Note: The devices table in Prompt #4a doesn't have a UNIQUE(user_id, user_agent) constraint. This prompt should ADD it as a supplementary
migration (see section 11).

The heartbeat (section 9) also updates devices.last_active_at.

/settings/devices UI (defined in Prompt #6, not here): list of devices,
"Sign out" button per device, "Sign out all" button.

11. SUPPLEMENTARY MIGRATION: two_factor_backup_codes
Since Prompt #4a didn't include backup codes (Supabase doesn't manage them),
add a migration supabase/migrations/0004_auth_backup_codes.sql:

sql
CREATE TABLE public.two_factor_backup_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash   text NOT NULL,
  used_at     timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_codes_user_unused
  ON public.two_factor_backup_codes(user_id)
  WHERE used_at IS NULL;

ALTER TABLE public.two_factor_backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can view their own unused codes (for count display in settings)
CREATE POLICY "backup_codes_select_own"
  ON public.two_factor_backup_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own codes (during enrollment)
CREATE POLICY "backup_codes_insert_own"
  ON public.two_factor_backup_codes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE via client. Marking used + regenerating happens via
-- service role (BFF) only.

-- Add UNIQUE constraint for device upsert
ALTER TABLE public.devices
  ADD CONSTRAINT devices_user_agent_unique UNIQUE (user_id, user_agent);
Note: Backup code insertion during enrollment is client-side (using the
user's session). The code_hash field stores SHA-256 of the raw code.
Verification happens server-side (BFF section 3.7) because the client cannot
compare hashes safely.

12. WHAT NOT TO INCLUDE
❌ Password authentication (not in MVP)

❌ Social login (Google, Apple, etc. — forbidden by spec)

❌ Phone number auth (forbidden by spec)

❌ Biometric auth (forbidden by spec)

❌ Live username availability check (submit only)

❌ Custom email templates via Resend (use Supabase default)

❌ One-time exchange codes for callback (Fase 2)

❌ Magic link magic middleware (accept the 100ms URL exposure)

❌ Dedicated /api/auth/mfa-complete endpoint (use refresh workaround)

❌ Rate limiting via Redis (use Supabase defaults + memory cache in BFF)

❌ IP-based abuse detection (Fase 2)

❌ Account recovery when both TOTP and backup codes are lost (contact
support — Fase 2)

❌ The /settings/devices UI itself (Prompt #6)

❌ The <AvatarPicker /> component (Prompt #6)

13. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: BFF with 6 Netlify Functions,
magic-link-only auth, TOTP + backup codes, Turnstile on signup, 11 screens,
redirect preservation, session heartbeat, AAL2 workaround documented.

Complete file tree of new/modified files in this prompt:

netlify.toml

netlify/functions/auth-signin.ts

netlify/functions/auth-callback.ts

netlify/functions/auth-refresh.ts

netlify/functions/auth-logout.ts

netlify/functions/auth-turnstile-verify.ts

netlify/functions/auth-backup-code-verify.ts

netlify/functions/_lib/cookies.ts

netlify/functions/_lib/supabase-admin.ts

netlify/functions/_lib/cors.ts

src/lib/supabase.ts (modified from Prompt #2)

src/lib/auth.ts (new)

src/lib/auth-provider.tsx (new)

src/routes/_authenticated.tsx (new pathless layout)

src/routes/auth.login.tsx (new)

src/routes/auth.signup.tsx (new)

src/routes/auth.check-email.tsx (new)

src/routes/auth.post-login.tsx (new)

src/routes/auth.error.tsx (new)

src/routes/auth.2fa-verify.tsx (new)

src/routes/onboarding.pick-username.tsx (new)

src/routes/onboarding.welcome.tsx (new)

src/routes/settings.security.tsx (new)

src/features/auth/ (hooks, api calls, types)

supabase/migrations/0004_auth_backup_codes.sql

Complete content of every file above, organized by category:

Netlify Functions (all 6 + 3 lib files)

Client auth library (src/lib/auth.ts, auth-provider.tsx,
modified supabase.ts)

Route files (all 11 screens)

Shared auth feature code (forms, schemas, hooks)

Migration (0004_auth_backup_codes.sql)

netlify.toml config

Environment variables checklist — both local (.env.local) and
Netlify production env vars, with descriptions of where to obtain each.

A dependency install block:

pnpm add @supabase/ssr @marsidev/react-turnstile

pnpm add -D @netlify/functions

Any other packages needed

A verification checklist the developer can run manually:

Signup with new email → magic link arrives in inbox

Click magic link → redirected to /onboarding/pick-username

Pick username → redirected to /onboarding/welcome → skip → /chats

Open new tab to /chats → still logged in (cookie works)

Inspect cookies → sb-refresh-token is HttpOnly, Secure, SameSite=Lax

Try document.cookie in console → no auth tokens visible

Enable 2FA in /settings/security → QR scans, code verifies, backup
codes shown → saved

Sign out → sign in again → 2FA challenge appears

Use a backup code → 2FA removed, prompt to re-enroll

Turnstile fails (bad token) → signin returns error

Try GET /api/auth/refresh without cookie → 401

Try POST /api/auth/signin with bad Origin header → 403

Rate limit: send 31 magic links to same email in 1 hour → 31st fails

Session expired: manually expire cookie via DevTools → next API call
triggers SessionExpiredModal

A short list of pitfalls to warn the developer:

Why persistSession: false is mandatory (otherwise SDK writes to
localStorage and defeats the BFF)

Why autoRefreshToken: false (otherwise two refresh mechanisms compete
and one invalidates the other)

Why SameSite=Lax and not Strict (Strict breaks magic link callback
from email clients)

Why cookie Secure flag means HTTP localhost will NOT work — use
netlify dev or pnpm dev with HTTPS tunnel (e.g., ngrok) for local
magic link testing

Why Turnstile is on signup but not login (login has 30/hr rate limit
from Supabase, sufficient)

Why backup codes MUST be hashed client-side before insert (defense
against DB leak) AND compared server-side (client cannot be trusted for
auth decisions)

Why the 100ms URL token exposure in /auth/post-login is accepted
(documented limitation, Fase 2 fix)

Why the AAL2 refresh token rotation needs the workaround (Supabase
doesn't expose a clean way to rotate cookies after MFA from a SPA)

Why handle_new_user() (Prompt #4a) creates a placeholder username
user_xxxxxxxx — the onboarding forces a real one immediately

Do not implement /settings/devices UI, avatar picker, or toast system.
```
