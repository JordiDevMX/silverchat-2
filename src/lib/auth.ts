import type { RefreshBody, SessionPayload } from "@/features/auth/types";

let accessToken: string | null = null;
let snapshot: SessionPayload | null = null;
let refreshPromise: Promise<SessionPayload> | null = null;
let epoch = 0;
let tail: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export const SESSION_EXPIRED = "silverchat:session-expired";
// Remove URL credentials before React mounts or any external resources are requested.
if (typeof window !== "undefined" && window.location.pathname === "/auth/post-login") {
  const url = new URL(window.location.href);
  accessToken = url.searchParams.get("at");
  url.searchParams.delete("at");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
export function getAccessToken() {
  return accessToken;
}
export function getSessionSnapshot() {
  return snapshot;
}
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function setAccessToken(token: string | null) {
  accessToken = token;
  if (!token) {
    epoch++;
    snapshot = null;
    for (const listener of listeners) listener();
  }
}
export class AuthError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export async function authApi<T>(operation: string, body: unknown = {}): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(`/api/auth/${operation}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new AuthError(data.error ?? "request_failed", res.status);
  return data as T;
}
async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  // Serialize cookie mutations within a tab; Web Locks also coordinate other tabs.
  const task = tail
    .catch(() => undefined)
    .then(() =>
      navigator.locks ? navigator.locks.request("silverchat:refresh", action) : action(),
    );
  tail = task.catch(() => undefined);
  return task;
}
export function refreshSession(body: RefreshBody = {}): Promise<SessionPayload> {
  const normal = Object.keys(body).length === 0;
  if (normal && refreshPromise) return refreshPromise;
  const version = epoch;
  const task = withSessionLock(async () => {
    try {
      const data = await authApi<SessionPayload>("refresh", body);
      if (!data.accessToken || !data.user?.id || !data.expiresAt)
        throw new Error("Invalid session response");
      if (version !== epoch) throw new Error("Session changed");
      accessToken = data.accessToken;
      snapshot = data;
      for (const listener of listeners) listener();
      return data;
    } catch (error) {
      if (error instanceof AuthError && error.status === 401 && error.code !== "invalid_totp") {
        const wasAuthenticated = !!snapshot;
        setAccessToken(null);
        if (wasAuthenticated) window.dispatchEvent(new Event(SESSION_EXPIRED));
      }
      throw error;
    }
  });
  if (normal) {
    refreshPromise = task;
    void task
      .finally(() => {
        refreshPromise = null;
      })
      .catch(() => undefined);
  }
  return task;
}
export async function refreshAccessToken(): Promise<string | null> {
  try {
    return (await refreshSession()).accessToken;
  } catch {
    return null;
  }
}
export async function logoutSession(all = false) {
  await withSessionLock(async () => {
    try {
      await authApi(all ? "logout-all" : "logout", { scope: all ? "global" : "local" });
    } finally {
      setAccessToken(null);
    }
  });
}
