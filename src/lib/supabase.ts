import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Prompt #2 §11 — minimal typed client. Do NOT add auth helpers here yet (Prompt #5).
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
