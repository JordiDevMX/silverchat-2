import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useTheme } from "@/app/providers/theme-provider";
import { QueryState, SettingsPage, useAction } from "@/features/settings/components/shared";
import { usePreferences } from "@/features/settings/preferences-provider";

const accents = {
  blue: "#3978f6",
  purple: "#9856e8",
  red: "#df464c",
  orange: "#e98232",
  yellow: "#c59c18",
  green: "#239a65",
} as const;
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
              <button
                className={`theme-option theme-preview-${value}`}
                type="button"
                key={value}
                aria-pressed={theme.theme === value}
                onClick={() => void action.run(() => preferences.save({ theme: value }, true))}
              >
                <span className="theme-miniature">
                  <span />
                  <span />
                  <span />
                </span>
                <span>
                  <Icon size={17} />
                  {t(label)}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="settings-card settings-card-body">
          <h2>{t("Accent color")}</h2>
          <div className="accent-options">
            {Object.entries(accents).map(([value, color]) => (
              <button
                key={value}
                className="accent-swatch"
                type="button"
                style={{ background: color }}
                aria-label={t(value)}
                aria-pressed={theme.accent === value}
                onClick={() =>
                  void action.run(() =>
                    preferences.save({ accent: value as keyof typeof accents }, true),
                  )
                }
              >
                {theme.accent === value && <Check size={21} />}
              </button>
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
