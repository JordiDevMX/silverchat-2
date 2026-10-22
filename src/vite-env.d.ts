/// <reference types="vite/client" />

// Browser-safe env vars only (real values in .env.local, gitignored).
// VITE_SUPABASE_ANON_KEY is safe to expose only because RLS is enabled (Prompt #4).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
