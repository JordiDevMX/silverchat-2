# SILVERCHAT — PROMPT #6: PROFILE & USER SETTINGS

You are a senior full-stack engineer implementing the **complete user profile
and settings system** for SilverChat. This is the widest section of the
project — 14 distinct features across 5 blocks. All tables already exist
(from Prompt #4a); this prompt adds 2 schema columns, 2 RPCs, 1 trigger, 1
scheduled function, and 14 screens/modals.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

### Block A — Identity

- **A1**: Avatar gradient is **deterministic** via SHA-256 hash of `user_id`
  modulo 12 fixed gradient palettes (no DB column)
- **A2**: Avatar editor uses `react-easy-crop` + zoom slider (no pinch-to-zoom)
- **A3**: Username can change **once every 30 days** (tracked via new column
  `profiles.username_changed_at`)
- **A4**: Bio max length = **160 characters**

### Block B — Account & Security

- **B1**: Email change confirms **only on the new email** (Supabase native,
  no double opt-in)
- **B2**: Multi-account is **Fase 2**. MVP = one account at a time. "Add
  another account" signs out current + goes to `/auth/login`.
- **B3**: Device fingerprint = `crypto.randomUUID()` stored in
  `localStorage['silverchat_device_id']`. Sent to BFF on every login/refresh.
  New column `devices.device_fingerprint` + `UNIQUE(user_id, device_fingerprint)`.
- **B4**: Account deletion has **30-day grace period in MVP**:
  - `profiles.scheduled_deletion_at` new column
  - Banner visible globally while pending
  - Cancel button clears it
  - Daily Netlify Scheduled Function executes hard delete after grace
  - Actual deletion = `supabaseAdmin.auth.admin.deleteUser(uid)` → cascade
- **B5**: "Sign out all devices" = signs out all **except current**

### Block C — Privacy

- **C1**: Block can be triggered from 2 places (both call the same
  `INSERT INTO user_blocks`):
  - **Chat list long-press** → context menu → "Block" (UI in Prompt #7)
  - **Chat settings** → "Block" (UI in Prompt #8)
    This prompt implements the confirmation modal + the actual INSERT + a
    supplementary **trigger** preventing direct messages between blocked users
    in either direction.
- **C2**: `contacts_except` visibility uses a **multi-select modal** to
  manage exclusions per field (`profile_photo_exclusions` / `story_exclusions`)
- **C3**: Disabling read receipts shows a **warning modal** explaining the
  bidirectional fair-trade rule before saving

### Block D — Appearance

- **D1**: Theme/accent/language persisted **both** in `localStorage` (instant,
  pre-login) AND `user_settings` (server-side, cross-device). Login syncs
  from server to localStorage.

### Block E — Notifications

- **E1**: MVP = **in-app notifications only** (toasts). Web Push is Fase 2
  (Prompt #13). Toggles still work but affect only in-app behavior. A small
  info line under the toggles explains this.

### Social links

- **5 fixed platforms**: `twitter`, `facebook`, `instagram`, `telegram`,
  `discord` — single string each
- **Unlimited custom links**: array of `{ label, url }` — no URL validation
  (per user request; garbage in = garbage out is accepted)
- **Max 20 custom links**
- **Max 500 chars per URL/label**
- **Stored in** `profiles.social_links` (existing `jsonb` field)

---

## 2. SUPPLEMENTARY MIGRATIONS

### 2.1 `supabase/migrations/0005_profile_settings.sql`

```sql
-- 1. Username change tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz NULL;

-- 2. Account deletion grace period
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion
  ON public.profiles(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

-- 3. Device fingerprint (replaces user_agent as the UNIQUE key)
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS device_fingerprint text NULL;

-- Drop old unique constraint from Prompt #5
ALTER TABLE public.devices
  DROP CONSTRAINT IF EXISTS devices_user_agent_unique;

-- Add new unique constraint on (user_id, device_fingerprint)
-- Nullable fingerprint = opt-out devices that can't be uniquely identified
ALTER TABLE public.devices
  ADD CONSTRAINT devices_user_fingerprint_unique
  UNIQUE (user_id, device_fingerprint);

CREATE INDEX IF NOT EXISTS idx_devices_fingerprint
  ON public.devices(user_id, device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

-- 4. Username change trigger
CREATE OR REPLACE FUNCTION validate_username_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    -- Reject placeholder pattern as a target (only onboarding can exit it)
    IF NEW.username ~ '^user_[a-f0-9]{8}$' AND OLD.username NOT LIKE 'user\_%' THEN
      RAISE EXCEPTION 'Username cannot match the placeholder pattern';
    END IF;

    -- Cooldown: 30 days between changes (NULL = first change, allowed)
    IF OLD.username_changed_at IS NOT NULL
       AND OLD.username_changed_at > now() - interval '30 days' THEN
      RAISE EXCEPTION
        'Username can only be changed once every 30 days. Next change available on %',
        (OLD.username_changed_at + interval '30 days')::date;
    END IF;

    NEW.username_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_username_change_validation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION validate_username_change();

-- 5. Block enforcement trigger (supplementary fix to Prompt #4b-2)
-- Prevents direct messages in either direction between blocked users
CREATE OR REPLACE FUNCTION check_blocked_on_message_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_type chat_type;
  v_other_user uuid;
BEGIN
  IF NEW.chat_id IS NULL OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT type INTO v_chat_type FROM chats WHERE id = NEW.chat_id;
  IF v_chat_type IS DISTINCT FROM 'direct' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_other_user
  FROM chat_members
  WHERE chat_id = NEW.chat_id AND user_id <> NEW.sender_id
  LIMIT 1;

  IF v_other_user IS NOT NULL
     AND is_blocked_either_way(NEW.sender_id, v_other_user) THEN
    RAISE EXCEPTION 'Cannot send message: user is blocked';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_block_check
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION check_blocked_on_message_insert();

  2.2 RPCs — supabase/migrations/0006_account_deletion_rpcs.sql
sql
-- Schedule account deletion (30-day grace)
CREATE OR REPLACE FUNCTION schedule_account_deletion()
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled timestamptz;
BEGIN
  -- Idempotent: if already scheduled, return existing date
  SELECT scheduled_deletion_at INTO v_scheduled
  FROM profiles WHERE id = auth.uid();

  IF v_scheduled IS NOT NULL THEN
    RETURN v_scheduled;
  END IF;

  v_scheduled := now() + interval '30 days';
  UPDATE profiles SET scheduled_deletion_at = v_scheduled WHERE id = auth.uid();
  RETURN v_scheduled;
END;
$$;

GRANT EXECUTE ON FUNCTION schedule_account_deletion() TO authenticated;

-- Cancel scheduled deletion
CREATE OR REPLACE FUNCTION cancel_account_deletion()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET scheduled_deletion_at = NULL WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_account_deletion() TO authenticated;
2.3 Netlify Scheduled Function — netlify/functions/cleanup-deleted-accounts.ts
ts
import type { Config, Context } from '@netlify/functions';
import { supabaseAdmin } from './_lib/supabase-admin';

export default async (req: Request, _ctx: Context) => {
  const { data: expired, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .not('scheduled_deletion_at', 'is', null)
    .lt('scheduled_deletion_at', new Date().toISOString());

  if (error) {
    console.error('[cleanup-deleted-accounts] query failed:', error);
    return new Response('error', { status: 500 });
  }

  let deleted = 0;
  for (const profile of expired ?? []) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
    if (delErr) {
      console.error(`[cleanup] deleteUser(${profile.id}) failed:`, delErr);
      continue;
    }
    deleted++;
  }

  console.log(`[cleanup-deleted-accounts] Deleted ${deleted} of ${expired?.length ?? 0} expired accounts`);
  return new Response(JSON.stringify({ deleted, total: expired?.length ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  schedule: '0 4 * * *', // daily at 04:00 UTC
};
3. FRONTEND LIBRARIES
3.1 src/lib/avatar.ts — gradient + initials
ts
// 12 fixed gradient palettes. Same in light and dark mode.
export const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#8B5CF6', '#EC4899'],
  ['#3B82F6', '#06B6D4'],
  ['#10B981', '#14B8A6'],
  ['#F97316', '#EF4444'],
  ['#EC4899', '#A855F7'],
  ['#1E40AF', '#94A3B8'],
  ['#F59E0B', '#EA580C'],
  ['#84CC16', '#65A30D'],
  ['#D946EF', '#F472B6'],
  ['#06B6D4', '#3B82F6'],
  ['#DC2626', '#F97316'],
  ['#64748B', '#94A3B8'],
] as const;

export async function getGradientForUser(userId: string): Promise<readonly [string, string]> {
  const data = new TextEncoder().encode(userId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const byte = new Uint8Array(hashBuffer)[0] ?? 0;
  return AVATAR_GRADIENTS[byte % AVATAR_GRADIENTS.length];
}

export function getInitials(profile: {
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  username: string;
}): string {
  const first = profile.first_name?.trim();
  const last = profile.last_name?.trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return (first[0] + first[first.length - 1]).toUpperCase();
  const parts = profile.display_name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return profile.username.slice(0, 2).toUpperCase();
}

export function getCSSGradient(gradient: readonly [string, string]): string {
  return `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`;
}
3.2 src/lib/devices.ts — fingerprint
ts
const STORAGE_KEY = 'silverchat_device_id';

export function getOrCreateDeviceFingerprint(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'storage-unavailable-' + crypto.randomUUID();
  }
}

export function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return 'iOS Device';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Web Browser';
}
3.3 src/lib/social-links.ts — normalized structure
ts
export interface SocialLinks {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  telegram?: string;
  discord?: string;
  custom?: Array<{ label: string; url: string }>;
}

export const FIXED_PLATFORMS = [
  { key: 'twitter',   label: 'Twitter / X', placeholder: 'https://x.com/you' },
  { key: 'facebook',  label: 'Facebook',    placeholder: 'https://facebook.com/you' },
  { key: 'instagram', label: 'Instagram',   placeholder: 'https://instagram.com/you' },
  { key: 'telegram',  label: 'Telegram',    placeholder: 'https://t.me/you' },
  { key: 'discord',   label: 'Discord',     placeholder: 'your#0000 or invite URL' },
] as const;

export const MAX_CUSTOM_LINKS = 20;
export const MAX_FIELD_LENGTH = 500;

export function normalizeSocialLinks(input: SocialLinks): SocialLinks {
  const out: SocialLinks = {};
  for (const { key } of FIXED_PLATFORMS) {
    const val = input[key as keyof SocialLinks];
    if (typeof val === 'string' && val.trim()) {
      out[key as 'twitter'] = val.trim().slice(0, MAX_FIELD_LENGTH);
    }
  }
  const custom = (input.custom ?? [])
    .filter((c) => c && (c.label?.trim() || c.url?.trim()))
    .slice(0, MAX_CUSTOM_LINKS)
    .map((c) => ({
      label: (c.label ?? '').trim().slice(0, MAX_FIELD_LENGTH),
      url: (c.url ?? '').trim().slice(0, MAX_FIELD_LENGTH),
    }));
  if (custom.length) out.custom = custom;
  return out;
}
3.4 Avatar upload flow — src/lib/avatar-upload.ts
Uses browser-image-compression (already installed from Prompt #4a).
Target: max 512×512, quality 0.85, WebP output (~30–50 KB).

ts
import imageCompression from 'browser-image-compression';

export async function optimizeAvatar(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 512,
    initialQuality: 0.85,
    fileType: 'image/webp',
    useWebWorker: true,
  });
  return new File([compressed], `avatar-${Date.now()}.webp`, {
    type: 'image/webp',
  });
}

// Full upload flow used by the editor modal:
// 1. optimizeAvatar(file)
// 2. build path: avatars/${userId}/avatar-${Date.now()}.webp
// 3. INSERT INTO file_uploads (bucket='avatars', path, ...status='pending')
// 4. supabase.storage.from('avatars').upload(path, compressedFile)
// 5. UPDATE file_uploads SET status='completed' WHERE id
// 6. UPDATE profiles SET avatar_url = storage path
// 7. DELETE previous file_uploads row + storage object (cleanup)
4. SCREENS (14 routes + 4 modals + 1 global banner)
All screens live under /settings (route group _authenticated.settings.tsx
pathless layout). /profile/:username is a standalone authenticated route.

4.1 /settings — Settings index
Content (in order):

Profile card: large Avatar (gradient fallback if no avatar_url) +
display name + @username + "Edit profile" button → /settings/profile

Sections (list of rows with chevrons):

Account → /settings/account

Devices → /settings/devices

Storage → /settings/storage

Privacy → /settings/privacy

Appearance → /settings/appearance

Notifications → /settings/notifications

About → /settings/about

Log out button (destructive styling, bottom of page) → opens logout
confirmation modal (4.16)

4.2 /settings/profile — Edit profile
Fields:

Avatar: large avatar at top, tappable → opens avatar picker modal (4.15)

Display name: text input, 1–50 chars, required

First name / Last name: two text inputs (used for initials), each 0–50
chars, optional

Username: text input with @ prefix, 3–20 chars, regex ^[a-z0-9_]+$.
On submit: same availability flow as Prompt #5 onboarding. Cooldown of 30
days enforced by DB trigger — client shows a disabled state + helper text
if username_changed_at > now() - 30d:
"You can change your username again on {date}."

Bio: textarea, max 160 chars, counter bottom-right

Social links: opens /settings/profile/social modal-like sub-screen
(4.13)

Save button: disabled unless any field changed

Validation schemas (Zod):

ts
const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(50),
  first_name: z.string().trim().max(50).nullable(),
  last_name: z.string().trim().max(50).nullable(),
  username: z.string().trim().toLowerCase().min(3).max(20).regex(/^[a-z0-9_]+$/),
  bio: z.string().trim().max(160).nullable(),
});
Submit flow:

Validate with Zod

If username changed → check availability (SELECT 1 ... WHERE username = ? AND id != auth.uid())

If available → UPDATE (triggers may raise on cooldown → show error toast)

On 23505 unique violation → "Someone just took this username. Try another."

On success → toast "Profile updated" + invalidate profile query

4.3 /settings/profile/social — Social links editor
Full page (nested under /settings/profile). Two sections:

Fixed platforms — 5 rows, each with an icon + label + URL input
(placeholder from FIXED_PLATFORMS).

Custom links — vertical list of { label, url } rows with a trash
button per row. "+ Add custom link" button below, disabled when count reaches
MAX_CUSTOM_LINKS.

Bottom: "Save links" button.

No validation beyond length limits (per user request). Empty fields are
removed on save via normalizeSocialLinks.

4.4 /settings/account — Account
Sections:

Email — current email + "Change email" button

On click → modal with new email input + "Confirm" → calls
supabase.auth.updateUser({ email }) → toast "Confirmation sent to
{newEmail}. Click the link to complete the change." (current email
remains active until new email is confirmed)

Delete account — destructive row

On click → modal (4.18) → on confirm → schedule_account_deletion() RPC

After scheduling → banner appears globally, this screen shows
"Deletion scheduled for {date}. [Cancel]" instead of the danger button

4.5 /settings/devices — Devices
List of rows from devices table (WHERE user_id = auth.uid() ORDER BY last_active_at DESC). Each row:

Device name (device_name from getDeviceName() on first login)

"Last active {relative time}" (via Intl.RelativeTimeFormat)

If device_fingerprint === getOrCreateDeviceFingerprint() → "This device"
badge

"Sign out" button per row (except current) → calls a new BFF endpoint
POST /api/auth/sign-out-device with { deviceId } → BFF calls
supabaseAdmin.auth.admin.signOut(device.access_token, 'local')

Note: requires storing access_token per device at login time. For
MVP simplicity, MVP implements only "Sign out all except current" (B5)
and displays the list read-only + a single "Sign out all other devices"
button. Per-device sign-out is Fase 2.

Header button: "Sign out all other devices" → confirmation modal → BFF
POST /api/auth/logout-all with scope: 'others'

4.6 /settings/storage — Storage usage
Total usage card: "X MB used" + big number (from get_my_storage_usage()
RPC — already implemented in Prompt #4b-2)

Breakdown by bucket (client-side GROUP BY on file_uploads where
uploader_id = auth.uid()):

Avatars: X MB

Chat media: X MB

Stories: X MB

Progress bar showing total against app_config.upload.max_bytes sum (soft
indicator only — quotas aren't enforced in MVP)

Footer note: "Files are automatically compressed on upload. Larger limits
may apply."

4.7 /settings/privacy — Privacy menu
Rows (each → sub-screen or inline section):

Blocked contacts → /settings/privacy/blocked

Profile photo → /settings/privacy/visibility#photo

Last seen & online → /settings/privacy/visibility#presence

Stories → /settings/privacy/visibility#stories

Read receipts → inline toggle (4.8)

4.8 Read receipts toggle (inline in /settings/privacy)
Toggle with label "Send read receipts". Under the toggle:
"When on, others can see when you've read their messages. When off, you won't see their read receipts either."

Toggle off → warning modal (4.19) → on confirm → UPDATE user_settings SET read_receipts_enabled = false.

4.9 /settings/privacy/blocked — Blocked contacts
Header: "Blocked contacts ({count})"

List of users from user_blocks JOIN profiles_visible on blocked_id

Each row: avatar + display_name + @username + "Unblock" button

On unblock → DELETE FROM user_blocks WHERE blocker_id = auth.uid() AND blocked_id = target → toast + optimistic UI update

Empty state: "You haven't blocked anyone."

4.10 /settings/privacy/visibility — Visibility settings
Three sections (anchored: #photo, #presence, #stories):

Photo / Presence / Stories each show 4 radio options:

Everyone

My contacts

My contacts except… → reveals "Manage exclusions ({N})" button

Nobody

Saving via UPDATE user_settings for the corresponding columns. The
"Manage exclusions" button opens modal 4.17.

Presence is different — it's a single toggle instead of 4 options:

Toggle "Show when I'm online and last seen"

On off → presence_visible = false (no exclusions list)

4.11 /settings/appearance — Appearance
Theme: 3 buttons (Light / Dark / System) — segmented control

Accent color: 6 color swatches (blue/purple/red/orange/yellow/green)
with active ring

Language: dropdown (English / Español)

Persistence on change:

Update <html class="theme-*" data-theme="*"> + lang="xx" immediately

localStorage.setItem('silverchat_theme', ...) etc.

Async UPDATE user_settings (debounced 500ms)

4.12 /settings/notifications — Notifications
Three toggles (all from user_settings):

"Notifications" → notifications_enabled

"Sound" → notification_sound_enabled (disabled if the above is off)

"Message previews" → notification_previews_enabled (disabled if the above
is off)

Info note below: "Push notifications require installing the app. In-browser notifications are shown while the app is open in a tab."

4.13 /settings/about — About
App icon + name

Version: read from import.meta.env.VITE_APP_VERSION (set at build time via
package.json)

Rows:

"Terms of Service" → external link (placeholder)

"Privacy Policy" → external link (placeholder)

"Open-source licenses" → link to lucide-react, @supabase/supabase-js,
etc. (static page, optional)

"Sign out" red button → logout modal (4.16)

4.14 /profile/:username — Public profile
Fetches from profiles_visible by username. Layout:

Banner with gradient (same hash-based gradient)

Large avatar (or initials fallback), positioned half-overlapping banner

Display name + @username + bio

Social links list (fixed platforms as clickable pills, then custom links)

"Send message" button → calls create_direct_chat_request(target_id, '')
(RPC from Prompt #4b-2) → navigate to /chats/{chatId}

If it's your own profile → "Edit profile" button instead

4.15 Avatar picker modal (component)
Triggered from /settings/profile when tapping avatar.

Content:

Grid of 4 actions:

"View photo" (if avatar_url exists)

"Take photo" (opens device camera via <input type="file" capture="user">)

"Upload photo" (standard file picker)

"Remove photo" (if avatar_url exists — destructive styling)

Cancel button at bottom

After selecting a file → transitions to crop view:

react-easy-crop circular crop

Zoom slider (1x–3x)

Cancel + Save buttons

On Save → optimizeAvatar(file) → upload flow (section 3.4) → close modal
→ toast "Profile photo updated"

4.16 Logout confirmation modal (component)
Content:

Title: "Log out of SilverChat?"

Body: "You'll need to sign in again with a magic link."

Buttons: "Cancel" (secondary) / "Log out" (destructive)

Checkbox (unchecked by default): "Also sign out of all other devices"

When checked → after logout, calls POST /api/auth/logout-all with
scope: 'all'

4.17 Manage exclusions modal (component)
Triggered from /settings/privacy/visibility.

Content:

Title: "Hide your {photo/presence/story} from…"

Search bar (client-side filter over current contacts)

Scrollable list of contacts (from chat_members JOIN profiles_visible
where the current user is also a member of an active direct chat)

Each row: avatar + display name + checkbox

Footer: "Cancel" / "Save ({N} excluded)"

On Save → UPDATE user_settings SET profile_photo_exclusions = ARRAY[...]
(or story_exclusions depending on context)

4.18 Delete account modal (component)
Content:

Title: "Delete your account?"

Body (paragraph 1): "Your account will be permanently deleted after a
30-day grace period. During this time, you can cancel this from any device."

Body (paragraph 2): "Your messages will remain visible to other users in
your conversations but attributed to 'Deleted User'. Your profile, avatar,
and personal data will be removed."

Confirmation input: "Type DELETE to confirm"

Buttons: "Cancel" / "Schedule deletion" (disabled until text matches)

On confirm → schedule_account_deletion() RPC → close modal → global banner
appears

4.19 Disable read receipts warning modal (component)
Content:

Title: "Turn off read receipts?"

Body: "When read receipts are off, you won't see when others have read your
messages, and they won't see when you've read theirs. This applies to
everyone until you turn it back on."

Buttons: "Keep enabled" / "Turn off"

4.20 Global banner — Pending deletion
Rendered at the app root (in _authenticated.tsx layout) when
profile.scheduled_deletion_at IS NOT NULL.

Content:

Destructive background

Text: "Your account will be deleted on {date}. [Cancel deletion]"

"Cancel deletion" button → cancel_account_deletion() RPC → banner disappears

Stays until canceled or the account is deleted by the scheduled function.

5. ROUTE STRUCTURE ADDITIONS
text
src/routes/
├── _authenticated.tsx                  (existing)
│   ├── settings.tsx                    (pathless layout with back button + title per child)
│   ├── settings.index.tsx              → /settings
│   ├── settings.profile.tsx            → /settings/profile
│   ├── settings.profile.social.tsx     → /settings/profile/social
│   ├── settings.account.tsx            → /settings/account
│   ├── settings.devices.tsx            → /settings/devices
│   ├── settings.storage.tsx            → /settings/storage
│   ├── settings.privacy.tsx            → /settings/privacy
│   ├── settings.privacy.blocked.tsx    → /settings/privacy/blocked
│   ├── settings.privacy.visibility.tsx → /settings/privacy/visibility
│   ├── settings.appearance.tsx         → /settings/appearance
│   ├── settings.notifications.tsx      → /settings/notifications
│   ├── settings.about.tsx              → /settings/about
│   └── profile.$username.tsx           → /profile/:username
Plus src/features/settings/components/ for all modals:

AvatarPickerModal.tsx

LogoutConfirmModal.tsx

ManageExclusionsModal.tsx

DeleteAccountModal.tsx

DisableReadReceiptsModal.tsx

PendingDeletionBanner.tsx

6. BLOCK ACTION (from C1)
The blocking operation itself (invoked from Prompt #7's chat long-press menu
or Prompt #8's chat settings menu):

ts
async function blockUser(targetUserId: string) {
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: auth.user.id, blocked_id: targetUserId });
  if (error && error.code !== '23505') throw error; // ignore duplicate
  // Confirmation toast + close menu + invalidate relevant queries
}
A confirmation modal ("Block {displayName}? They won't be able to message
you, and you won't see their messages.") is defined here for reuse by both
trigger points.

After blocking:

The chat with this user appears under the "blocked" filter (Prompt #7)

messages_block_check trigger prevents new messages in either direction

profiles_visible filters them out from search results

The chat is NOT deleted (visible under "blocked" filter)

7. WHAT NOT TO INCLUDE
❌ Multi-account switching (Fase 2)

❌ Web Push notifications (Fase 2)

❌ Per-device remote sign-out (Fase 2 — only "sign out all except current"
in MVP)

❌ Double opt-in email change (single confirmation only)

❌ URL validation for social links (accepted: garbage in, garbage out)

❌ Avatar upload to a separate bucket (uses avatars bucket from Prompt
#4a)

❌ Realtime subscription for settings changes (not needed — single-user)

❌ The chat long-press menu UI (Prompt #7)

❌ The chat settings menu UI (Prompt #8)

❌ Typing indicators, presence dots (Fase 2)

❌ Toast system implementation (assumed available from earlier prompts;
if not, use a minimal inline implementation)

8. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: 2 migrations (0005 schema +
trigger, 0006 RPCs), 1 Netlify Scheduled Function, 14 screens, 6 modals +
banner, avatar gradient algorithm, 5+unlimited social links, 30-day
deletion grace period.

Complete file tree of new/modified files.

Complete content of every file, organized by category:

Migrations: 0005_profile_settings.sql, 0006_account_deletion_rpcs.sql

Netlify Scheduled Function: cleanup-deleted-accounts.ts

Frontend libs: avatar.ts, devices.ts, social-links.ts,
avatar-upload.ts

Routes: 13 route files under _authenticated.settings.* +
profile.$username.tsx

Feature components: 6 modals + 1 banner

Feature hooks (e.g., useProfile, useDeviceList,
useBlockedUsers): minimal React Query hooks wired to Supabase

Dependency install block:

pnpm add react-easy-crop

pnpm add -D @types/react-easy-crop (if needed)

browser-image-compression already installed in Prompt #4a

A verification checklist the developer can run manually:

Change display name → persists after reload

Change username → succeeds; second immediate change shows cooldown error

Upload avatar → optimized to <100KB WebP → shown everywhere (settings
index, profile, header)

Remove avatar → gradient + initials return

Change email → confirmation arrives at new email → click → email updated

Block a user → confirmation modal → blocked row appears in
/settings/privacy/blocked → sending a message from either side fails

Unblock → messages work again

Toggle "Everyone / Contacts / Contacts except… / Nobody" for profile
photo → verify via /profile/:other that avatar is hidden for a
non-contact, or hidden for excluded contacts

Change theme to dark + accent purple → persists across reload, applies
instantly

Change language to Español → UI strings update on next render

Schedule account deletion → banner appears → login from another browser
shows banner → cancel works → banner disappears

Let a test account's scheduled_deletion_at be set to yesterday via SQL
→ run the Netlify scheduled function locally → user is deleted

/settings/storage shows correct MB usage from get_my_storage_usage()

/settings/devices shows current device with "This device" badge →
"Sign out all other devices" works after re-login from a second browser

A short list of pitfalls to warn the developer:

Why the username trigger raises on username_changed_at > now() - 30 days
(cooldown enforced by DB, not app — cannot be bypassed)

Why messages_block_check runs as SECURITY DEFINER (needs cross-user
reads to chat_members and user_blocks)

Why the pending-deletion banner must be at the layout root, not in
/settings (must be visible on every screen)

Why device_fingerprint is nullable (some browsers with strict
fingerprinting protection may clear localStorage)

Why gradient is deterministic via SHA-256 (no DB column, consistent
across devices, immune to cache clears)

Why avatar is optimized client-side to WebP before upload (per Prompt
#4a section 6.2)

Why social links use jsonb with a normalized TypeScript shape (no
schema migration needed to add fields)

Why the Netlify scheduled function uses auth.admin.deleteUser (cascade
handles profiles, messages sender_id → NULL, etc., per Prompt #4a FKs)

Why blocking does NOT delete the chat (WhatsApp parity — visible under
"blocked" filter in Prompt #7)
```
