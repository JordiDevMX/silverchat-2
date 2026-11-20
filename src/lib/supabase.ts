import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAccessToken, refreshAccessToken } from "./auth";
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init = {}) => {
        const request = new Request(input, init);
        const headers = new Headers(request.headers);
        const token = getAccessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
        const retry = request.clone();
        const response = await fetch(new Request(request, { headers }));
        if (
          response.status === 401 &&
          token &&
          !new URL(request.url).pathname.startsWith("/auth/v1/")
        ) {
          const next = await refreshAccessToken();
          if (next) {
            headers.set("Authorization", `Bearer ${next}`);
            return fetch(new Request(retry, { headers }));
          }
        }
        return response;
      },
    },
  },
);

// Realtime re-reads its token after every successful subscribe and on each
// heartbeat. Without a callback it falls back to the anon key (this app never
// uses a GoTrue session), so channels created after the first join would lose
// the user's role and filtered joins would be rejected with
// "invalid column for filter <col>". Set the callback on the Realtime client
// directly: supabase-js's `accessToken` option would replace supabase.auth
// with a throwing proxy, and auth-provider still uses supabase.auth.getUser.
supabase.realtime.accessToken = async () => getAccessToken();
