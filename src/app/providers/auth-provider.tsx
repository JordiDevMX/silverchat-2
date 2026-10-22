import type { PropsWithChildren } from "react";

// Stub — Supabase Auth wiring (magic link, 2FA, BFF session) lands in Prompt #5.
export function AuthProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
