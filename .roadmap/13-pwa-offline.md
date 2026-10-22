# SILVERCHAT — PROMPT #13: PWA, OFFLINE & PUSH NOTIFICATIONS

You are a senior frontend engineer making SilverChat a **fully installable
PWA with offline support and push notifications**.

This prompt covers: PWA manifest, service worker (via vite-plugin-pwa),
cache strategies, IndexedDB offline cache, offline message outbox, update
flow, install prompt, offline banner, push notifications (VAPID + Edge
Function), iOS Safari handling.

**Not covered here**: Background Sync API (Fase 2), periodic background
sync (Fase 2), offline media upload queue (Fase 2).

All decisions are **final and locked**.

---

## 1. LOCKED DECISIONS

| #   | Decision                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | `vite-plugin-pwa` with Workbox integration                                                                                                       |
| P2  | Cache strategy: app shell NetworkFirst, JS/CSS/fonts CacheFirst (1y), avatars StaleWhileRevalidate (7d), chat media NetworkOnly, API NetworkOnly |
| P3  | IndexedDB (via `idb`) for offline message cache: last 50/chat + 200 chats                                                                        |
| P4  | Outbox in IndexedDB: text messages only, 3 retries, no background sync                                                                           |
| P5  | Update flow: non-forced banner "New version available · [Reload]"                                                                                |
| P6  | Install prompt: `beforeinstallprompt` + info modal before native prompt                                                                          |
| P7  | Offline banner (amber, sticky top) when `navigator.onLine === false`                                                                             |
| P8  | **Push notifications in MVP** via VAPID + Edge Function `send-push`                                                                              |
| P9  | **No Background Sync API** — outbox processes only when tab is open                                                                              |
| P10 | iOS Safari: detect + install instructions; push only after PWA install (iOS 16.4+)                                                               |

Additional locked decisions:

- **SW registration**: auto-update mode (`registerType: 'prompt'` — user
  decides when to reload).
- **Manifest `display`**: `standalone`.
- **Theme color**: `#0EA5E9` (electric blue from Design System).
- **Background color**: `#0F172A` (dark base for splash screen).
- **Icons**: provided by developer in `public/icons/` (192, 512, 512 maskable,
  180 apple-touch). We specify the paths and manifest entries only.
- **Push triggers** (via Supabase Database Webhooks):
  - `messages` INSERT → push to all chat members except the sender
  - `calls` INSERT (status=`ringing`) → push to all chat members except the
    initiator
- **Push payload includes `data.url`** so tapping a notification opens the
  right route (`/chats/:chatId` or `/calls`).
- **Push `tag`** uses `chat_id` for messages (avoids spam per chat) and
  `call_id` for calls (each call distinct).
- **VAPID keys** are generated once by the developer and stored as Supabase
  secrets + frontend env var (public key).
