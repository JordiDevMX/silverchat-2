import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export interface SessionPayload {
  accessToken: string;
  expiresAt: number;
  user: { id: string; email?: string };
  aal: "aal1" | "aal2";
  mfaRequired: boolean;
  mfaChallengeId: string | null;
  factorId: string | null;
  enrollment?: { id: string; totp: { qr_code: string; secret: string; uri: string } };
}
export interface RefreshBody {
  totp_code?: string;
  factor_id?: string;
  action?: "refresh" | "enroll" | "disable" | "replace_backups" | "change_email";
  email?: string;
  backup_hashes?: string[];
}
export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaChallengeId: string | null;
  factorId: string | null;
  sessionExpired: boolean;
  signIn: (
    email: string,
    mode: "login" | "signup" | "resend",
    redirect: string,
    turnstileToken?: string,
  ) => Promise<void>;
  signOut: (all?: boolean) => Promise<void>;
  completeMfa: (code: string) => Promise<void>;
  completeMfaWithBackupCode: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}
