import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-provider";
export function useDestinationActions() {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const signOut = async () => {
    setBusy(true);
    try {
      await auth.signOut();
      await router.navigate({ to: "/", replace: true });
    } catch {
      setError(
        "Signed out here, but server revocation could not be confirmed. Try signing in and out again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { auth, busy, error, signOut };
}
