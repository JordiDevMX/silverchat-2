# SILVERCHAT — PROMPT #15: PRIVACY & SECURITY (WIRING PASS)

You are a senior frontend engineer completing the **privacy and security
settings** for SilverChat. This is mostly a **wiring pass**: the UI screens
were designed in Prompts #5 and #6, and the backend (RLS, RPCs, tables) was
built in Prompts #4a, #4b-1 and #4b-2. This prompt connects them.

This prompt adds:

- A new `/settings/security` screen with a security summary card
- Real data wiring for all existing privacy/security settings screens
- Cables for account deletion, device management, storage usage, blocked
  contacts, visibility settings, read receipts toggle

**Not covered here**: session timeout (Fase 2), new-device email alerts
(Fase 2), GDPR data export (Fase 2), login history (Fase 2), app lock / PIN
/ biometrics / passkeys (explicitly out of scope, not planned), per-device
sign-out (omitted, only "sign out all except current" exists).

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- |
| S1  | Add "Security" to Settings index, between "Account" and "Devices"                                          |
| S2  | Session timeout → **Fase 2** (not in MVP)                                                                  |
| S3  | New-device email alerts → **Fase 2** (not in MVP)                                                          |
| S4  | 2FA management stays in `SecurityScreen` from Prompt #5 (no duplication)                                   |
| S5  | Security summary card with 4 checks: 2FA enabled, backup codes saved, email verified, active devices count |
| S6  | GDPR data export → **Fase 2** (not in MVP)                                                                 |
| S7  | Login history → **Fase 2** (not in MVP)                                                                    |
| S8  | App lock / PIN / biometrics / passkeys → **NOT PLANNED** (explicitly out of scope)                         |
| S9  | Per-device sign-out → **NOT PLANNED** (only "sign out all except current")                                 |

Additional locked decisions:

- **No new migrations.** All columns, tables, RPCs and triggers needed
  already exist from Prompts #4a, #4b-1, #4b-2, #5, #6.
- **No new RPCs.** Wiring uses existing RPCs (`get_my_storage_usage`,
  `schedule_account_deletion`, `cancel_account_deletion`, `mark_chat_as_read`,
  `mark_chat_as_unread`) and direct queries on existing tables.
- **The security summary card** is informational only — no actions inside it
  beyond "Manage" links.
- **"Backup codes saved"** is derived from `SELECT COUNT(*) FROM
two_factor_backup_codes WHERE user_id = auth.uid() AND used_at IS NULL`.
  If count > 0 → "Saved", else → "Not set up".
- **"Email verified"** is assumed true in MVP (the user authenticated via
  magic link). Always shows ✅.
