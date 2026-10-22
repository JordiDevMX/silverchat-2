import { createServerClient } from "@supabase/ssr";
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "../../../src/types/database.ts";
import { buildSetCookie, parseCookies } from "./cookies.ts";

export function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
// Never share an auth-bearing SDK client between serverless requests.
export function anonClient() {
  return createClient<Database>(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export function adminClient() {
  return createClient<Database>(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
// SSR handles PKCE. Only verifier cookies are persisted by its storage adapter;
// sessions are explicitly split into the refresh cookie and memory-only access JWT.
export function pkceClient(req: Request, headers: Headers) {
  return createServerClient<Database>(required("SUPABASE_URL"), required("SUPABASE_ANON_KEY"), {
    cookieOptions: { name: "sb-pkce", httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () =>
        Object.entries(parseCookies(req.headers.get("cookie")))
          .filter(([name]) => name.startsWith("sb-pkce-code-verifier"))
          .map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          if (name.startsWith("sb-pkce-code-verifier")) {
            headers.append(
              "Set-Cookie",
              buildSetCookie(name, value, options.maxAge === 0 ? 0 : 600),
            );
          }
        }
      },
    },
  });
}
export async function authenticated(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await anonClient().auth.getUser(token);
  return error || !data.user ? null : { token, user: data.user };
}
export function assurance(token: string): string | null {
  // Only call after GoTrue has validated or issued this JWT.
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).aal ?? null;
  } catch {
    return null;
  }
}
export function publicSession(session: Session) {
  const factors =
    session.user.factors?.filter((f) => f.factor_type === "totp" && f.status === "verified") ?? [];
  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at,
    user: { id: session.user.id, email: session.user.email },
    mfaRequired: assurance(session.access_token) !== "aal2" && factors.length > 0,
  };
}
