import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/providers/theme-provider";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { safeRedirect, searchParams } from "@/features/auth/navigation";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function WelcomePage() {
  const auth = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const [language, setLanguage] = useState<"en" | "es">(() =>
    navigator.language.startsWith("es") ? "es" : "en",
  );
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
  return (
    <AuthFrame
      title={`Welcome to SilverChat, ${auth.profile?.display_name ?? "friend"}!`}
      subtitle="Make this space feel like yours. You can change these later."
    >
      <div className="preference-row">
        <span>Profile photo</span>
        <span className="quiet-note">You can add one later.</span>
      </div>
      <label htmlFor="theme">Appearance</label>
      <select
        id="theme"
        value={theme.theme}
        onChange={(event) => theme.setTheme(event.target.value as typeof theme.theme)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      <fieldset className="accent-options">
        <legend>Accent color</legend>
        {(["blue", "purple", "red", "orange", "yellow", "green"] as const).map((accent) => (
          <button
            className={`accent-choice accent-${accent}`}
            key={accent}
            type="button"
            aria-pressed={theme.accent === accent}
            onClick={() => theme.setAccent(accent)}
          >
            {accent}
          </button>
        ))}
      </fieldset>
      <label htmlFor="language">Language preference</label>
      <select
        id="language"
        value={language}
        onChange={(event) => setLanguage(event.target.value as "en" | "es")}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
      <div className="preference-row">
        <div>
          <strong>Add another layer of security</strong>
          <p className="quiet-note">Enable two-factor authentication in settings.</p>
        </div>
        <a href="/settings/security">Security settings</a>
      </div>
      <InlineError>{error}</InlineError>
      <button className="button primary" type="button" disabled={busy} onClick={() => finish()}>
        {busy ? "Saving…" : "Get started"}
      </button>
      <button className="text-link" type="button" disabled={busy} onClick={() => finish(true)}>
        Skip for now
      </button>
    </AuthFrame>
  );
}
