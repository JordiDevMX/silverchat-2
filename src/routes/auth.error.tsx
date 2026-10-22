import { CircleAlert } from "lucide-react";
import { AuthFrame } from "@/features/auth/components";
import { searchParams } from "@/features/auth/navigation";

const messages: Record<string, string> = {
  missing_token: "This link is invalid.",
  invalid_token: "This link is invalid.",
  expired_token: "This link has expired.",
  rate_limited: "Too many attempts. Try again in a few minutes.",
  unknown: "Something went wrong.",
};
export function AuthErrorPage() {
  const code = searchParams().get("code") ?? "unknown";
  return (
    <AuthFrame title={messages[code] ?? messages.unknown ?? "Something went wrong."}>
      <CircleAlert className="feature-icon" size={40} strokeWidth={1.75} aria-hidden="true" />
      <p>Request a new magic link to continue.</p>
      <a className="button primary" href="/auth/login">
        Request a new link
      </a>
      {["rate_limited", "unknown"].includes(code) && (
        <button className="button secondary" type="button" onClick={() => window.history.back()}>
          Go back
        </button>
      )}
    </AuthFrame>
  );
}