- **"Active devices"** count = `SELECT COUNT(*) FROM devices WHERE user_id =
auth.uid() AND last_active_at > now() - interval '30 days'`.
- **Read receipts toggle** shows the fair-trade warning modal (from #6)
  before saving when toggling OFF.
- **No visual change to existing screens** beyond the wiring. If any screen
  is a stub, this prompt replaces the stub with real data fetching.
- **All existing hooks** (`useTheme`, `useLanguage`, `usePushSubscription`,
  etc.) remain untouched.

---

## 2. FILE STRUCTURE

src/features/settings/
├── components/
│ ├── SettingsIndex.tsx (modified — add Security entry)
│ ├── SecurityScreen.tsx (NEW)
│ ├── SecuritySummaryCard.tsx (NEW)
│ ├── AccountScreen.tsx (modified — real email/delete)
│ ├── DevicesScreen.tsx (modified — real list)
│ ├── StorageScreen.tsx (modified — real usage)
│ ├── BlockedContactsScreen.tsx (modified — real list)
│ ├── VisibilityScreen.tsx (modified — real visibility)
│ ├── PrivacyScreen.tsx (modified — real receipts toggle)
│ └── ManageExclusionsModal.tsx (modified — real save)
├── hooks/
│ ├── useSecuritySummary.ts (NEW)
│ ├── useDevices.ts (NEW)
│ ├── useStorageUsage.ts (NEW)
│ ├── useBlockedContacts.ts (NEW)
│ └── usePrivacySettings.ts (NEW)

text

Modified routes:

- `src/routes/_authenticated.settings.security.tsx` — new route pointing to
  `<SecurityScreen />`

---

## 3. ROUTES

Add to the Settings route tree:
/ → /settings
/settings → SettingsIndex
/settings/profile → ProfileScreen (unchanged)
/settings/profile/social → SocialLinksScreen (unchanged)
/settings/account → AccountScreen (wired here)
/settings/security → SecurityScreen (NEW)
/settings/devices → DevicesScreen (wired here)
/settings/storage → StorageScreen (wired here)
/settings/privacy → PrivacyScreen (wired here)
/settings/privacy/blocked → BlockedContactsScreen (wired here)
/settings/privacy/visibility → VisibilityScreen (wired here)
/settings/appearance → AppearanceScreen (unchanged — from #14)
/settings/notifications → NotificationsScreen (unchanged)
/settings/about → AboutScreen (unchanged)

text

---

## 4. HOOKS

### 4.1 `useSecuritySummary()`

Aggregates 4 checks for the summary card.

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-provider';

interface SecuritySummary {
  twoFactorEnabled: boolean;
  backupCodesSaved: boolean;
  emailVerified: boolean;       // always true in MVP
  activeDevicesCount: number;
}

export function useSecuritySummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['security-summary', user?.id],
    queryFn: async (): Promise<SecuritySummary> => {
      if (!user) throw new Error('Not authenticated');

      // 2FA factors
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const twoFactorEnabled = (factors?.totp?.length ?? 0) > 0;

      // Backup codes count
      const { count: backupCount } = await supabase
        .from('two_factor_backup_codes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('used_at', null);

      // Active devices (last 30 days)
      const { count: deviceCount } = await supabase
        .from('devices')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());

      return {
        twoFactorEnabled,
        backupCodesSaved: (backupCount ?? 0) > 0,
        emailVerified: true,
        activeDevicesCount: deviceCount ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
4.2 useDevices()
ts
export function useDevices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['devices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('id, device_name, device_type, device_fingerprint, last_active_at, created_at')
        .eq('user_id', user!.id)
        .order('last_active_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useSignOutAllDevices() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'others' }),
      });
      if (!res.ok) throw new Error('Failed to sign out');
    },
  });
}
Note: the /api/auth/logout-all endpoint does not exist yet. Add it
as a new Netlify Function that calls
supabaseAdmin.auth.admin.signOut(userId, 'others') with the current user's
token excluded. See section 7 for its implementation.

