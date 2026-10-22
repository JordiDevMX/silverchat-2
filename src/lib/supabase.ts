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
