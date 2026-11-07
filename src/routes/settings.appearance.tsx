import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useTheme } from "@/app/providers/theme-provider";
import { AccentChoice, SETTINGS_ACCENTS, ThemeChoice } from "@/components/ui/settings-surfaces";
import { SettingsPage } from "@/features/settings/components/presentation";
import { QueryState, useAction } from "@/features/settings/components/shared";
import { usePreferences } from "@/features/settings/preferences-provider";

export function AppearancePage() {
  const theme = useTheme();
  const { t, language } = useI18n();
  const preferences = usePreferences();
  const action = useAction();
  return (
    <SettingsPage title="Appearance" description="Make yourself at home.">
      <QueryState loading={preferences.loading} error={null} />
      <fieldset disabled={!preferences.settings}>
        <div className="settings-card settings-card-body">
          <h2>{t("Theme")}</h2>
          <div className="theme-options">
            {(
              [
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <ThemeChoice
                key={value}
                value={value}
                label={t(label)}
                icon={<Icon size={17} />}
                selected={theme.theme === value}
                onSelect={() => void action.run(() => preferences.save({ theme: value }, true))}
              />
            ))}
          </div>
        </div>
        <div className="settings-card settings-card-body">
          <h2>{t("Accent color")}</h2>
          <div className="accent-options">
            {SETTINGS_ACCENTS.map((value) => (
              <AccentChoice
                key={value}
                value={value}
                label={t(value)}
                selected={theme.accent === value}
                onSelect={() => void action.run(() => preferences.save({ accent: value }, true))}
              />
            ))}
          </div>
        </div>
        <div className="settings-card settings-card-body">
          <label htmlFor="language">{t("Language")}</label>
          <select
            id="language"
            value={language}
            onChange={(e) =>
              void action.run(() =>
                preferences.save({ language: e.target.value as "en" | "es" }, true),
              )
            }
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </fieldset>
      <p className="quiet-note">{t("These preferences follow you across devices.")}</p>
      {action.feedback}
    </SettingsPage>
  );
}
