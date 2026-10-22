# SILVERCHAT — PROMPT #14: INTERNATIONALIZATION & THEME SYSTEM

You are a senior frontend engineer implementing **internationalization
(i18n)** and the **runtime theme system** for SilverChat. This prompt wires
up the design system (from #3) with user preferences (from #6) and prepares
the app for multi-language and multi-theme support.

This prompt covers: i18next configuration, locale files (en + es),
language detection + persistence, theme (light/dark/system) + accent
(6 colors) with persistence, FOUC prevention, locale-aware formatters,
`prefers-color-scheme` listener.

**What this prompt does NOT do**: it does **NOT** translate any existing
component. That is a separate follow-up pass (or incremental developer work).
This prompt provides the infrastructure AND the complete list of keys needed,
but does not touch existing `*.tsx` files except where explicitly listed.

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- |
| T1  | `react-i18next` + `i18next` + `i18next-browser-languagedetector`                                                        |
| T2  | Detection priority: `localStorage` → `navigator.language` → `user_settings` (when logged in, overrides) → fallback `en` |
| T3  | Nested structure + 9 namespaces, lazy-loaded per namespace                                                              |
| T4  | Native i18next plurals (`_one` / `_other`)                                                                              |
| T5  | `Intl` only — no date libraries                                                                                         |
| T6  | Dual persistence (localStorage + `user_settings`) for theme, accent, language                                           |
| T7  | `prefers-color-scheme` runtime listener when theme === 'system'                                                         |
| T8  | Inline FOUC-prevention script in `index.html`                                                                           |

Additional locked decisions:

- **Namespaces**: `common`, `auth`, `chats`, `messages`, `calls`,
  `communities`, `novedades`, `settings`, `errors`.
- **Supported languages**: `en` (default/fallback), `es`.
- **Storage keys**:
  - `silverchat_language` (localStorage)
  - `silverchat_theme` (localStorage) — `'light' | 'dark' | 'system'`
  - `silverchat_accent` (localStorage) — `'blue' | 'purple' | 'red' | 'orange' | 'yellow' | 'green'`
- **Theme application**: `<html data-theme="dark">` when dark; accent applied
  via `<html class="theme-{accent}">`.
- **Default theme**: `system` (per user_settings default in #4a).
- **Default accent**: `blue` (per user_settings default in #4a).
- **Default language**: `en` (per user_settings default in #4a).
- **Component translation is NOT in scope.** The prompt provides keys and
  wiring; the actual `t()` calls in existing components happen later.

---

## 2. DEPENDENCIES

```bash
pnpm add i18next react-i18next i18next-browser-languagedetector

3. FILE STRUCTURE
text
src/
├── lib/
│   ├── i18n.ts                    (i18next config)
│   └── theme.ts                    (theme/accent helpers)
├── hooks/
│   ├── useFormatters.ts            (Intl-based formatters)
│   ├── useTheme.ts                 (theme + accent hook)
│   └── useLanguage.ts              (language hook)
├── app/
│   └── providers/
│       ├── ThemeProvider.tsx       (real implementation, replaces stub from #2)
│       └── I18nProvider.tsx        (real implementation, replaces stub from #2)
├── locales/
│   ├── en/
│   │   ├── common.json
│   │   ├── auth.json
│   │   ├── chats.json
│   │   ├── messages.json
│   │   ├── calls.json
│   │   ├── communities.json
│   │   ├── novedades.json
│   │   ├── settings.json
│   │   └── errors.json
│   └── es/
│       ├── common.json
│       ├── auth.json
│       ├── chats.json
│       ├── messages.json
│       ├── calls.json
│       ├── communities.json
│       ├── novedades.json
│       ├── settings.json
│       └── errors.json
└── types/
    └── i18n.d.ts                   (type safety for t())

index.html                          (add inline FOUC script)

Modified files:
- src/app/main.tsx                  (import './lib/i18n' before React)
- src/features/settings/components/AppearanceScreen.tsx (wire real logic)
4. src/lib/i18n.ts
ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enChats from '@/locales/en/chats.json';
import enMessages from '@/locales/en/messages.json';
import enCalls from '@/locales/en/calls.json';
import enCommunities from '@/locales/en/communities.json';
import enNovedades from '@/locales/en/novedades.json';
import enSettings from '@/locales/en/settings.json';
import enErrors from '@/locales/en/errors.json';

import esCommon from '@/locales/es/common.json';
import esAuth from '@/locales/es/auth.json';
import esChats from '@/locales/es/chats.json';
import esMessages from '@/locales/es/messages.json';
import esCalls from '@/locales/es/calls.json';
import esCommunities from '@/locales/es/communities.json';
import esNovedades from '@/locales/es/novedades.json';
import esSettings from '@/locales/es/settings.json';
import esErrors from '@/locales/es/errors.json';

export const NAMESPACES = [
  'common', 'auth', 'chats', 'messages', 'calls',
  'communities', 'novedades', 'settings', 'errors',
] as const;

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    chats: enChats,
    messages: enMessages,
    calls: enCalls,
    communities: enCommunities,
    novedades: enNovedades,
    settings: enSettings,
    errors: enErrors,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    chats: esChats,
    messages: esMessages,
    calls: esCalls,
    communities: esCommunities,
    novedades: esNovedades,
    settings: esSettings,
    errors: esErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    defaultNS: 'common',
    ns: NAMESPACES as unknown as string[],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'silverchat_language',
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => {
        if (lng.startsWith('es')) return 'es';
        if (lng.startsWith('en')) return 'en';
        return 'en';
      },
    },
    react: { useSuspense: false }, // avoid suspense boundaries
  });

// Keep <html lang> in sync
function syncHtmlLang(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng.split('-')[0]);
  }
}
syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export default i18n;

export function changeLanguage(lng: SupportedLanguage) {
  return i18n.changeLanguage(lng);
}
5. src/types/i18n.d.ts
For type-safe t() calls:

ts
import 'i18next';
import type common from '@/locales/en/common.json';
import type auth from '@/locales/en/auth.json';
import type chats from '@/locales/en/chats.json';
import type messages from '@/locales/en/messages.json';
import type calls from '@/locales/en/calls.json';
import type communities from '@/locales/en/communities.json';
import type novedades from '@/locales/en/novedades.json';
import type settings from '@/locales/en/settings.json';
import type errors from '@/locales/en/errors.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      auth: typeof auth;
      chats: typeof chats;
      messages: typeof messages;
      calls: typeof calls;
      communities: typeof communities;
      novedades: typeof novedades;
      settings: typeof settings;
      errors: typeof errors;
    };
  }
}
6. src/lib/theme.ts
ts
export type ThemePreference = 'light' | 'dark' | 'system';
export type AccentTheme = 'blue' | 'purple' | 'red' | 'orange' | 'yellow' | 'green';

const THEME_KEY = 'silverchat_theme';
const ACCENT_KEY = 'silverchat_accent';

const VALID_THEMES: ThemePreference[] = ['light', 'dark', 'system'];
const VALID_ACCENTS: AccentTheme[] = ['blue', 'purple', 'red', 'orange', 'yellow', 'green'];

export function getStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY) as ThemePreference | null;
    return v && VALID_THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function getStoredAccent(): AccentTheme {
  try {
    const v = localStorage.getItem(ACCENT_KEY) as AccentTheme | null;
    return v && VALID_ACCENTS.includes(v) ? v : 'blue';
  } catch {
    return 'blue';
  }
}

export function getSystemPrefersDark(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return getSystemPrefersDark() ? 'dark' : 'light';
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  const effective = resolveEffectiveTheme(pref);
  const html = document.documentElement;

  // Remove both first, then set data-theme only for explicit dark
  // (light is the default in :root)
  if (effective === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme');
  }
}

export function applyAccent(accent: AccentTheme) {
  const html = document.documentElement;
  // Remove all theme-* classes then add the current one
  VALID_ACCENTS.forEach(a => html.classList.remove(`theme-${a}`));
  html.classList.add(`theme-${accent}`);
}

export function persistTheme(pref: ThemePreference) {
  try { localStorage.setItem(THEME_KEY, pref); } catch {}
}

export function persistAccent(accent: AccentTheme) {
  try { localStorage.setItem(ACCENT_KEY, accent); } catch {}
}
7. HOOK: src/hooks/useTheme.ts
ts
import { useCallback, useEffect, useState } from 'react';
import {
  getStoredTheme,
  getStoredAccent,
  applyTheme,
  applyAccent,
  persistTheme,
  persistAccent,
  getSystemPrefersDark,
  type ThemePreference,
  type AccentTheme,
} from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-provider';
import { useQueryClient } from '@tanstack/react-query';

const DEBOUNCE_MS = 500;

let persistTimeout: ReturnType<typeof setTimeout> | null = null;

export function useTheme() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme);
  const [accent, setAccentState] = useState<AccentTheme>(getStoredAccent);

  // On mount: if user logged in, fetch from user_settings and override
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('theme, accent')
        .eq('user_id', user.id)
        .single();
      if (cancelled || !data) return;

      if (data.theme && data.theme !== theme) {
        setThemeState(data.theme as ThemePreference);
        persistTheme(data.theme as ThemePreference);
        applyTheme(data.theme as ThemePreference);
      }
      if (data.accent && data.accent !== accent) {
        setAccentState(data.accent as AccentTheme);
        persistAccent(data.accent as AccentTheme);
        applyAccent(data.accent as AccentTheme);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Apply theme + accent on every change
  useEffect(() => {
    applyTheme(theme);
    applyAccent(accent);
  }, [theme, accent]);

  // Listen to prefers-color-scheme when theme === 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [theme]);

  // Persist to localStorage + debounced DB update
  const persist = useCallback((updates: { theme?: ThemePreference; accent?: AccentTheme }) => {
    if (updates.theme !== undefined) persistTheme(updates.theme);
    if (updates.accent !== undefined) persistAccent(updates.accent);

    if (!user) return;
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(async () => {
      await supabase
        .from('user_settings')
        .update({
          ...(updates.theme !== undefined && { theme: updates.theme }),
          ...(updates.accent !== undefined && { accent: updates.accent }),
        })
        .eq('user_id', user.id);
      qc.invalidateQueries({ queryKey: ['user_settings'] });
    }, DEBOUNCE_MS);
  }, [user, qc]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    persist({ theme: next });
  }, [persist]);

  const setAccent = useCallback((next: AccentTheme) => {
    setAccentState(next);
    persist({ accent: next });
  }, [persist]);

  return { theme, accent, setTheme, setAccent };
}
8. HOOK: src/hooks/useLanguage.ts
ts
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-provider';
import type { SupportedLanguage } from '@/lib/i18n';

const STORAGE_KEY = 'silverchat_language';
const DEBOUNCE_MS = 500;

let persistTimeout: ReturnType<typeof setTimeout> | null = null;

export function useLanguage() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) ?? 'en'
  );

  // On mount: fetch user_settings.language and override (cross-device sync)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('language')
        .eq('user_id', user.id)
        .single();
      if (cancelled || !data?.language) return;
      if (data.language !== i18n.language) {
        await i18n.changeLanguage(data.language);
        try { localStorage.setItem(STORAGE_KEY, data.language); } catch {}
        setLanguageState(data.language as SupportedLanguage);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setLanguage = useCallback(async (next: SupportedLanguage) => {
    await i18n.changeLanguage(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    setLanguageState(next);

    if (!user) return;
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(async () => {
      await supabase
        .from('user_settings')
        .update({ language: next })
        .eq('user_id', user.id);
    }, DEBOUNCE_MS);
  }, [i18n, user]);

  return { language, setLanguage };
}
9. HOOK: src/hooks/useFormatters.ts
ts
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useFormatters() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';

  return useMemo(() => {
    const dtfTime = new Intl.DateTimeFormat(locale, {
      hour: '2-digit', minute: '2-digit',
    });
    const dtfDate = new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const dtfLongDate = new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const nf = new Intl.NumberFormat(locale);

    return {
      formatTime(iso: string) {
        return dtfTime.format(new Date(iso));
      },
      formatDate(iso: string) {
        return dtfDate.format(new Date(iso));
      },
      formatLongDate(iso: string) {
        return dtfLongDate.format(new Date(iso));
      },
      formatRelative(iso: string) {
        const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diffSec < 60) return rtf.format(-diffSec, 'second');
        if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
        if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
        if (diffSec < 604800) return rtf.format(-Math.floor(diffSec / 86400), 'day');
        return dtfDate.format(new Date(iso));
      },
      formatBytes(bytes: number) {
        if (bytes < 1024) return `${nf.format(bytes)} B`;
        if (bytes < 1024 * 1024) return `${nf.format(bytes / 1024, 1)} KB`;
        return `${nf.format(bytes / 1024 / 1024, 1)} MB`;
      },
      formatDuration(seconds: number) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        const pad = (n: number) => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
      },
    };
  }, [locale]);
}
10. src/app/providers/ThemeProvider.tsx
tsx
import { createContext, useContext, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference, AccentTheme } from '@/lib/theme';

interface ThemeContextValue {
  theme: ThemePreference;
  accent: AccentTheme;
  setTheme: (t: ThemePreference) => void;
  setAccent: (a: AccentTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be inside ThemeProvider');
  return ctx;
}
11. src/app/providers/I18nProvider.tsx
tsx
import { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
12. index.html — FOUC prevention script
Insert before any <link rel="stylesheet"> or <script type="module">:

html
<script>
  (function () {
    try {
      var t = localStorage.getItem('silverchat_theme');
      var a = localStorage.getItem('silverchat_accent');
      var l = localStorage.getItem('silverchat_language');

      var pref = (t === 'light' || t === 'dark' || t === 'system') ? t : 'system';
      var effectiveDark = pref === 'dark' ||
        (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (effectiveDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      if (a && /^(blue|purple|red|orange|yellow|green)$/.test(a)) {
        document.documentElement.classList.add('theme-' + a);
      }

      if (l) {
        document.documentElement.setAttribute('lang', l.split('-')[0]);
      }
    } catch (e) {}
  })();
</script>
13. src/features/settings/components/AppearanceScreen.tsx
Wire the real hooks (replaces the stub from #6):

tsx
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '@/app/providers/ThemeProvider';
import { useLanguage } from '@/hooks/useLanguage';
import type { AccentTheme } from '@/lib/theme';
import type { SupportedLanguage } from '@/lib/i18n';

const THEMES = [
  { value: 'light', labelKey: 'settings.appearance.themeLight' },
  { value: 'dark', labelKey: 'settings.appearance.themeDark' },
  { value: 'system', labelKey: 'settings.appearance.themeSystem' },
] as const;

const ACCENTS: { value: AccentTheme; color: string }[] = [
  { value: 'blue',   color: 'oklch(0.62 0.22 255)' },
  { value: 'purple', color: 'oklch(0.58 0.24 300)' },
  { value: 'red',    color: 'oklch(0.62 0.24 25)' },
  { value: 'orange', color: 'oklch(0.7 0.2 50)' },
  { value: 'yellow', color: 'oklch(0.82 0.2 95)' },
  { value: 'green',  color: 'oklch(0.72 0.22 145)' },
];

const LANGUAGES: { value: SupportedLanguage; labelKey: string }[] = [
  { value: 'en', labelKey: 'settings.appearance.langEnglish' },
  { value: 'es', labelKey: 'settings.appearance.langSpanish' },
];

export function AppearanceScreen() {
  const { t } = useTranslation(['settings', 'common']);
  const { theme, accent, setTheme, setAccent } = useThemeContext();
  const { language, setLanguage } = useLanguage();

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">
          {t('settings.appearance.themeTitle')}
        </h2>
        <div className="flex gap-2">
          {THEMES.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                theme === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          {t('settings.appearance.accentTitle')}
        </h2>
        <div className="flex gap-3">
          {ACCENTS.map(a => (
            <button
              key={a.value}
              onClick={() => setAccent(a.value)}
              aria-label={t(`settings.appearance.accent_${a.value}`)}
              className={`w-10 h-10 rounded-full transition-transform ${
                accent === a.value ? 'ring-2 ring-foreground scale-110' : ''
              }`}
              style={{ backgroundColor: a.color }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          {t('settings.appearance.languageTitle')}
        </h2>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value as SupportedLanguage)}
          className="w-full px-4 py-2 rounded-lg bg-muted text-foreground"
        >
          {LANGUAGES.map(l => (
            <option key={l.value} value={l.value}>
              {t(l.labelKey)}
            </option>
          ))}
        </select>
      </section>
    </div>
  );
}
14. LOCALE FILES
14.1 src/locales/en/common.json
json
{
  "appName": "SilverChat",
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "confirm": "Confirm",
  "close": "Close",
  "back": "Back",
  "next": "Next",
  "done": "Done",
  "loading": "Loading…",
  "saving": "Saving…",
  "sending": "Sending…",
  "search": "Search",
  "searchPlaceholder": "Search…",
  "retry": "Retry",
  "dismiss": "Dismiss",
  "install": "Install",
  "today": "Today",
  "yesterday": "Yesterday",
  "you": "You",
  "unknown": "Unknown",
  "online": "Online",
  "offline": "Offline",
  "member_one": "{{count}} member",
  "member_other": "{{count}} members",
  "follower_one": "{{count}} follower",
  "follower_other": "{{count}} followers",
  "forwarded": "Forwarded",
  "edited": "Edited",
  "deletedMessage": "This message was deleted",
  "offlineBanner": "You're offline. Messages will be sent when you reconnect.",
  "updateAvailable": "New version available",
  "reload": "Reload"
}
14.2 src/locales/en/auth.json
json
{
  "login": {
    "title": "Welcome back",
    "subtitle": "Sign in with your email",
    "emailLabel": "Email",
    "emailPlaceholder": "you@example.com",
    "sendLink": "Send magic link",
    "noAccount": "Don't have an account?",
    "signUp": "Sign up"
  },
  "signup": {
    "title": "Create your account",
    "subtitle": "We'll send you a magic link — no password needed.",
    "emailLabel": "Email",
    "emailPlaceholder": "you@example.com",
    "createAccount": "Create account",
    "hasAccount": "Already have an account?",
    "logIn": "Log in",
    "captchaError": "Please complete the captcha.",
    "rateLimit": "Too many attempts. Try again in a few minutes."
  },
  "checkEmail": {
    "title": "Check your email",
    "body": "We sent a magic link to {{email}}. Click it to continue. The link expires in 10 minutes.",
    "resend": "Resend email",
    "resendIn": "Resend in {{seconds}}s",
    "changeEmail": "Change email",
    "checkSpam": "Didn't receive it? Check your spam folder."
  },
  "error": {
    "invalidToken": "This link is invalid.",
    "expiredToken": "This link has expired.",
    "missingToken": "This link is invalid.",
    "rateLimited": "Too many attempts. Try again in a few minutes.",
    "unknown": "Something went wrong.",
    "requestNewLink": "Request a new link"
  },
  "twoFa": {
    "title": "Two-factor authentication",
    "subtitle": "Enter the 6-digit code from your authenticator app.",
    "verify": "Verify",
    "useBackupCode": "Use a backup code instead",
    "backupCodeTitle": "Enter a backup code",
    "backupCodeSubtitle": "Each code can only be used once.",
    "backupCodeUsed": "Backup code used. Please re-enable 2FA in settings.",
    "enable": "Enable 2FA",
    "disable": "Disable 2FA",
    "enabled": "Enabled",
    "scanQr": "Scan this QR code with your authenticator app",
    "enterCode": "Enter the 6-digit code to confirm",
    "saveBackupCodes": "Save these codes. You won't see them again.",
    "downloadCodes": "Download as .txt",
    "copyCodes": "Copy all",
    "savedConfirm": "I've saved them",
    "disableWarning": "This will remove 2FA from your account. Anyone with access to your email will be able to sign in.",
    "regenerateCodes": "Regenerate backup codes"
  },
  "onboarding": {
    "usernameTitle": "Pick your username",
    "usernameSubtitle": "This is how others will find you. You can't change it easily.",
    "usernameAvailable": "Available!",
    "usernameTaken": "This username is taken",
    "usernameInvalid": "Username must be 3-20 characters, lowercase letters, numbers, and underscores only",
    "usernameCooldown": "You can change your username again on {{date}}.",
    "welcomeTitle": "Welcome to SilverChat, {{name}}!",
    "welcomeSubtitle": "A few optional things you can set up now.",
    "avatarLabel": "Add a profile photo",
    "themeLabel": "Choose a theme",
    "languageLabel": "Choose your language",
    "twoFaLabel": "Enable two-factor authentication",
    "skip": "Skip for now",
    "getStarted": "Get started"
  }
}
14.3 src/locales/en/chats.json
json
{
  "title": "Chats",
  "searchPlaceholder": "Search chats…",
  "filters": {
    "all": "All",
    "favorites": "Favorites",
    "unread": "Unread",
    "groups": "Groups",
    "archived": "Archived",
    "muted": "Muted",
    "blocked": "Blocked"
  },
  "empty": {
    "all": {
      "title": "No chats yet",
      "subtitle": "Start a conversation with someone.",
      "cta": "New chat"
    },
    "favorites": {
      "title": "No favorite chats",
      "subtitle": "Long-press any chat to favorite it."
    },
    "unread": {
      "title": "You're all caught up!",
      "subtitle": "No unread messages."
    },
    "groups": {
      "title": "No groups yet",
      "subtitle": "Create a group or wait to be added.",
      "cta": "New group"
    },
    "archived": {
      "title": "No archived chats",
      "subtitle": "Chats you archive will appear here."
    },
    "muted": {
      "title": "No muted chats",
      "subtitle": "Chats you mute will appear here."
    },
    "blocked": {
      "title": "You haven't blocked anyone",
      "subtitle": "Blocked contacts won't be able to message you."
    }
  },
  "messageRequests": {
    "title": "Message requests",
    "accept": "Accept",
    "decline": "Decline",
    "declineConfirm": "Decline this chat request? {{sender}} won't be able to message you again for 7 days.",
    "accepted": "Chat request accepted",
    "declined": "Chat request declined"
  },
  "contextMenu": {
    "reply": "Reply",
    "markRead": "Mark as read",
    "markUnread": "Mark as unread",
    "pin": "Pin",
    "unpin": "Unpin",
    "mute": "Mute",
    "unmute": "Unmute",
    "archive": "Archive",
    "unarchive": "Unarchive",
    "block": "Block",
    "deleteChat": "Delete chat",
    "leaveGroup": "Leave group",
    "clearChat": "Clear chat",
    "viewProfile": "View profile",
    "viewGroupInfo": "Group info",
    "viewMembers": "View members",
    "addMembers": "Add members",
    "searchInChat": "Search in chat"
  },
  "muteOptions": {
    "oneHour": "1 hour",
    "eightHours": "8 hours",
    "oneDay": "1 day",
    "oneWeek": "1 week",
    "always": "Always",
    "unmute": "Unmute"
  },
  "deleteModal": {
    "directTitle": "Delete chat?",
    "directBody": "This chat will be removed from your list. It will reappear if the other person messages you.",
    "groupTitle": "Leave group?",
    "groupBody": "You will leave this group. {{adminNote}}",
    "groupAdminNote": "The oldest member will be promoted to admin.",
    "selfTitle": "Delete this chat?",
    "selfBody": "All your notes and messages to yourself will be permanently deleted."
  },
  "newChat": {
    "title": "New chat",
    "newGroup": "New group",
    "newChannel": "New channel",
    "messageYourself": "Message yourself"
  }
}
14.4 src/locales/en/messages.json
json
{
  "composer": {
    "placeholder": "Message…",
    "attach": "Attach",
    "emoji": "Emoji",
    "send": "Send",
    "recordVoice": "Record voice note"
  },
  "attachments": {
    "photo": "Photo / Video",
    "camera": "Camera",
    "file": "File",
    "contact": "Contact"
  },
  "preview": {
    "captionPlaceholder": "Add a caption…",
    "send": "Send",
    "cancel": "Cancel",
    "uploading": "Uploading… {{percent}}%"
  },
  "actions": {
    "reply": "Reply",
    "copy": "Copy",
    "forward": "Forward",
    "edit": "Edit",
    "delete": "Delete",
    "deleteForMe": "Delete for me",
    "deleteForEveryone": "Delete for everyone",
    "react": "React",
    "pin": "Pin",
    "unpin": "Unpin",
    "selectAll": "Select all",
    "deselectAll": "Deselect all"
  },
  "edit": {
    "title": "Edit message",
    "save": "Save",
    "cannotEdit": "You can no longer edit this message."
  },
  "delete": {
    "title": "Delete message?",
    "bodyMe": "Delete this message for you? Others will still see it.",
    "bodyEveryone": "Delete this message for everyone? They'll see 'This message was deleted' instead."
  },
  "forward": {
    "title": "Forward to…",
    "cta": "Forward to {{count}} chats",
    "maxReached": "You can select up to 5 chats",
    "success": "Forwarded to {{count}} chats"
  },
  "reply": {
    "replyingTo": "Replying to {{name}}",
    "cancel": "Cancel reply"
  },
  "status": {
    "sending": "Sending…",
    "failed": "Message failed to send",
    "tapToRetry": "Tap to retry"
  },
  "empty": {
    "directTitle": "Say hi to {{name}}! 👋",
    "directSubtitle": "Messages are private to both of you.",
    "groupTitle": "This is the beginning of the group.",
    "groupSubtitle": "Send a message to get things started.",
    "selfTitle": "Message yourself",
    "selfSubtitle": "Notes, links, and ideas — just for you."
  },
  "search": {
    "placeholder": "Search in conversation…",
    "counter": "{{current}} of {{total}}",
    "localOnlyNote": "Only searching loaded messages. Scroll up to load older ones.",
    "noResults": "No messages match '{{query}}'"
  },
  "pinned": {
    "title": "Pinned message",
    "titleMany": "{{count}} pinned messages",
    "limitReached": "You can only pin up to 3 messages. Unpin one first."
  },
  "reactions": {
    "add": "Add reaction",
    "you": "You reacted"
  },
  "voice": {
    "recording": "Recording… {{time}}",
    "maxReached": "Maximum 5 minutes reached",
    "cancel": "Cancel",
    "send": "Send",
    "delete": "Delete",
    "micDenied": "Microphone access is required to record voice notes."
  },
  "mentions": {
    "autocompleteTitle": "Members"
  },
  "system": {
    "memberJoined": "{{name}} joined the group",
    "memberLeft": "{{name}} left the group",
    "memberAdded": "{{actor}} added {{name}}",
    "memberRemoved": "{{actor}} removed {{name}}",
    "adminPromoted": "{{actor}} promoted {{name}} to admin",
    "adminDemoted": "{{actor}} demoted {{name}} from admin"
  }
}
14.5 src/locales/en/calls.json
json
{
  "title": "Calls",
  "subtitle": "Recent voice and video activity",
  "searchPlaceholder": "Search calls…",
  "filters": {
    "all": "All",
    "missed": "Missed"
  },
  "types": {
    "voice": "Voice call",
    "video": "Video call"
  },
  "status": {
    "missed": "Missed",
    "declined": "Declined",
    "canceled": "Canceled",
    "noAnswer": "No answer",
    "inProgress": "In progress"
  },
  "empty": {
    "title": "No calls yet",
    "subtitle": "Start one from a chat.",
    "cta": "New call"
  },
  "incoming": {
    "voiceCall": "Incoming voice call",
    "videoCall": "Incoming video call",
    "accept": "Accept",
    "decline": "Decline"
  },
  "outgoing": {
    "calling": "Calling…",
    "cancel": "Cancel call",
    "noAnswer": "No answer",
    "declined": "Call declined"
  },
  "active": {
    "voiceCall": "Voice call",
    "videoCall": "Video call",
    "connecting": "Connecting…",
    "ended": "Call ended",
    "networkLost": "Connection lost",
    "mute": "Mute",
    "unmute": "Unmute",
    "speaker": "Speaker",
    "cameraOn": "Camera on",
    "cameraOff": "Camera off",
    "switchCamera": "Switch camera",
    "hangup": "Hang up"
  },
  "permissions": {
    "denied": "Camera/microphone access is required. Enable it in your browser settings.",
    "retry": "Try again"
  },
  "newCall": {
    "title": "New call",
    "searchPlaceholder": "Search contacts…",
    "empty": "No contacts with active chats. Start a chat first."
  }
}
14.6 src/locales/en/communities.json
json
{
  "title": "Communities",
  "searchPlaceholder": "Search communities…",
  "empty": {
    "title": "You're not in any communities yet",
    "subtitle": "Ask a friend for an invite or create one.",
    "cta": "New community"
  },
  "card": {
    "seeAll": "See all {{count}} chats"
  },
  "createModal": {
    "title": "New community",
    "nameLabel": "Community name",
    "namePlaceholder": "e.g. Weekend Hikers",
    "descriptionLabel": "Description (optional)",
    "submit": "Create community"
  },
  "createChatModal": {
    "title": "New chat",
    "nameLabel": "Chat name",
    "namePlaceholder": "e.g. Announcements",
    "submit": "Create chat"
  },
  "info": {
    "title": "Community info",
    "membersCount": "{{count}} members",
    "createdOn": "Created on {{date}}",
    "viewMembers": "View members",
    "mute": "Mute community",
    "leave": "Leave community",
    "delete": "Delete community",
    "deleteConfirm": "Type DELETE to confirm",
    "deleteWarning": "This will permanently delete the community and all its chats.",
    "leaveWarning": "You're the owner of this community. If you leave, the oldest admin (or oldest member if no admins) will automatically become the new owner."
  },
  "chatOptions": {
    "communityInfo": "Community info"
  }
}
14.7 src/locales/en/novedades.json
json
{
  "title": "Novedades",
  "searchPlaceholder": "Search stories and channels…",
  "stories": {
    "myStory": "My story",
    "addStory": "Add story",
    "viewedBy": "Viewed by {{count}}",
    "noViews": "No views yet",
    "reply": "Reply to {{name}}…",
    "replySent": "Reply sent",
    "deleteStory": "Delete this story",
    "deleteAllStories": "Delete all my stories",
    "confirmDelete": "Delete this story?",
    "limitReached": "You can have up to 10 active stories.",
    "textPlaceholder": "Type your story…",
    "send": "Send",
    "cancel": "Cancel",
    "maxDuration": "Videos can be up to 15 seconds long"
  },
  "channels": {
    "sectionTitle": "Channels",
    "discoverTitle": "Find channels to follow",
    "follow": "Follow",
    "following": "Following",
    "unfollow": "Unfollow",
    "mute": "Mute",
    "unmute": "Unmute",
    "membersCount_one": "{{count}} follower",
    "membersCount_other": "{{count}} followers",
    "empty": "You're not following any channels yet.",
    "createModal": {
      "title": "New channel",
      "nameLabel": "Channel name",
      "slugLabel": "Slug",
      "slugHint": "Lowercase letters, numbers, and hyphens",
      "descriptionLabel": "Description (optional)",
      "submit": "Create channel"
    },
    "info": {
      "title": "Channel info",
      "follow": "Follow",
      "unfollow": "Unfollow",
      "mute": "Mute channel",
      "delete": "Delete channel",
      "deleteConfirm": "Type DELETE to confirm",
      "deleteWarning": "This will permanently delete the channel and all its messages.",
      "edit": "Edit channel"
    },
    "header": {
      "membersCount_one": "{{count}} follower",
      "membersCount_other": "{{count}} followers"
    },
    "empty": {
      "noMessages": "No messages yet."
    }
  },
  "bottomButtons": {
    "exploreMore": "Explore more",
    "createChannel": "Create channel"
  }
}
14.8 src/locales/en/settings.json
json
{
  "title": "Settings",
  "sections": {
    "profile": "Profile",
    "account": "Account",
    "devices": "Devices",
    "storage": "Storage",
    "privacy": "Privacy",
    "appearance": "Appearance",
    "notifications": "Notifications",
    "about": "About"
  },
  "profile": {
    "title": "Edit profile",
    "displayName": "Display name",
    "firstName": "First name",
    "lastName": "Last name",
    "username": "Username",
    "bio": "Bio",
    "bioCounter": "{{current}}/{{max}}",
    "socialLinks": "Social links",
    "save": "Save changes",
    "saved": "Profile updated",
    "usernameTaken": "Someone just took this username. Try another.",
    "usernameCooldown": "You can change your username again on {{date}}.",
    "avatarMenu": {
      "view": "View photo",
      "takePhoto": "Take photo",
      "upload": "Upload photo",
      "remove": "Remove photo",
      "cancel": "Cancel"
    },
    "social": {
      "title": "Social links",
      "addCustom": "Add custom link",
      "labelPlaceholder": "Label",
      "urlPlaceholder": "https://…",
      "remove": "Remove",
      "maxReached": "You can add up to 20 custom links",
      "save": "Save links"
    }
  },
  "account": {
    "title": "Account",
    "email": "Email",
    "changeEmail": "Change email",
    "emailChanged": "Confirmation sent to {{email}}. Click the link to complete the change.",
    "deleteAccount": "Delete account",
    "deleteTitle": "Delete your account?",
    "deleteBody1": "Your account will be permanently deleted after a 30-day grace period. During this time, you can cancel this from any device.",
    "deleteBody2": "Your messages will remain visible to other users in your conversations but attributed to 'Deleted User'. Your profile, avatar, and personal data will be removed.",
    "deleteConfirm": "Type DELETE to confirm",
    "scheduleDeletion": "Schedule deletion",
    "cancelDeletion": "Cancel deletion",
    "pendingBanner": "Your account will be deleted on {{date}}.",
    "cancel": "Cancel"
  },
  "devices": {
    "title": "Devices",
    "thisDevice": "This device",
    "lastActive": "Last active {{time}}",
    "signOutOne": "Sign out",
    "signOutAll": "Sign out all other devices",
    "signOutAllConfirm": "Sign out of all other devices?"
  },
  "storage": {
    "title": "Storage",
    "totalUsed": "{{size}} used",
    "avatars": "Avatars",
    "chatMedia": "Chat media",
    "stories": "Stories",
    "note": "Files are automatically compressed on upload. Larger limits may apply."
  },
  "privacy": {
    "title": "Privacy",
    "blocked": "Blocked contacts",
    "blockedCount": "Blocked contacts ({{count}})",
    "unblock": "Unblock",
    "emptyBlocked": "You haven't blocked anyone.",
    "photo": "Profile photo",
    "presence": "Last seen & online",
    "stories": "Stories",
    "readReceipts": "Read receipts",
    "readReceiptsHint": "When on, others can see when you've read their messages. When off, you won't see their read receipts either.",
    "visibility": {
      "everyone": "Everyone",
      "contacts": "My contacts",
      "contactsExcept": "My contacts except…",
      "nobody": "Nobody",
      "manageExclusions": "Manage exclusions ({{count}})",
      "title": "Hide from…",
      "searchPlaceholder": "Search contacts…",
      "saveWithCount": "Save ({{count}} excluded)"
    },
    "disableReceiptsTitle": "Turn off read receipts?",
    "disableReceiptsBody": "When read receipts are off, you won't see when others have read your messages, and they won't see when you've read theirs. This applies to everyone until you turn it back on.",
    "keepEnabled": "Keep enabled",
    "turnOff": "Turn off"
  },
  "appearance": {
    "themeTitle": "Theme",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeSystem": "System",
    "accentTitle": "Accent color",
    "accent_blue": "Blue",
    "accent_purple": "Purple",
    "accent_red": "Red",
    "accent_orange": "Orange",
    "accent_yellow": "Yellow",
    "accent_green": "Green",
    "languageTitle": "Language",
    "langEnglish": "English",
    "langSpanish": "Español"
  },
  "notifications": {
    "title": "Notifications",
    "enable": "Notifications",
    "sound": "Sound",
    "previews": "Message previews",
    "note": "Push notifications require installing the app. In-browser notifications are shown while the app is open in a tab.",
    "permissionPrompt": "Enable notifications to receive messages and calls when SilverChat is in the background.",
    "enableButton": "Enable",
    "notNow": "Not now"
  },
  "about": {
    "title": "About",
    "version": "Version {{version}}",
    "terms": "Terms of Service",
    "privacy": "Privacy Policy",
    "licenses": "Open-source licenses",
    "signOut": "Sign out"
  },
  "logout": {
    "title": "Log out of SilverChat?",
    "body": "You'll need to sign in again with a magic link.",
    "alsoSignOutAll": "Also sign out of all other devices",
    "logout": "Log out"
  }
}
14.9 src/locales/en/errors.json
json
{
  "network": "Network error. Check your connection.",
  "timeout": "Request timed out. Try again.",
  "unauthorized": "You don't have permission to do that.",
  "notFound": "Not found.",
  "serverError": "Something went wrong. Try again in a moment.",
  "generic": "Something went wrong.",
  "uploadFailed": "Upload failed. Try again.",
  "invalidInput": "Invalid input.",
  "rateLimited": "Too many requests. Wait a moment.",
  "offline": "You're offline."
}
14.10 Spanish translations (src/locales/es/*.json)
Provide the same keys with Spanish values. Below are complete file contents:

es/common.json

json
{
  "appName": "SilverChat",
  "save": "Guardar",
  "cancel": "Cancelar",
  "delete": "Eliminar",
  "confirm": "Confirmar",
  "close": "Cerrar",
  "back": "Atrás",
  "next": "Siguiente",
  "done": "Listo",
  "loading": "Cargando…",
  "saving": "Guardando…",
  "sending": "Enviando…",
  "search": "Buscar",
  "searchPlaceholder": "Buscar…",
  "retry": "Reintentar",
  "dismiss": "Descartar",
  "install": "Instalar",
  "today": "Hoy",
  "yesterday": "Ayer",
  "you": "Tú",
  "unknown": "Desconocido",
  "online": "En línea",
  "offline": "Desconectado",
  "member_one": "{{count}} miembro",
  "member_other": "{{count}} miembros",
  "follower_one": "{{count}} seguidor",
  "follower_other": "{{count}} seguidores",
  "forwarded": "Reenviado",
  "edited": "Editado",
  "deletedMessage": "Este mensaje fue eliminado",
  "offlineBanner": "Estás desconectado. Los mensajes se enviarán al reconectar.",
  "updateAvailable": "Nueva versión disponible",
  "reload": "Recargar"
}
es/auth.json

json
{
  "login": {
    "title": "Bienvenido de vuelta",
    "subtitle": "Inicia sesión con tu correo",
    "emailLabel": "Correo",
    "emailPlaceholder": "tu@ejemplo.com",
    "sendLink": "Enviar enlace mágico",
    "noAccount": "¿No tienes cuenta?",
    "signUp": "Regístrate"
  },
  "signup": {
    "title": "Crea tu cuenta",
    "subtitle": "Te enviaremos un enlace mágico — sin contraseña.",
    "emailLabel": "Correo",
    "emailPlaceholder": "tu@ejemplo.com",
    "createAccount": "Crear cuenta",
    "hasAccount": "¿Ya tienes cuenta?",
    "logIn": "Inicia sesión",
    "captchaError": "Por favor completa el captcha.",
    "rateLimit": "Demasiados intentos. Intenta de nuevo en unos minutos."
  },
  "checkEmail": {
    "title": "Revisa tu correo",
    "body": "Enviamos un enlace mágico a {{email}}. Haz clic en él para continuar. El enlace expira en 10 minutos.",
    "resend": "Reenviar correo",
    "resendIn": "Reenviar en {{seconds}}s",
    "changeEmail": "Cambiar correo",
    "checkSpam": "¿No lo recibiste? Revisa la carpeta de spam."
  },
  "error": {
    "invalidToken": "Este enlace no es válido.",
    "expiredToken": "Este enlace ha expirado.",
    "missingToken": "Este enlace no es válido.",
    "rateLimited": "Demasiados intentos. Intenta en unos minutos.",
    "unknown": "Algo salió mal.",
    "requestNewLink": "Solicitar un nuevo enlace"
  },
  "twoFa": {
    "title": "Autenticación de dos factores",
    "subtitle": "Ingresa el código de 6 dígitos de tu app autenticadora.",
    "verify": "Verificar",
    "useBackupCode": "Usar un código de respaldo",
    "backupCodeTitle": "Ingresa un código de respaldo",
    "backupCodeSubtitle": "Cada código solo puede usarse una vez.",
    "backupCodeUsed": "Código de respaldo usado. Vuelve a activar 2FA en ajustes.",
    "enable": "Activar 2FA",
    "disable": "Desactivar 2FA",
    "enabled": "Activado",
    "scanQr": "Escanea este código QR con tu app autenticadora",
    "enterCode": "Ingresa el código de 6 dígitos para confirmar",
    "saveBackupCodes": "Guarda estos códigos. No los verás de nuevo.",
    "downloadCodes": "Descargar como .txt",
    "copyCodes": "Copiar todos",
    "savedConfirm": "Ya los guardé",
    "disableWarning": "Esto eliminará 2FA de tu cuenta. Cualquiera con acceso a tu correo podrá iniciar sesión.",
    "regenerateCodes": "Regenerar códigos de respaldo"
  },
  "onboarding": {
    "usernameTitle": "Elige tu nombre de usuario",
    "usernameSubtitle": "Así te encontrarán los demás. No podrás cambiarlo fácilmente.",
    "usernameAvailable": "¡Disponible!",
    "usernameTaken": "Este nombre está en uso",
    "usernameInvalid": "Debe tener 3-20 caracteres, solo letras minúsculas, números y guiones bajos",
    "usernameCooldown": "Podrás cambiar tu nombre de usuario nuevamente el {{date}}.",
    "welcomeTitle": "¡Bienvenido a SilverChat, {{name}}!",
    "welcomeSubtitle": "Algunas cosas opcionales que puedes configurar ahora.",
    "avatarLabel": "Añadir foto de perfil",
    "themeLabel": "Elegir un tema",
    "languageLabel": "Elegir idioma",
    "twoFaLabel": "Activar autenticación de dos factores",
    "skip": "Saltar por ahora",
    "getStarted": "Empezar"
  }
}
es/chats.json

json
{
  "title": "Chats",
  "searchPlaceholder": "Buscar conversaciones…",
  "filters": {
    "all": "Todos",
    "favorites": "Favoritos",
    "unread": "Sin leer",
    "groups": "Grupos",
    "archived": "Archivados",
    "muted": "Silenciados",
    "blocked": "Bloqueados"
  },
  "empty": {
    "all": {
      "title": "Sin chats aún",
      "subtitle": "Inicia una conversación.",
      "cta": "Nuevo chat"
    },
    "favorites": {
      "title": "Sin chats favoritos",
      "subtitle": "Mantén presionado cualquier chat para marcarlo."
    },
    "unread": {
      "title": "¡Todo al día!",
      "subtitle": "No hay mensajes sin leer."
    },
    "groups": {
      "title": "Sin grupos aún",
      "subtitle": "Crea un grupo o espera a que te añadan.",
      "cta": "Nuevo grupo"
    },
    "archived": {
      "title": "Sin chats archivados",
      "subtitle": "Los chats que archives aparecerán aquí."
    },
    "muted": {
      "title": "Sin chats silenciados",
      "subtitle": "Los chats que silencies aparecerán aquí."
    },
    "blocked": {
      "title": "No has bloqueado a nadie",
      "subtitle": "Los contactos bloqueados no podrán enviarte mensajes."
    }
  },
  "messageRequests": {
    "title": "Solicitudes de mensaje",
    "accept": "Aceptar",
    "decline": "Rechazar",
    "declineConfirm": "¿Rechazar esta solicitud? {{sender}} no podrá enviarte mensajes durante 7 días.",
    "accepted": "Solicitud aceptada",
    "declined": "Solicitud rechazada"
  },
  "contextMenu": {
    "reply": "Responder",
    "markRead": "Marcar como leído",
    "markUnread": "Marcar como no leído",
    "pin": "Fijar",
    "unpin": "Desfijar",
    "mute": "Silenciar",
    "unmute": "Activar sonido",
    "archive": "Archivar",
    "unarchive": "Desarchivar",
    "block": "Bloquear",
    "deleteChat": "Eliminar chat",
    "leaveGroup": "Salir del grupo",
    "clearChat": "Vaciar chat",
    "viewProfile": "Ver perfil",
    "viewGroupInfo": "Info del grupo",
    "viewMembers": "Ver miembros",
    "addMembers": "Añadir miembros",
    "searchInChat": "Buscar en el chat"
  },
  "muteOptions": {
    "oneHour": "1 hora",
    "eightHours": "8 horas",
    "oneDay": "1 día",
    "oneWeek": "1 semana",
    "always": "Siempre",
    "unmute": "Activar sonido"
  },
  "deleteModal": {
    "directTitle": "¿Eliminar chat?",
    "directBody": "Este chat se eliminará de tu lista. Reaparecerá si la otra persona te escribe.",
    "groupTitle": "¿Salir del grupo?",
    "groupBody": "Saldrás de este grupo. {{adminNote}}",
    "groupAdminNote": "El miembro más antiguo será promovido a admin.",
    "selfTitle": "¿Eliminar este chat?",
    "selfBody": "Todas tus notas y mensajes a ti mismo se eliminarán permanentemente."
  },
  "newChat": {
    "title": "Nuevo chat",
    "newGroup": "Nuevo grupo",
    "newChannel": "Nuevo canal",
    "messageYourself": "Mensaje a ti mismo"
  }
}
es/messages.json

json
{
  "composer": {
    "placeholder": "Mensaje…",
    "attach": "Adjuntar",
    "emoji": "Emoji",
    "send": "Enviar",
    "recordVoice": "Grabar nota de voz"
  },
  "attachments": {
    "photo": "Foto / Video",
    "camera": "Cámara",
    "file": "Archivo",
    "contact": "Contacto"
  },
  "preview": {
    "captionPlaceholder": "Añade un pie de foto…",
    "send": "Enviar",
    "cancel": "Cancelar",
    "uploading": "Subiendo… {{percent}}%"
  },
  "actions": {
    "reply": "Responder",
    "copy": "Copiar",
    "forward": "Reenviar",
    "edit": "Editar",
    "delete": "Eliminar",
    "deleteForMe": "Eliminar para mí",
    "deleteForEveryone": "Eliminar para todos",
    "react": "Reaccionar",
    "pin": "Fijar",
    "unpin": "Desfijar",
    "selectAll": "Seleccionar todo",
    "deselectAll": "Deseleccionar todo"
  },
  "edit": {
    "title": "Editar mensaje",
    "save": "Guardar",
    "cannotEdit": "Ya no puedes editar este mensaje."
  },
  "delete": {
    "title": "¿Eliminar mensaje?",
    "bodyMe": "¿Eliminar este mensaje para ti? Los demás aún lo verán.",
    "bodyEveryone": "¿Eliminar este mensaje para todos? Verán 'Este mensaje fue eliminado' en su lugar."
  },
  "forward": {
    "title": "Reenviar a…",
    "cta": "Reenviar a {{count}} chats",
    "maxReached": "Puedes seleccionar hasta 5 chats",
    "success": "Reenviado a {{count}} chats"
  },
  "reply": {
    "replyingTo": "Respondiendo a {{name}}",
    "cancel": "Cancelar respuesta"
  },
  "status": {
    "sending": "Enviando…",
    "failed": "No se pudo enviar el mensaje",
    "tapToRetry": "Toca para reintentar"
  },
  "empty": {
    "directTitle": "¡Dile hola a {{name}}! 👋",
    "directSubtitle": "Los mensajes son privados entre ustedes.",
    "groupTitle": "Este es el inicio del grupo.",
    "groupSubtitle": "Envía un mensaje para comenzar.",
    "selfTitle": "Mensaje a ti mismo",
    "selfSubtitle": "Notas, enlaces e ideas — solo para ti."
  },
  "search": {
    "placeholder": "Buscar en la conversación…",
    "counter": "{{current}} de {{total}}",
    "localOnlyNote": "Solo se buscan mensajes cargados. Desplázate hacia arriba para cargar más antiguos.",
    "noResults": "Ningún mensaje coincide con '{{query}}'"
  },
  "pinned": {
    "title": "Mensaje fijado",
    "titleMany": "{{count}} mensajes fijados",
    "limitReached": "Solo puedes fijar hasta 3 mensajes. Desfija uno primero."
  },
  "reactions": {
    "add": "Añadir reacción",
    "you": "Reaccionaste"
  },
  "voice": {
    "recording": "Grabando… {{time}}",
    "maxReached": "Máximo 5 minutos alcanzado",
    "cancel": "Cancelar",
    "send": "Enviar",
    "delete": "Eliminar",
    "micDenied": "Se requiere acceso al micrófono para grabar notas de voz."
  },
  "mentions": {
    "autocompleteTitle": "Miembros"
  },
  "system": {
    "memberJoined": "{{name}} se unió al grupo",
    "memberLeft": "{{name}} salió del grupo",
    "memberAdded": "{{actor}} añadió a {{name}}",
    "memberRemoved": "{{actor}} eliminó a {{name}}",
    "adminPromoted": "{{actor}} promovió a {{name}} a admin",
    "adminDemoted": "{{actor}} degradó a {{name}} de admin"
  }
}
es/calls.json

json
{
  "title": "Llamadas",
  "subtitle": "Actividad reciente de voz y video",
  "searchPlaceholder": "Buscar llamadas…",
  "filters": {
    "all": "Todas",
    "missed": "Perdidas"
  },
  "types": {
    "voice": "Llamada de voz",
    "video": "Videollamada"
  },
  "status": {
    "missed": "Perdida",
    "declined": "Rechazada",
    "canceled": "Cancelada",
    "noAnswer": "Sin respuesta",
    "inProgress": "En curso"
  },
  "empty": {
    "title": "Sin llamadas aún",
    "subtitle": "Inicia una desde un chat.",
    "cta": "Nueva llamada"
  },
  "incoming": {
    "voiceCall": "Llamada de voz entrante",
    "videoCall": "Videollamada entrante",
    "accept": "Aceptar",
    "decline": "Rechazar"
  },
  "outgoing": {
    "calling": "Llamando…",
    "cancel": "Cancelar llamada",
    "noAnswer": "Sin respuesta",
    "declined": "Llamada rechazada"
  },
  "active": {
    "voiceCall": "Llamada de voz",
    "videoCall": "Videollamada",
    "connecting": "Conectando…",
    "ended": "Llamada finalizada",
    "networkLost": "Conexión perdida",
    "mute": "Silenciar",
    "unmute": "Activar micrófono",
    "speaker": "Altavoz",
    "cameraOn": "Cámara activada",
    "cameraOff": "Cámara desactivada",
    "switchCamera": "Cambiar cámara",
    "hangup": "Colgar"
  },
  "permissions": {
    "denied": "Se requiere acceso a cámara/micrófono. Actívalo en la configuración del navegador.",
    "retry": "Intentar de nuevo"
  },
  "newCall": {
    "title": "Nueva llamada",
    "searchPlaceholder": "Buscar contactos…",
    "empty": "No hay contactos con chats activos. Inicia un chat primero."
  }
}
es/communities.json

json
{
  "title": "Comunidades",
  "searchPlaceholder": "Buscar comunidades…",
  "empty": {
    "title": "Aún no estás en ninguna comunidad",
    "subtitle": "Pídele una invitación a un amigo o crea una.",
    "cta": "Nueva comunidad"
  },
  "card": {
    "seeAll": "Ver todos los {{count}} chats"
  },
  "createModal": {
    "title": "Nueva comunidad",
    "nameLabel": "Nombre de la comunidad",
    "namePlaceholder": "ej. Senderistas de fin de semana",
    "descriptionLabel": "Descripción (opcional)",
    "submit": "Crear comunidad"
  },
  "createChatModal": {
    "title": "Nuevo chat",
    "nameLabel": "Nombre del chat",
    "namePlaceholder": "ej. Anuncios",
    "submit": "Crear chat"
  },
  "info": {
    "title": "Info de la comunidad",
    "membersCount": "{{count}} miembros",
    "createdOn": "Creada el {{date}}",
    "viewMembers": "Ver miembros",
    "mute": "Silenciar comunidad",
    "leave": "Salir de la comunidad",
    "delete": "Eliminar comunidad",
    "deleteConfirm": "Escribe ELIMINAR para confirmar",
    "deleteWarning": "Esto eliminará permanentemente la comunidad y todos sus chats.",
    "leaveWarning": "Eres el dueño de esta comunidad. Si te vas, el admin más antiguo (o el miembro más antiguo si no hay admins) se convertirá automáticamente en el nuevo dueño."
  },
  "chatOptions": {
    "communityInfo": "Info de la comunidad"
  }
}
es/novedades.json

json
{
  "title": "Novedades",
  "searchPlaceholder": "Buscar historias y canales…",
  "stories": {
    "myStory": "Mi historia",
    "addStory": "Añadir historia",
    "viewedBy": "Vista por {{count}}",
    "noViews": "Sin vistas aún",
    "reply": "Responder a {{name}}…",
    "replySent": "Respuesta enviada",
    "deleteStory": "Eliminar esta historia",
    "deleteAllStories": "Eliminar todas mis historias",
    "confirmDelete": "¿Eliminar esta historia?",
    "limitReached": "Puedes tener hasta 10 historias activas.",
    "textPlaceholder": "Escribe tu historia…",
    "send": "Enviar",
    "cancel": "Cancelar",
    "maxDuration": "Los videos pueden durar hasta 15 segundos"
  },
  "channels": {
    "sectionTitle": "Canales",
    "discoverTitle": "Encuentra canales para seguir",
    "follow": "Seguir",
    "following": "Siguiendo",
    "unfollow": "Dejar de seguir",
    "mute": "Silenciar",
    "unmute": "Activar sonido",
    "membersCount_one": "{{count}} seguidor",
    "membersCount_other": "{{count}} seguidores",
    "empty": "Aún no sigues ningún canal.",
    "createModal": {
      "title": "Nuevo canal",
      "nameLabel": "Nombre del canal",
      "slugLabel": "Slug",
      "slugHint": "Letras minúsculas, números y guiones",
      "descriptionLabel": "Descripción (opcional)",
      "submit": "Crear canal"
    },
    "info": {
      "title": "Info del canal",
      "follow": "Seguir",
      "unfollow": "Dejar de seguir",
      "mute": "Silenciar canal",
      "delete": "Eliminar canal",
      "deleteConfirm": "Escribe ELIMINAR para confirmar",
      "deleteWarning": "Esto eliminará permanentemente el canal y todos sus mensajes.",
      "edit": "Editar canal"
    },
    "header": {
      "membersCount_one": "{{count}} seguidor",
      "membersCount_other": "{{count}} seguidores"
    },
    "empty": {
      "noMessages": "Sin mensajes aún."
    }
  },
  "bottomButtons": {
    "exploreMore": "Explorar más",
    "createChannel": "Crear canal"
  }
}
es/settings.json

json
{
  "title": "Ajustes",
  "sections": {
    "profile": "Perfil",
    "account": "Cuenta",
    "devices": "Dispositivos",
    "storage": "Almacenamiento",
    "privacy": "Privacidad",
    "appearance": "Apariencia",
    "notifications": "Notificaciones",
    "about": "Acerca de"
  },
  "profile": {
    "title": "Editar perfil",
    "displayName": "Nombre visible",
    "firstName": "Nombre",
    "lastName": "Apellido",
    "username": "Nombre de usuario",
    "bio": "Biografía",
    "bioCounter": "{{current}}/{{max}}",
    "socialLinks": "Redes sociales",
    "save": "Guardar cambios",
    "saved": "Perfil actualizado",
    "usernameTaken": "Alguien acaba de tomar este nombre. Prueba otro.",
    "usernameCooldown": "Podrás cambiar tu nombre de usuario nuevamente el {{date}}.",
    "avatarMenu": {
      "view": "Ver foto",
      "takePhoto": "Tomar foto",
      "upload": "Subir foto",
      "remove": "Eliminar foto",
      "cancel": "Cancelar"
    },
    "social": {
      "title": "Redes sociales",
      "addCustom": "Añadir enlace personalizado",
      "labelPlaceholder": "Etiqueta",
      "urlPlaceholder": "https://…",
      "remove": "Eliminar",
      "maxReached": "Puedes añadir hasta 20 enlaces personalizados",
      "save": "Guardar enlaces"
    }
  },
  "account": {
    "title": "Cuenta",
    "email": "Correo",
    "changeEmail": "Cambiar correo",
    "emailChanged": "Confirmación enviada a {{email}}. Haz clic en el enlace para completar el cambio.",
    "deleteAccount": "Eliminar cuenta",
    "deleteTitle": "¿Eliminar tu cuenta?",
    "deleteBody1": "Tu cuenta se eliminará permanentemente después de un período de gracia de 30 días. Durante ese tiempo, puedes cancelar esto desde cualquier dispositivo.",
    "deleteBody2": "Tus mensajes seguirán siendo visibles para otros usuarios en tus conversaciones, pero atribuidos a 'Usuario eliminado'. Tu perfil, avatar y datos personales se eliminarán.",
    "deleteConfirm": "Escribe ELIMINAR para confirmar",
    "scheduleDeletion": "Programar eliminación",
    "cancelDeletion": "Cancelar eliminación",
    "pendingBanner": "Tu cuenta se eliminará el {{date}}.",
    "cancel": "Cancelar"
  },
  "devices": {
    "title": "Dispositivos",
    "thisDevice": "Este dispositivo",
    "lastActive": "Última actividad {{time}}",
    "signOutOne": "Cerrar sesión",
    "signOutAll": "Cerrar sesión en todos los demás dispositivos",
    "signOutAllConfirm": "¿Cerrar sesión en todos los demás dispositivos?"
  },
  "storage": {
    "title": "Almacenamiento",
    "totalUsed": "{{size}} usados",
    "avatars": "Avatares",
    "chatMedia": "Media de chat",
    "stories": "Historias",
    "note": "Los archivos se comprimen automáticamente al subirlos. Pueden aplicarse límites mayores."
  },
  "privacy": {
    "title": "Privacidad",
    "blocked": "Contactos bloqueados",
    "blockedCount": "Contactos bloqueados ({{count}})",
    "unblock": "Desbloquear",
    "emptyBlocked": "No has bloqueado a nadie.",
    "photo": "Foto de perfil",
    "presence": "Última conexión y en línea",
    "stories": "Historias",
    "readReceipts": "Confirmación de lectura",
    "readReceiptsHint": "Cuando está activo, otros pueden ver cuándo lees sus mensajes. Cuando está desactivado, tú tampoco verás sus confirmaciones de lectura.",
    "visibility": {
      "everyone": "Todos",
      "contacts": "Mis contactos",
      "contactsExcept": "Mis contactos excepto…",
      "nobody": "Nadie",
      "manageExclusions": "Gestionar exclusiones ({{count}})",
      "title": "Ocultar de…",
      "searchPlaceholder": "Buscar contactos…",
      "saveWithCount": "Guardar ({{count}} excluidos)"
    },
    "disableReceiptsTitle": "¿Desactivar confirmaciones de lectura?",
    "disableReceiptsBody": "Cuando las confirmaciones de lectura están desactivadas, no verás cuándo otros han leído tus mensajes, y ellos no verán cuándo tú has leído los suyos. Esto aplica a todos hasta que lo vuelvas a activar.",
    "keepEnabled": "Mantener activadas",
    "turnOff": "Desactivar"
  },
  "appearance": {
    "themeTitle": "Tema",
    "themeLight": "Claro",
    "themeDark": "Oscuro",
    "themeSystem": "Sistema",
    "accentTitle": "Color de acento",
    "accent_blue": "Azul",
    "accent_purple": "Morado",
    "accent_red": "Rojo",
    "accent_orange": "Naranja",
    "accent_yellow": "Amarillo",
    "accent_green": "Verde",
    "languageTitle": "Idioma",
    "langEnglish": "English",
    "langSpanish": "Español"
  },
  "notifications": {
    "title": "Notificaciones",
    "enable": "Notificaciones",
    "sound": "Sonido",
    "previews": "Vistas previas de mensajes",
    "note": "Las notificaciones push requieren instalar la app. Las notificaciones en el navegador se muestran mientras la app está abierta en una pestaña.",
    "permissionPrompt": "Activa las notificaciones para recibir mensajes y llamadas cuando SilverChat esté en segundo plano.",
    "enableButton": "Activar",
    "notNow": "Ahora no"
  },
  "about": {
    "title": "Acerca de",
    "version": "Versión {{version}}",
    "terms": "Términos de servicio",
    "privacy": "Política de privacidad",
    "licenses": "Licencias open source",
    "signOut": "Cerrar sesión"
  },
  "logout": {
    "title": "¿Cerrar sesión en SilverChat?",
    "body": "Tendrás que iniciar sesión de nuevo con un enlace mágico.",
    "alsoSignOutAll": "También cerrar sesión en todos los demás dispositivos",
    "logout": "Cerrar sesión"
  }
}
es/errors.json

json
{
  "network": "Error de red. Verifica tu conexión.",
  "timeout": "Solicitud agotada. Intenta de nuevo.",
  "unauthorized": "No tienes permiso para hacer eso.",
  "notFound": "No encontrado.",
  "serverError": "Algo salió mal. Intenta en un momento.",
  "generic": "Algo salió mal.",
  "uploadFailed": "Error al subir. Intenta de nuevo.",
  "invalidInput": "Entrada inválida.",
  "rateLimited": "Demasiadas solicitudes. Espera un momento.",
  "offline": "Estás desconectado."
}
15. MODIFY src/app/main.tsx
Add import './lib/i18n'; as the first import, before React:

tsx
import './lib/i18n';  // MUST be first
import '@fontsource-variable/inter';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
16. WHAT TO DO NOT DO IN THIS PROMPT
❌ Do NOT translate any existing component. That's a follow-up pass.

❌ Do NOT regenerate any component from previous prompts.

❌ Do NOT add new features beyond i18n + theme infrastructure.

❌ Do NOT change any user_settings schema (columns already exist).

❌ Do NOT create additional locales beyond en and es.

❌ Do NOT add date libraries (moment, date-fns, dayjs).

17. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: i18next config, 9 namespaces × 2
languages (18 JSON files), 3 hooks + 2 providers + 2 lib files, FOUC
script, prefers-color-scheme listener, AppearanceScreen rewrite.

Complete file tree of new/modified files.

Complete content of every file:

src/lib/i18n.ts

src/lib/theme.ts

src/types/i18n.d.ts

src/hooks/useTheme.ts

src/hooks/useLanguage.ts

src/hooks/useFormatters.ts

src/app/providers/ThemeProvider.tsx

src/app/providers/I18nProvider.tsx

src/features/settings/components/AppearanceScreen.tsx

index.html (modified, with inline script)

src/app/main.tsx (modified, i18n import first)

All 18 locale JSON files (9 en + 9 es)

Verification checklist:

pnpm dev boots without errors

On first load with fresh localStorage: language detected from
navigator.language (es device → Spanish UI on strings that use t())

Manually set localStorage.silverchat_language = 'fr' → app falls back
to English (unsupported → en)

Change language to Spanish via /settings/appearance → all keys using
t() re-render in Spanish without reload

Reload page → Spanish persists

Sign out → sign in from another browser → Spanish persists (from
user_settings.language)

Toggle theme Light/Dark/System → <html data-theme> attribute updates

Reload page with dark theme → no flash of light theme (FOUC script
works)

Toggle accent between 6 colors → <html class="theme-*"> updates

Open in OS dark mode with theme='system' → app follows OS, then toggle
OS to light → app switches live (media query listener)

useFormatters().formatRelative('2024-01-01') returns Spanish relative
time when language='es'

useFormatters().formatBytes(1024 * 1024) returns "1.0 MB" in both
languages

Logout then login as different user with different language → UI
follows the new user's preference

A short list of pitfalls to warn the developer:

Why import './lib/i18n' MUST be the first import in main.tsx
(i18next must be initialized before any component calls t())

Why the FOUC script is inline and blocking (must run before CSS paints;
a deferred script would still flash)

Why <html data-theme="dark"> is only set for explicit dark (light is
the default :root) — the CSS from Prompt #3 relies on this

Why the theme hook uses data-theme attribute + accent classes
separately (two dimensions: mode × accent)

Why user_settings fetch overrides localStorage after login
(cross-device sync is the source of truth once authenticated)

Why i18next-browser-languagedetector has convertDetectedLanguage
(browser reports es-MX, es-AR, en-US — we normalize to es/en)

Why useSuspense: false is set (avoids breaking React Router's
suspense boundaries from TanStack; Suspense-based i18n works better in
Next.js than SPA)

Why Intl.RelativeTimeFormat with numeric: 'auto' yields "yesterday"
instead of "1 day ago" — this is intentional

Why the AppearanceScreen debounces DB writes 500ms (rapid accent
previews shouldn't hammer the DB)

Why the prefers-color-scheme listener only runs when theme === 'system' (avoids overriding explicit user choice)

Why localStorage is wrapped in try/catch (Safari private mode
throws)

Why translation coverage is intentionally incomplete — existing
components still have hardcoded strings. That's a follow-up pass (the
developer will replace them with t('namespace.key') incrementally).

Do not translate existing components. Do not modify any component except
AppearanceScreen.tsx and main.tsx. This prompt installs the
infrastructure, not the translations.
```
