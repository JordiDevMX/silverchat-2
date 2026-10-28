import { create } from "zustand";
// Circuit-breaker flag: set when Supabase answers 5xx, cleared by the
// connection banner's recovery probe. While set, focus-driven refetches are
// paused and the app shell shows an outage notice.
export const useSupabaseHealth = create<{
  down: boolean;
  since: number | null;
  markDown: () => void;
  markHealthy: () => void;
}>((set) => ({
  down: false,
  since: null,
  markDown: () => set((s) => (s.down ? s : { down: true, since: Date.now() })),
  markHealthy: () => set({ down: false, since: null }),
}));
// Storage and auth errors expose a numeric HTTP status; PostgREST error bodies
// do not and must be recognised by their SQLSTATE/PGRST code (5xxxx class =
// server/connection failures such as 53300 too-many-connections).
export function isServerError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (typeof status === "number") return status >= 500;
  if (typeof code !== "string") return false;
  return /^5\d{4}$/.test(code) || /^PGRST5/.test(code) || code === "XX000" || code === "08006";
}
