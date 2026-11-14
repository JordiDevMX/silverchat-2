import { Button } from "@/components/ui/button";
import { AuthFrame, InlineError } from "@/features/auth/components";
import { useOnboardingWelcome } from "@/features/auth/hooks/useOnboardingWelcome";
import { useAuthText } from "@/features/auth/i18n";
export function WelcomePage() {
  const { auth, theme, language, setLanguage, busy, error, finish } = useOnboardingWelcome();
  const t = useAuthText();
  const name = auth.profile?.display_name ?? "friend";
  return (
    <AuthFrame
      title={t(`Welcome to SilverChat, ${name}!`, `¡Bienvenido a SilverChat, ${name}!`)}
      subtitle={t(
        "Make this space feel like yours. You can change these later.",
        "Haz que este espacio sea tuyo. Puedes cambiarlo más tarde.",
      )}
    >
      <div className="preference-row">
        <span>{t("Profile photo")}</span>
        <span className="quiet-note">{t("You can add one later.")}</span>
      </div>
      <label htmlFor="theme">{t("Appearance")}</label>
      <select
        id="theme"
        value={theme.theme}
        onChange={(event) => theme.setTheme(event.target.value as typeof theme.theme)}
      >
        <option value="system">{t("System")}</option>
        <option value="light">{t("Light")}</option>
        <option value="dark">{t("Dark")}</option>
      </select>
      <fieldset className="accent-options">
        <legend>{t("Accent color")}</legend>
        {(["blue", "purple", "red", "orange", "yellow", "green"] as const).map((accent) => (
          <Button
            variant={theme.accent === accent ? "default" : "outline"}
            className={`accent-choice accent-${accent}`}
            key={accent}
            type="button"
            aria-pressed={theme.accent === accent}
            onClick={() => theme.setAccent(accent)}
          >
            {t(accent)}
          </Button>
        ))}
      </fieldset>
      <label htmlFor="language">{t("Language preference")}</label>
      <select
        id="language"
        value={language}
        onChange={(event) => setLanguage(event.target.value as typeof language)}
      >
        <option value="en">{t("English")}</option>
        <option value="es">Español</option>
      </select>
      <div className="preference-row">
        <div>
          <strong>{t("Add another layer of security")}</strong>
          <p className="quiet-note">{t("Enable two-factor authentication in settings.")}</p>
        </div>
        <a href="/settings/security">{t("Security settings")}</a>
      </div>
      <InlineError>{t(error)}</InlineError>
      <Button type="button" disabled={busy} onClick={() => finish()}>
        {busy ? t("Saving…") : t("Get started")}
      </Button>
      <Button variant="ghost" type="button" disabled={busy} onClick={() => finish(true)}>
        {t("Skip for now")}
      </Button>
    </AuthFrame>
  );
}
