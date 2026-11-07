import { useEffect, useState } from "react";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
export function useCheckEmail() {
  const auth = useAuth();
  const params = searchParams();
  const email = params.get("email") ?? "";
  const [remaining, setRemaining] = useState(60);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const interval = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(interval);
  }, []);
  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await auth.signIn(email, "resend", safeRedirect(params.get("redirect")));
      setRemaining(60);
      setMessage("Email sent again. Check your inbox.");
    } catch {
      setError("We couldn’t send a link. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return { params, email, remaining, busy, message, error, resend };
}
