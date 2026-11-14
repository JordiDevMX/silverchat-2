import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers/theme-provider";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
import { detectDeviceLanguage, type Language } from "@/lib/language";
import { supabase } from "@/lib/supabase";
export function useOnboardingWelcome() {
  const auth = useAuth();
  const router = useRouter();
  const theme = useTheme();
  // A new account starts with the language of the device; the account stores it on finish.
  const [language, setLanguage] = useState<Language>(() => detectDeviceLanguage());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = auth.user?.id;
  const setTheme = theme.setTheme;
  const setAccent = theme.setAccent;
  useEffect(() => {
    if (id)
      void supabase
        .from("user_settings")
        .select("theme,accent,language")
        .eq("user_id", id)
        .single()
        .then(({ data }) => {
          if (data) {
            setTheme(data.theme);
            setAccent(data.accent);
          }
        });
  }, [id, setTheme, setAccent]);
  const finish = async (skip = false) => {
    setBusy(true);
    setError("");
    try {
      if (!skip && id) {
        const result = await supabase
          .from("user_settings")
          .update({ theme: theme.theme, accent: theme.accent, language })
          .eq("user_id", id);
        if (result.error) throw result.error;
      }
      await router.navigate({ href: safeRedirect(searchParams().get("redirect")), replace: true });
    } catch {
      setError("We couldn’t save your preferences. Try again or skip for now.");
    } finally {
      setBusy(false);
    }
  };
  return { auth, theme, language, setLanguage, busy, error, finish };
}