- **IndexedDB is cleared on logout** (privacy — no cross-user data leaks).
- **Push subscriptions** stored in existing `devices.push_subscription` jsonb
  column (from #4a).

---

## 2. DEPENDENCIES

```bash
pnpm add -D vite-plugin-pwa workbox-window
pnpm add idb

vite-plugin-pwa: generates SW + manifest

workbox-window: hooks into the generated SW (updates, registration)

idb: tiny IndexedDB wrapper (~1KB)

No additional dependencies for push on the client — pushManager is
native.

Server-side (Edge Function):

web-push (Deno-compatible via esm.sh)

3. VITE CONFIG
Modify vite.config.ts:

ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,  // we register manually with workbox-window
      includeAssets: ['favicon.ico', 'icons/*.png', 'sounds/*.mp3'],
      manifest: false,  // we use a static manifest.webmanifest instead
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,mp3}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/functions\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/avatars\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'avatars',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/.*/i,
            handler: 'NetworkOnly',  // chat media: never cache (privacy + signed URLs)
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,  // don't run SW in dev (avoids cache hell)
      },
    }),
  ],
});
4. STATIC MANIFEST — public/manifest.webmanifest
json
{
  "name": "SilverChat",
  "short_name": "SilverChat",
  "description": "Privacy-first messaging with a futuristic silver aesthetic.",
  "start_url": "/chats",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0EA5E9",
  "background_color": "#0F172A",
  "categories": ["social", "communication"],
  "lang": "en",
  "dir": "ltr",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "New chat",
      "short_name": "New chat",
      "url": "/chats?action=new",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Calls",
      "short_name": "Calls",
      "url": "/calls",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
Link it in index.html:

html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#0EA5E9" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="SilverChat" />
<link rel="apple-touch-icon" href="/icons/icon-180.png" />
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
Icon requirements (developer provides, we just reference paths):

icon-180.png — Apple touch (180×180)

icon-192.png — PWA (192×192)

icon-512.png — PWA (512×512)

icon-512-maskable.png — PWA maskable (512×512, safe-zone 80%)

favicon.ico — 32×32

5. FILE STRUCTURE
text
public/
├── manifest.webmanifest
├── icons/
│   ├── icon-180.png
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-512-maskable.png
└── sounds/
    ├── ringtone.mp3
    └── calling.mp3

src/
├── pwa/
│   ├── registerSW.ts                     (registerSW with workbox-window)
│   ├── useServiceWorkerUpdate.ts
│   ├── useInstallPrompt.ts
│   ├── useOnlineStatus.ts
│   ├── useIsIOS.ts
│   ├── usePushSubscription.ts
│   ├── useNotificationPermission.ts
│   └── sw.ts                             (custom SW additions if needed — see note)
├── lib/
│   ├── offline-db.ts                     (IndexedDB schemas + helpers)
│   ├── outbox.ts                         (queue processing logic)
│   ├── message-cache.ts                  (cache/read messages from IDB)
│   └── push.ts                           (client push subscription helper)
├── components/
│   ├── InstallButton.tsx                 (header button — replaces existing)
│   ├── PWAInstallBanner.tsx
│   ├── OfflineBanner.tsx
│   ├── UpdateAvailableBanner.tsx
│   ├── NotificationPermissionPrompt.tsx
│   └── IOSInstallInstructions.tsx
└── features/pwa/
    └── hooks/
        └── useOutboxProcessor.ts

supabase/functions/
└── send-push/
    └── index.ts
Modified files:

_authenticated.tsx — mount <OfflineBanner>, <UpdateAvailableBanner>,
<PWAInstallBanner>, <NotificationPermissionPrompt>, <IOSInstallInstructions>

AppHeader.tsx — <InstallButton> connected to useInstallPrompt

useMessages (from #8a) — reads from IndexedDB first, then network

useSendMessage (from #8a) — enqueues in outbox when offline

main.tsx — registerSW()

6. src/pwa/registerSW.ts
ts
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker(onUpdateReady: () => void) {
  if ('serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        onUpdateReady();
      },
      onOfflineReady() {
        // Optional: show a small toast "App ready to work offline"
      },
      onRegisteredSW(_swUrl, registration) {
        // Optional: periodic check for updates every hour
        if (registration) {
          setInterval(() => {
            registration.update().catch(() => {});
          }, 60 * 60 * 1000);
        }
      },
    });
  }
}
Called in main.tsx before <App /> mounts. Pass a callback that sets a
needUpdate flag (read by <UpdateAvailableBanner>).

7. src/pwa/useOnlineStatus.ts
ts
import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
8. src/pwa/useInstallPrompt.ts
ts
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect if already installed (standalone display-mode)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const onAppInstalled = () => setIsInstalled(true);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  };

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
9. src/pwa/useIsIOS.ts
ts
export function useIsIOS(): { isIOS: boolean; isIOSSafari: boolean; isStandalone: boolean } {
  if (typeof navigator === 'undefined') {
    return { isIOS: false, isIOSSafari: false, isStandalone: false };
  }

  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isIOSSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  return { isIOS, isIOSSafari, isStandalone };
}
10. src/lib/offline-db.ts
ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface OutboxMessage {
  id: string;               // uuid client-generated
  user_id: string;          // isolate by user
  chat_id: string;
  type: 'text';
  content: string;
  reply_to_message_id: string | null;
  created_at: string;
  status: 'pending' | 'sending' | 'failed';
  retry_count: number;
  last_attempt_at: string | null;
}

export interface CachedChats {
  user_id: string;
  chats: unknown[];         // Chat[] shape from #7
  updated_at: string;
}

export interface CachedMessages {
  chat_id: string;
  user_id: string;
  messages: unknown[];      // Message[] shape from #8a
  updated_at: string;
}

interface SilverChatDB extends DBSchema {
  outbox: {
    key: string;
    value: OutboxMessage;
    indexes: { 'by-user': string; 'by-status': string };
  };
  chats: {
    key: string;            // user_id
    value: CachedChats;
  };
  messages: {
    key: string;            // `${user_id}:${chat_id}`
    value: CachedMessages;
    indexes: { 'by-user': string };
  };
}

let dbPromise: Promise<IDBPDatabase<SilverChatDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SilverChatDB>('silverchat', 1, {
      upgrade(db) {
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' });
        outbox.createIndex('by-user', 'user_id');
        outbox.createIndex('by-status', 'status');

        db.createObjectStore('chats', { keyPath: 'user_id' });

        const messages = db.createObjectStore('messages', { keyPath: ['user_id', 'chat_id'] });
        messages.createIndex('by-user', 'user_id');
      },
    });
  }
  return dbPromise;
}

export async function clearAllUserData(userId: string) {
  const db = await getDB();
  const tx = db.transaction(['outbox', 'chats', 'messages'], 'readwrite');

  // Clear outbox for user
  const outboxIdx = tx.objectStore('outbox').index('by-user');
  const outboxKeys = await outboxIdx.getAllKeys(userId);
  for (const k of outboxKeys) await tx.objectStore('outbox').delete(k);

  // Clear chats
  await tx.objectStore('chats').delete(userId);

  // Clear messages for user
  const msgIdx = tx.objectStore('messages').index('by-user');
  const msgKeys = await msgIdx.getAllKeys(userId);
  for (const k of msgKeys) await tx.objectStore('messages').delete(k);

  await tx.done;
}
Key point: messages store uses compound key [user_id, chat_id] so
multiple accounts on the same device don't leak data.

11. src/lib/message-cache.ts
ts
import { getDB } from './offline-db';

export async function cacheMessages(userId: string, chatId: string, messages: unknown[]) {
  const db = await getDB();
  // Only keep last 50 (matches query limit in #8a)
  await db.put('messages', {
    user_id: userId,
    chat_id: chatId,
    messages: messages.slice(-50),
    updated_at: new Date().toISOString(),
  });
}

export async function readCachedMessages(userId: string, chatId: string) {
  const db = await getDB();
  const row = await db.get('messages', [userId, chatId]);
  return row?.messages ?? null;
}

export async function cacheChats(userId: string, chats: unknown[]) {
  const db = await getDB();
  await db.put('chats', {
    user_id: userId,
    chats: chats.slice(0, 200),
    updated_at: new Date().toISOString(),
  });
}

export async function readCachedChats(userId: string) {
  const db = await getDB();
  const row = await db.get('chats', userId);
  return row?.chats ?? null;
}
Integration in useMessages (from #8a): the query's queryFn does:

Try network fetch (existing logic)

On success → cacheMessages(userId, chatId, data)

On failure (offline) → readCachedMessages(userId, chatId) as fallback

Same pattern for useChats (from #7) with cacheChats/readCachedChats.

12. src/lib/outbox.ts
ts
import { getDB, type OutboxMessage } from './offline-db';

export async function enqueueOutbox(userId: string, message: Omit<OutboxMessage, 'status' | 'retry_count' | 'last_attempt_at'>) {
  const db = await getDB();
  await db.put('outbox', {
    ...message,
    user_id: userId,
    status: 'pending',
    retry_count: 0,
    last_attempt_at: null,
  });
}

export async function getPendingOutbox(userId: string): Promise<OutboxMessage[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('outbox', 'by-user', userId);
  return all
    .filter(m => m.status === 'pending' || (m.status === 'failed' && m.retry_count < 3))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function markSending(id: string) {
  const db = await getDB();
  const row = await db.get('outbox', id);
  if (row) await db.put('outbox', { ...row, status: 'sending', last_attempt_at: new Date().toISOString() });
}

export async function markFailed(id: string, retryIncrement = true) {
  const db = await getDB();
  const row = await db.get('outbox', id);
  if (row) {
    await db.put('outbox', {
      ...row,
      status: 'failed',
      retry_count: row.retry_count + (retryIncrement ? 1 : 0),
      last_attempt_at: new Date().toISOString(),
    });
  }
}

export async function removeOutbox(id: string) {
  const db = await getDB();
  await db.delete('outbox', id);
}
13. src/features/pwa/hooks/useOutboxProcessor.ts
ts
import { useEffect, useRef } from 'react';
import { useOnlineStatus } from '@/pwa/useOnlineStatus';
import { supabase } from '@/lib/supabase';
import { getDB } from '@/lib/offline-db';
import {
  getPendingOutbox, markSending, markFailed, removeOutbox,
} from '@/lib/outbox';
import { useQueryClient } from '@tanstack/react-query';

export function useOutboxProcessor(userId: string | null) {
  const online = useOnlineStatus();
  const qc = useQueryClient();
  const processing = useRef(false);

  useEffect(() => {
    if (!online || !userId || processing.current) return;

    processing.current = true;
    (async () => {
      try {
        const pending = await getPendingOutbox(userId);
        for (const msg of pending) {
          await markSending(msg.id);
          try {
            const { error } = await supabase.from('messages').insert({
              chat_id: msg.chat_id,
              sender_id: userId,
              type: msg.type,
              content: msg.content,
              reply_to_message_id: msg.reply_to_message_id,
            });
            if (error) throw error;

            await removeOutbox(msg.id);
            qc.invalidateQueries({ queryKey: ['messages', msg.chat_id] });
            qc.invalidateQueries({ queryKey: ['chats'] });
          } catch (err) {
            console.error('[outbox] failed to send', msg.id, err);
            await markFailed(msg.id);
          }
        }
      } finally {
        processing.current = false;
      }
    })();
  }, [online, userId, qc]);
}
Wiring: called in _authenticated.tsx (or <App>) with the current
user.id. It also listens to visibilitychange (tab becomes visible → retry).

Integration with useSendMessage (from #8a): if !online, enqueue in
outbox + insert an optimistic message into the TanStack Query cache with a
temp- id and status: pending. When the outbox processor sends it, the
message is invalidated and re-fetched with the real id.

14. src/lib/push.ts + usePushSubscription
src/lib/push.ts:

ts
const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
  });
  return sub;
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await sub?.unsubscribe();
}
src/pwa/useNotificationPermission.ts:

ts
import { useState, useEffect } from 'react';

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const request = async (): Promise<NotificationPermission> => {
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    const handler = () => setPermission(Notification.permission);
    // No standard event; poll occasionally
    const id = setInterval(handler, 5000);
    return () => clearInterval(id);
  }, []);

  return { permission, request };
}
src/pwa/usePushSubscription.ts:

ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { subscribeToPush, unsubscribeFromPush } from '@/lib/push';
import { useNotificationPermission } from './useNotificationPermission';
import { getOrCreateDeviceFingerprint, getDeviceName } from '@/lib/devices'; // from #6

export function usePushSubscription(userId: string | null, enabled: boolean) {
  const { permission, request } = useNotificationPermission();

  useEffect(() => {
    if (!userId) return;

    if (enabled && permission === 'default') {
      // Request permission on user gesture via a settings button
      return;
    }

    if (enabled && permission === 'granted') {
      (async () => {
        const sub = await subscribeToPush();
        if (!sub) return;

        const fingerprint = getOrCreateDeviceFingerprint();
        const payload = sub.toJSON();
        await supabase.from('devices').upsert(
          {
            user_id: userId,
            device_fingerprint: fingerprint,
            device_name: getDeviceName(),
            device_type: 'web',
            user_agent: navigator.userAgent,
            last_active_at: new Date().toISOString(),
            push_subscription: payload,
          },
          { onConflict: 'user_id,device_fingerprint' }
        );
      })();
    }

    if (!enabled) {
      (async () => {
        await unsubscribeFromPush();
        const fingerprint = getOrCreateDeviceFingerprint();
        await supabase
          .from('devices')
          .update({ push_subscription: null })
          .eq('user_id', userId)
          .eq('device_fingerprint', fingerprint);
      })();
    }
  }, [userId, enabled, permission]);

  return { permission, requestPermission: request };
}
Permission prompt UX (see section 15): shown once after login, only if
permission === 'default'. The user must tap "Enable notifications" for the
browser prompt to fire.

15. COMPONENTS
15.1 OfflineBanner
Rendered at the top of _authenticated.tsx, above all content:

tsx
function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-amber-500 text-amber-950 text-xs px-4 py-1.5 text-center font-medium"
    >
      You're offline. Messages will be sent when you reconnect.
    </div>
  );
}
15.2 UpdateAvailableBanner
tsx
function UpdateAvailableBanner() {
  const [needUpdate, setNeedUpdate] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setNeedUpdate(true));
  }, []);

  if (!needUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 glass-surface rounded-xl p-3 flex items-center justify-between gap-3 shadow-xl">
      <span className="text-sm">New version available.</span>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold"
      >
        Reload
      </button>
    </div>
  );
}
15.3 PWAInstallBanner
Modal shown when user taps the header's "Install" button:

tsx
function PWAInstallBanner({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { promptInstall } = useInstallPrompt();
  const { isIOSSafari, isStandalone } = useIsIOS();

  if (!open) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <h2 className="text-lg font-semibold">Install SilverChat</h2>
        <ul className="text-sm space-y-2 my-4">
          <li>✓ One-tap launch from your home screen</li>
          <li>✓ Fullscreen — no browser chrome</li>
          <li>✓ Works offline</li>
          <li>✓ Instant notifications</li>
        </ul>
        {isIOSSafari && !isStandalone ? (
          <p className="text-xs text-muted-foreground">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <button
            onClick={async () => {
              await promptInstall();
              onClose();
            }}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2 font-semibold"
          >
            Install now
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
15.4 InstallButton (header)
Replace the existing placeholder:

tsx
function InstallButton() {
  const { canInstall, isInstalled } = useInstallPrompt();
  const [showBanner, setShowBanner] = useState(false);
  const { isIOSSafari, isStandalone } = useIsIOS();

  const shouldShow = !isInstalled && (canInstall || (isIOSSafari && !isStandalone));
  if (!shouldShow) return null;

  return (
    <>
      <button
        onClick={() => setShowBanner(true)}
        className="bg-primary text-primary-foreground rounded-full px-3 py-1.5 text-sm font-semibold"
      >
        Install
      </button>
      <PWAInstallBanner open={showBanner} onClose={() => setShowBanner(false)} />
    </>
  );
}
15.5 NotificationPermissionPrompt
Shown once, mounted at app root, only after login + if
Notification.permission === 'default' + user hasn't dismissed it before
(persisted in localStorage['silverchat_notif_prompt_dismissed']).

tsx
function NotificationPermissionPrompt() {
  const { user } = useAuth();
  const { permission, requestPermission } = useNotificationPermission();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('silverchat_notif_prompt_dismissed') === 'true'
  );

  const shouldShow =
    user &&
    permission === 'default' &&
    !dismissed;

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-40 glass-surface rounded-xl p-4 shadow-xl">
      <p className="text-sm mb-3">
        Enable notifications to receive messages and calls when SilverChat is
        in the background.
      </p>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            await requestPermission();
            setDismissed(true);
            localStorage.setItem('silverchat_notif_prompt_dismissed', 'true');
          }}
          className="flex-1 bg-primary text-primary-foreground rounded-lg py-2 text-sm font-semibold"
        >
          Enable
        </button>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem('silverchat_notif_prompt_dismissed', 'true');
          }}
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
15.6 IOSInstallInstructions
Shown when isIOSSafari && !isStandalone && !canInstall (iOS doesn't fire
beforeinstallprompt). Rendered as a small banner in the header area or a
modal accessible from settings.

Content:

"To install SilverChat on iOS: tap the Share button → Add to Home Screen."

16. EDGE FUNCTION send-push
File: supabase/functions/send-push/index.ts

ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

serve(async (req) => {
  const { user_id, title, body, data, tag } = await req.json();

  if (!user_id) {
    return new Response('user_id required', { status: 400 });
  }

  webpush.setVapidDetails(
    'mailto:noreply@silverchat.app',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!
  );

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: devices } = await supabase
    .from('devices')
    .select('id, push_subscription')
    .eq('user_id', user_id)
    .not('push_subscription', 'is', null);

  if (!devices?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  const toRemove: string[] = [];

  for (const device of devices) {
    const sub = device.push_subscription;
    if (!sub) continue;
    try {
      await webpush.sendNotification(sub, JSON.stringify({
        title, body, data, tag,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
      }));
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired, remove
        toRemove.push(device.id);
      } else {
        console.error('[send-push] error', err.statusCode, err.body);
      }
    }
  }

  if (toRemove.length) {
    await supabase.from('devices').update({ push_subscription: null }).in('id', toRemove);
  }

  return new Response(JSON.stringify({ sent, removed: toRemove.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
Database Webhooks (configure in Supabase dashboard):

Webhook 1: messages INSERT

URL: https://<project>.supabase.co/functions/v1/send-push

Headers: Authorization: Bearer <service_role_key>

Body template:

json
{
  "user_id": "{{ recipient_id from chat_members }}",
  "title": "New message",
  "body": "{{ messages.sender_name }}: {{ messages.preview }}",
  "data": { "url": "/chats/{{ messages.chat_id }}" },
  "tag": "{{ messages.chat_id }}"
}
Note: since Database Webhooks can't JOIN, we need a helper trigger
that inserts a row into a push_queue table, then a separate cron or
a Postgres trigger to call pg_net.http_post. Simpler alternative:
use pg_net directly from a trigger function.

Alternative (recommended): Postgres trigger + pg_net

sql
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_sender_name text;
  v_preview text;
  v_payload jsonb;
BEGIN
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.chat_id IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
  v_preview := compute_message_preview(NEW);

  FOR v_member IN
    SELECT user_id FROM chat_members
    WHERE chat_id = NEW.chat_id AND user_id <> NEW.sender_id
  LOOP
    v_payload := jsonb_build_object(
      'user_id', v_member.user_id,
      'title', 'New message from ' || COALESCE(v_sender_name, 'Someone'),
      'body', v_preview,
      'data', jsonb_build_object('url', '/chats/' || NEW.chat_id),
      'tag', NEW.chat_id
    );
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := v_payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_insert_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  WHEN (NEW.chat_id IS NOT NULL AND NEW.sender_id IS NOT NULL)
  EXECUTE FUNCTION notify_new_message();
Same pattern for calls:

sql
CREATE OR REPLACE FUNCTION notify_new_call()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_member RECORD;
  v_initiator RECORD;
  v_payload jsonb;
BEGIN
  IF NEW.status <> 'ringing' THEN RETURN NEW; END IF;

  SELECT display_name, username FROM profiles WHERE id = NEW.initiator_id
    INTO v_initiator;

  FOR v_member IN
    SELECT user_id FROM chat_members
    WHERE chat_id = NEW.chat_id AND user_id <> NEW.initiator_id
  LOOP
    v_payload := jsonb_build_object(
      'user_id', v_member.user_id,
      'title', 'Incoming ' || NEW.type || ' call',
      'body', COALESCE(v_initiator.display_name, 'Someone') || ' is calling',
      'data', jsonb_build_object('url', '/calls', 'call_id', NEW.id),
      'tag', NEW.id
    );
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := v_payload
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER calls_after_insert_push
  AFTER INSERT ON public.calls
  FOR EACH ROW EXECUTE FUNCTION notify_new_call();
Prerequisites: CREATE EXTENSION IF NOT EXISTS pg_net; and configure
app.settings.supabase_url + app.settings.service_role_key via
ALTER DATABASE postgres SET app.settings....

These go in migration 0014_push_triggers.sql.

17. SERVICE WORKER — PUSH HANDLER
The service worker generated by vite-plugin-pwa doesn't include a push
handler by default. Add one in src/sw.ts (referenced via
strategies: 'injectManifest' OR simpler: use workbox.importScripts
with a custom script).

Simplest approach: use vite-plugin-pwa's workbox option with a
custom importScripts:

ts
// src/sw-custom.ts (imported by SW via workbox importScripts)
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'SilverChat', {
      body: data.body,
      icon: data.icon ?? '/icons/icon-192.png',
      badge: data.badge ?? '/icons/icon-192.png',
      tag: data.tag,
      data: data.data,
    })
  );
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/chats';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients: any[]) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
Configure in vite.config.ts:

ts
workbox: {
  importScripts: ['/sw-custom.js'], // served from public/ or bundled
  // ...
}
Alternative (recommended for flexibility): switch to strategies: 'injectManifest' and use src/sw.ts directly. For MVP simplicity, use
the importScripts approach.

Place sw-custom.js in public/sw-custom.js (plain JS, no bundling).

18. INTEGRATION POINTS
_authenticated.tsx layout
tsx
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import { NotificationPermissionPrompt } from '@/components/NotificationPermissionPrompt';
import { useOutboxProcessor } from '@/features/pwa/hooks/useOutboxProcessor';
import { usePushSubscription } from '@/pwa/usePushSubscription';
import { useAuth } from '@/lib/auth-provider';

function AuthenticatedLayout() {
  const { user } = useAuth();
  useOutboxProcessor(user?.id ?? null);
  const { permission } = usePushSubscription(user?.id ?? null, true);

  return (
    <div className="flex flex-col h-dvh">
      <OfflineBanner />
      <Outlet />
      <NotificationPermissionPrompt />
      <UpdateAvailableBanner />
    </div>
  );
}
Logout flow
In useLogout (from #5): call clearAllUserData(userId) from
offline-db.ts before clearing session. Ensures next user on the device
doesn't see cached data.

useMessages (from #8a) — cache integration
ts
queryFn: async ({ pageParam }) => {
  try {
    const { data } = await supabase.from('messages')...;
    if (!pageParam) await cacheMessages(userId, chatId, data);
    return data;
  } catch (err) {
    if (!navigator.onLine && !pageParam) {
      const cached = await readCachedMessages(userId, chatId);
      if (cached) return cached;
    }
    throw err;
  }
},
useChats (from #7) — cache integration
Same pattern with cacheChats / readCachedChats.

19. WHAT NOT TO INCLUDE
❌ Background Sync API (Fase 2)

❌ Periodic Background Sync (Fase 2)

❌ Offline media upload queue (only text in outbox)

❌ Offline call initiation (calls require online)

❌ Service worker custom routing for /api/* (proxy is Netlify Functions)

❌ Rich push notification actions (Fase 2)

❌ Push notification grouping beyond tag-based replacement

❌ Silent push / data-only push (Fase 2)

❌ iOS-specific push prompt flow beyond the "install first" warning

❌ In-app notification permission re-prompt after dismissal (only via settings)

20. HOW TO RESPOND
Respond in this exact order:

One-paragraph confirmation listing: 6 components, 7 PWA hooks, 4 libs,
migration 0014 (2 push triggers + pg_net extension), Edge Function
send-push, static manifest, custom SW push handler.

Complete migration file supabase/migrations/0014_push_triggers.sql.

Complete Edge Function supabase/functions/send-push/index.ts.

Complete file tree of new/modified files.

Complete content of every file:

vite.config.ts (modified)

public/manifest.webmanifest

public/sw-custom.js

All 7 PWA hooks/libs

6 components

Modified _authenticated.tsx, main.tsx, useMessages, useChats, useLogout, AppHeader

Environment variables checklist:

VITE_VAPID_PUBLIC_KEY (build-time)

Supabase secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

ALTER DATABASE postgres SET app.settings.supabase_url and
app.settings.service_role_key

Setup commands:

bash
# Generate VAPID keys
npx web-push generate-vapid-keys
# Output: Public Key + Private Key

# Add to .env.local (public key)
echo "VITE_VAPID_PUBLIC_KEY=..." >> .env.local

# Set Supabase secrets
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...

# Deploy Edge Function
supabase functions deploy send-push

# Enable pg_net + set settings (run in SQL editor)
CREATE EXTENSION IF NOT EXISTS pg_net;
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<project>.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = '<service_role_key>';
Verification checklist:

pnpm build && pnpm preview — SW registers, manifest is served

Lighthouse "Installable" check passes

DevTools → Application → Manifest shows all icons

Install button appears in header → click → info modal → tap "Install
now" → native prompt → accept → app opens standalone

After install → install button disappears

Offline: disconnect network → banner appears → reload page → app loads
from cache → cached chats/messages render

Send a text message offline → appears with pending state → reconnect →
auto-sends within 3s

Send 4 messages offline → all queue → reconnect → all send in order

If DB rejects → retry_count increments → after 3 failures → marked failed

New build deployed → next visit shows "New version available" → tap
Reload → SW updates

Notification permission prompt shows after login → tap Enable → browser
asks → grant → devices.push_subscription populated

Send message from another user → push notification arrives (with app
closed)

Tap push → opens the correct chat

Receive push while app is open → no system notification (client handles
in-app)

Initiate call from another user → push arrives → tap → opens /calls

Logout → IndexedDB cleared (check Application → IndexedDB → silverchat)

iOS Safari without install → install instructions banner shown in header

iOS Safari with install → everything works, push only if iOS 16.4+

A short list of pitfalls to warn the developer:

Why IndexedDB is not shared across users (compound key by user_id)

Why NetworkOnly for chat media (signed URLs expire in 5 min; caching
breaks and exposes media)

Why the SW is disabled in dev (devOptions.enabled: false) — SW in
dev = cache hell

Why clearAllUserData runs on logout (privacy — no data leak between
accounts on the same device)

Why the outbox processes only on online transition (no background
sync in MVP — matches P9)

Why pg_net triggers are used instead of Database Webhooks (need JOIN
with chat_members to fan out to all recipients)

Why app.settings.service_role_key is set at the DB level (triggers
can't read env vars; this is the only way to authorize the Edge
Function call)

Why VAPID public key is prefixed VITE_ (must be exposed to browser
for subscribe())

Why VAPID private key is a Supabase secret (never sent to client)

Why Notification.requestPermission() must follow a user gesture
(browsers block permission prompts from load)

Why iOS Safari requires install before push (iOS 16.4+ policy; can't be
bypassed)

Why the notification tag uses chat_id (prevents notification spam
from one chat — new replaces old)

Why importScripts is preferred over strategies: 'injectManifest'
for MVP (no custom SW build step; simpler)

Why push may fail silently on iOS 16.3 and below (support matrix —
document in-app)

Do not implement Fase 2 features. Do not implement Background Sync. This
completes the PWA, offline, and push infrastructure.
```