4.3 useStorageUsage()
ts
export function useStorageUsage() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['storage-usage', user?.id],
    queryFn: async () => {
      const { data: total, error } = await supabase.rpc('get_my_storage_usage');
      if (error) throw error;

      // Per-bucket breakdown
      const { data: byBucket } = await supabase
        .from('file_uploads')
        .select('bucket, size_bytes')
        .eq('uploader_id', user!.id)
        .eq('status', 'completed');

      const buckets: Record<string, number> = {};
      for (const row of byBucket ?? []) {
        buckets[row.bucket] = (buckets[row.bucket] ?? 0) + Number(row.size_bytes);
      }

      return { total: Number(total ?? 0), byBucket: buckets };
    },
    enabled: !!user,
  });
}
4.4 useBlockedContacts()
ts
export function useBlockedContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['blocked-contacts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select(`
          blocked_id,
          created_at,
          profile:profiles_visible!user_blocks_blocked_id_fkey (
            id, username, display_name, avatar_url
          )
        `)
        .eq('blocker_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', user!.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blocked-contacts'] });
      qc.invalidateQueries({ queryKey: ['chats'] });
    },
  });
}
4.5 usePrivacySettings()
ts
export interface PrivacySettings {
  profile_photo_visibility: 'everyone' | 'contacts' | 'contacts_except' | 'nobody';
  profile_photo_exclusions: string[];
  presence_visible: boolean;
  story_visibility: 'everyone' | 'contacts' | 'contacts_except' | 'nobody';
  story_exclusions: string[];
  read_receipts_enabled: boolean;
}

export function usePrivacySettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['privacy-settings', user?.id],
    queryFn: async (): Promise<PrivacySettings> => {
      const { data, error } = await supabase
        .from('user_settings')
        .select(`
          profile_photo_visibility,
          profile_photo_exclusions,
          presence_visible,
          story_visibility,
          story_exclusions,
          read_receipts_enabled
        `)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as PrivacySettings;
    },
    enabled: !!user,
  });
}

export function useUpdatePrivacySettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (updates: Partial<PrivacySettings>) => {
      const { error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['privacy-settings'] });
      qc.invalidateQueries({ queryKey: ['security-summary'] });
    },
  });
}
5. NEW COMPONENTS
5.1 SecuritySummaryCard.tsx
tsx
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Check, AlertCircle, ChevronRight } from 'lucide-react';
import { useSecuritySummary } from '../hooks/useSecuritySummary';

export function SecuritySummaryCard() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useSecuritySummary();

  if (isLoading || !data) {
    return <div className="skeleton h-40 rounded-xl" />;
  }

  const items = [
    {
      label: t('security.twoFactor'),
      status: data.twoFactorEnabled ? 'ok' : 'warn',
      value: data.twoFactorEnabled ? t('security.enabled') : t('security.disabled'),
    },
    {
      label: t('security.backupCodes'),
      status: data.backupCodesSaved ? 'ok' : 'warn',
      value: data.backupCodesSaved ? t('security.saved') : t('security.notSetUp'),
    },
    {
      label: t('security.email'),
      status: 'ok',
      value: t('security.verified'),
    },
    {
      label: t('security.activeDevices'),
      status: 'neutral',
      value: String(data.activeDevicesCount),
      linkTo: '/settings/devices',
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🛡️</span>
        <h3 className="font-semibold">{t('security.title')}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {item.status === 'ok' && (
                <Check className="size-4 text-green-600 dark:text-green-400" />
              )}
              {item.status === 'warn' && (
                <AlertCircle className="size-4 text-amber-500" />
              )}
              {item.status === 'neutral' && (
                <span className="size-4" />
              )}
              <span>{item.label}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>{item.value}</span>
              {item.linkTo && (
                <Link to={item.linkTo}>
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
5.2 SecurityScreen.tsx
tsx
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { SecuritySummaryCard } from './SecuritySummaryCard';
import { TwoFactorSection } from './TwoFactorSection'; // existing from #5

export function SecurityScreen() {
  const { t } = useTranslation('settings');

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-semibold">{t('security.title')}</h1>

      <SecuritySummaryCard />

      <TwoFactorSection />

      <div className="rounded-xl border bg-card divide-y">
        <Link
          to="/settings/account"
          className="flex items-center justify-between p-4 hover:bg-muted/50"
        >
          <span>{t('security.changeEmail')}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          to="/settings/devices"
          className="flex items-center justify-between p-4 hover:bg-muted/50"
        >
          <span>{t('security.manageDevices')}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
Add these translation keys to settings.json (both en and es):

en/settings.json — add to security namespace:

json
"security": {
  "title": "Security",
  "twoFactor": "Two-factor authentication",
  "backupCodes": "Backup codes",
  "email": "Email",
  "activeDevices": "Active devices",
  "enabled": "Enabled",
  "disabled": "Not enabled",
  "saved": "Saved",
  "notSetUp": "Not set up",
  "verified": "Verified",
  "changeEmail": "Change email",
  "manageDevices": "Manage devices"
}
es/settings.json:

json
"security": {
  "title": "Seguridad",
  "twoFactor": "Autenticación de dos factores",
  "backupCodes": "Códigos de respaldo",
  "email": "Correo",
  "activeDevices": "Dispositivos activos",
  "enabled": "Activada",
  "disabled": "No activada",
  "saved": "Guardados",
  "notSetUp": "Sin configurar",
  "verified": "Verificado",
  "changeEmail": "Cambiar correo",
  "manageDevices": "Gestionar dispositivos"
}
Add security to the settings namespace entry in
src/routes/_authenticated.settings.tsx route tree.

6. MODIFICATIONS TO EXISTING SCREENS
6.1 SettingsIndex.tsx — add Security entry
Insert between Account and Devices:

tsx
<SettingsRow icon={<ShieldCheck />} label={t('sections.security')} to="/settings/security" />
<SettingsRow icon={<User />} label={t('sections.account')} to="/settings/account" />
<SettingsRow icon={<Smartphone />} label={t('sections.devices')} to="/settings/devices" />
Wait — order matters. Security goes between Account and Devices per S1.

Add key to settings.json:

en: "security": "Security" under sections

es: "security": "Seguridad" under sections

6.2 AccountScreen.tsx — real email + delete wiring
Replace the stub with:

tsx
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth-provider';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner'; // or your toast lib
import { ChangeEmailModal } from './ChangeEmailModal';
import { DeleteAccountModal } from './DeleteAccountModal';
import { PendingDeletionBanner } from './PendingDeletionBanner';

export function AccountScreen() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const qc = useQueryClient();

  // Get current profile (for scheduled_deletion_at)
  const { data: profile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, scheduled_deletion_at')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-semibold">{t('account.title')}</h1>

      {profile?.scheduled_deletion_at && (
        <PendingDeletionBanner
          scheduledAt={profile.scheduled_deletion_at}
          onCancel={async () => {
            await supabase.rpc('cancel_account_deletion');
            qc.invalidateQueries({ queryKey: ['my-profile'] });
            toast.success(t('account.cancelled'));
          }}
        />
      )}

      <div className="rounded-xl border bg-card divide-y">
        <button
          onClick={() => setShowChangeEmail(true)}
          className="w-full text-left p-4 hover:bg-muted/50 flex items-center justify-between"
        >
          <div>
            <div className="font-medium">{t('account.email')}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
          </div>
          <span className="text-sm text-primary">{t('account.changeEmail')}</span>
        </button>

        {!profile?.scheduled_deletion_at && (
          <button
            onClick={() => setShowDelete(true)}
            className="w-full text-left p-4 hover:bg-destructive/5 text-destructive"
          >
            {t('account.deleteAccount')}
          </button>
        )}
      </div>

      {showChangeEmail && <ChangeEmailModal onClose={() => setShowChangeEmail(false)} />}
      {showDelete && <DeleteAccountModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}
ChangeEmailModal (component reused from #6 — verify exists): calls
supabase.auth.updateUser({ email: newEmail }) and shows the toast
t('account.emailChanged') with the new email interpolated.

DeleteAccountModal (component reused from #6 — verify exists): type
"DELETE" to confirm, then supabase.rpc('schedule_account_deletion') and
invalidate ['my-profile'].

6.3 DevicesScreen.tsx
tsx
export function DevicesScreen() {
  const { t } = useTranslation('settings');
  const { data: devices, isLoading } = useDevices();
  const { mutate: signOutAll } = useSignOutAllDevices();
  const currentFingerprint = getOrCreateDeviceFingerprint();

  // ... render list
  // Each row: device_name + last_active + (This device badge if fingerprint matches)
  // Footer: "Sign out all other devices" button
  // Confirmation modal on click → signOutAll
}
Reuse the confirmation modal pattern from #6. On success, invalidate
['devices'].

6.4 StorageScreen.tsx
tsx
export function StorageScreen() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useStorageUsage();
  const { formatBytes } = useFormatters(); // from #14

  if (isLoading || !data) return <Skeleton />;

  const breakdown = [
    { label: t('storage.avatars'), bytes: data.byBucket['avatars'] ?? 0 },
    { label: t('storage.chatMedia'), bytes: data.byBucket['chat-media'] ?? 0 },
    { label: t('storage.stories'), bytes: data.byBucket['story-media'] ?? 0 },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-xl font-semibold">{t('storage.title')}</h1>

      <div className="rounded-xl border bg-card p-6 text-center">
        <div className="text-3xl font-bold">{formatBytes(data.total)}</div>
        <div className="text-sm text-muted-foreground">
          {t('storage.totalUsed', { size: formatBytes(data.total) })}
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {breakdown.map(({ label, bytes }) => (
          <div key={label} className="flex items-center justify-between p-4 text-sm">
            <span>{label}</span>
            <span className="text-muted-foreground">{formatBytes(bytes)}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {t('storage.note')}
      </p>
    </div>
  );
}
6.5 BlockedContactsScreen.tsx
tsx
export function BlockedContactsScreen() {
  const { t } = useTranslation('settings');
  const { data: blocked, isLoading } = useBlockedContacts();
  const { mutate: unblock } = useUnblockUser();

  if (isLoading) return <Skeleton />;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">
        {t('privacy.blockedCount', { count: blocked?.length ?? 0 })}
      </h1>

      {!blocked?.length ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {t('privacy.emptyBlocked')}
        </p>
      ) : (
        <div className="rounded-xl border bg-card divide-y">
          {blocked.map(row => (
            <div key={row.blocked_id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Avatar user={row.profile} size={40} />
                <div>
                  <div className="font-medium">{row.profile.display_name}</div>
                  <div className="text-xs text-muted-foreground">
                    @{row.profile.username}
                  </div>
                </div>
              </div>
              <button
                onClick={() => unblock(row.blocked_id)}
                className="text-sm text-primary hover:underline"
              >
                {t('privacy.unblock')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
6.6 PrivacyScreen.tsx — read receipts toggle with warning
tsx
export function PrivacyScreen() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = usePrivacySettings();
  const { mutate } = useUpdatePrivacySettings();
  const [showWarning, setShowWarning] = useState(false);

  if (isLoading || !data) return <Skeleton />;

  const handleToggleReceipts = (next: boolean) => {
    if (!next && data.read_receipts_enabled) {
      setShowWarning(true);
    } else {
      mutate({ read_receipts_enabled: next });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">{t('privacy.title')}</h1>

      <div className="rounded-xl border bg-card divide-y">
        <SettingsLink to="/settings/privacy/blocked" label={t('privacy.blocked')} />
        <SettingsLink to="/settings/privacy/visibility#photo" label={t('privacy.photo')} />
        <SettingsLink to="/settings/privacy/visibility#presence" label={t('privacy.presence')} />
        <SettingsLink to="/settings/privacy/visibility#stories" label={t('privacy.stories')} />

        <div className="p-4">
          <div className="flex items-center justify-between">
            <span>{t('privacy.readReceipts')}</span>
            <Switch
              checked={data.read_receipts_enabled}
              onCheckedChange={handleToggleReceipts}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('privacy.readReceiptsHint')}
          </p>
        </div>
      </div>

      {showWarning && (
        <DisableReadReceiptsModal
          onConfirm={() => {
            mutate({ read_receipts_enabled: false });
            setShowWarning(false);
          }}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </div>
  );
}
DisableReadReceiptsModal — reused from #6 (verify exists).

6.7 VisibilityScreen.tsx
Wire the radio buttons + "Manage exclusions" modal with real
usePrivacySettings + useUpdatePrivacySettings.

tsx
export function VisibilityScreen() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = usePrivacySettings();
  const { mutate } = useUpdatePrivacySettings();
  const [exclusionContext, setExclusionContext] = useState<'photo' | 'stories' | null>(null);

  if (isLoading || !data) return <Skeleton />;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <VisibilitySection
        id="photo"
        title={t('privacy.photo')}
        value={data.profile_photo_visibility}
        exclusionsCount={data.profile_photo_exclusions.length}
        onValueChange={v => mutate({ profile_photo_visibility: v })}
        onManageExclusions={() => setExclusionContext('photo')}
      />

      <PresenceSection
        id="presence"
        title={t('privacy.presence')}
        value={data.presence_visible}
        onValueChange={v => mutate({ presence_visible: v })}
      />

      <VisibilitySection
        id="stories"
        title={t('privacy.stories')}
        value={data.story_visibility}
        exclusionsCount={data.story_exclusions.length}
        onValueChange={v => mutate({ story_visibility: v })}
        onManageExclusions={() => setExclusionContext('stories')}
      />

      {exclusionContext && (
        <ManageExclusionsModal
          context={exclusionContext}
          currentExclusions={
            exclusionContext === 'photo'
              ? data.profile_photo_exclusions
              : data.story_exclusions
          }
          onSave={ids => {
            mutate(
              exclusionContext === 'photo'
                ? { profile_photo_exclusions: ids }
                : { story_exclusions: ids }
            );
            setExclusionContext(null);
          }}
          onClose={() => setExclusionContext(null)}
        />
      )}
    </div>
  );
}
ManageExclusionsModal (from #6) needs its props wired here — verify it
accepts context, currentExclusions, onSave, onClose.

7. NEW NETLIFY FUNCTION: /api/auth/logout-all
File: netlify/functions/auth-logout-all.ts

ts
import type { Config, Context } from '@netlify/functions';
import { supabaseAdmin } from './_lib/supabase-admin';
import { verifyOrigin } from './_lib/cors';
import { clearCookie, REFRESH_COOKIE } from './_lib/cookies';

export default async (req: Request, _ctx: Context) => {
  if (!verifyOrigin(req)) {
    return new Response(JSON.stringify({ error: 'bad_origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get current user from token
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({}));
  const scope = body.scope === 'all' ? 'global' : 'others';

  // Sign out all sessions except this one (or all if scope === 'all')
  const { error } = await supabaseAdmin.auth.admin.signOut(user.id, scope);
  if (error) {
    return new Response(JSON.stringify({ error: 'signout_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If scope is 'global', also clear the current cookie
  if (scope === 'global') {
    headers['Set-Cookie'] = clearCookie(REFRESH_COOKIE);
  }

  return new Response(JSON.stringify({ ok: true, scope }), {
    status: 200,
    headers,
  });
};

export const config: Config = {
  path: '/api/auth/logout-all',
};
Note: signOut(userId, 'others') in Supabase Auth invalidates all
refresh tokens for the user except the current session (identified by the
access token used in the admin call). This effectively signs out all other
devices.

Also: delete rows from devices for the signed-out sessions (optional —
Fase 2 sync). For MVP, the devices list will refresh on the next query when
last_active_at becomes stale.

8. WHAT NOT TO INCLUDE
❌ Session timeout (Fase 2)

❌ New-device email alerts (Fase 2)

❌ GDPR data export (Fase 2)

❌ Login history (Fase 2)

❌ App lock, PIN, biometrics, passkeys (NOT PLANNED)

❌ Per-device sign-out (NOT PLANNED)

❌ Trusted devices marking (Fase 2)

❌ IP allowlist (Fase 2)

❌ Audit log UI (Fase 2)

❌ Any new DB migrations

❌ Modifications to AppearanceScreen, NotificationsScreen, AboutScreen

❌ Modifications to any component outside features/settings/

❌ Changes to existing hooks like useTheme, usePushSubscription

9. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: 1 new screen (SecurityScreen), 1
summary card, 5 new hooks, 6 wired screens, 1 new Netlify Function
(auth-logout-all), 2 new translation keys, 1 new route.

Complete file tree of new/modified files.

Complete content of every file:

src/features/settings/components/SecurityScreen.tsx (NEW)

src/features/settings/components/SecuritySummaryCard.tsx (NEW)

src/features/settings/hooks/useSecuritySummary.ts (NEW)

src/features/settings/hooks/useDevices.ts (NEW)

src/features/settings/hooks/useStorageUsage.ts (NEW)

src/features/settings/hooks/useBlockedContacts.ts (NEW)

src/features/settings/hooks/usePrivacySettings.ts (NEW)

src/routes/_authenticated.settings.security.tsx (NEW)

netlify/functions/auth-logout-all.ts (NEW)

Modified SettingsIndex.tsx (Security entry)

Modified AccountScreen.tsx (email + delete wiring)

Modified DevicesScreen.tsx (real list + sign out all)

Modified StorageScreen.tsx (real usage)

Modified BlockedContactsScreen.tsx (real list + unblock)

Modified PrivacyScreen.tsx (real receipts toggle)

Modified VisibilityScreen.tsx (real visibility)

Updated en/settings.json and es/settings.json (2 keys each:
sections.security, security.* block)

Verification checklist:

/settings shows a new "Security" row between Account and Devices

/settings/security renders the summary card + 2FA section + 2 links

Summary card shows "Not enabled" for 2FA if not set up

Enable 2FA → summary card updates to "Enabled" + "Saved" after backup
codes are generated

Disable 2FA → summary card back to "Not enabled"

/settings/devices lists all device rows sorted by last_active

Current device shows "This device" badge

"Sign out all other devices" → confirmation → signs out others →
after reload, only current device appears

/settings/storage shows correct MB from get_my_storage_usage()

Breakdown shows per-bucket usage

/settings/privacy → block someone from another account → they appear
in Blocked contacts

Unblock → row disappears, messages flow again

Toggle read receipts OFF → warning modal → confirm → receipts disabled

Toggle back ON → no warning, applies immediately

/settings/privacy/visibility — change each radio → reflected in DB
(user_settings table)

Manage exclusions → select 3 contacts → save → "Manage exclusions (3)"
shown

/settings/account shows current email

Change email → confirmation email arrives at new email

Delete account → type DELETE → confirmation → banner appears at top of
settings

Banner → Cancel → banner disappears, scheduled_deletion_at NULL

A short list of pitfalls to warn the developer:

Why useSecuritySummary uses head: true, count: 'exact' (avoids
fetching rows for a count)

Why "email verified" is always true in MVP (magic link flow verifies
the email — no explicit verification step exists)

Why the summary card is a read-only view (actions live in their
respective screens; the card just surfaces state)

Why /api/auth/logout-all uses signOut(userId, 'others') not
'global' (keeps the current session alive)

Why useUnblockUser invalidates ['chats'] (the blocked filter in the
chat list must refresh)

Why useUpdatePrivacySettings is a single mutation for all fields
(avoids race conditions when two toggles fire quickly)

Why the read receipts warning modal must fire before the mutation
(fair-trade behavior is important enough to confirm)

Why ManageExclusionsModal receives currentExclusions as a prop
(parent owns the state; the modal is a pure form)

Why getOrCreateDeviceFingerprint() is called inline in
DevicesScreen (no need to store in state; the fingerprint never
changes for a given browser)

Why S8/S9 are marked "NOT PLANNED" (app lock and per-device sign-out
are explicitly out of scope, not Fase 2 — prevents future confusion)

Do not implement any Fase 2 features. Do not add app lock, PINs,
biometrics, or passkeys. Do not add per-device sign-out. This completes the
privacy and security settings.
```
