import { Button } from "@/components/ui/button";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { useOnboardingWelcome } from "@/features/auth/hooks/useOnboardingWelcome";
export function WelcomePage() {
  const { auth, theme, language, setLanguage, busy, error, finish } = useOnboardingWelcome();
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
          <Button
            variant={theme.accent === accent ? "default" : "outline"}
            className={`accent-choice accent-${accent}`}
            key={accent}
            type="button"
            aria-pressed={theme.accent === accent}
            onClick={() => theme.setAccent(accent)}
          >
            {accent}
          </Button>
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
      <Button type="button" disabled={busy} onClick={() => finish()}>
        {busy ? "Saving…" : "Get started"}
      </Button>
      <Button variant="ghost" type="button" disabled={busy} onClick={() => finish(true)}>
        Skip for now
      </Button>
    </AuthFrame>
  );
}
