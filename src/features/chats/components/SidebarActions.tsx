import { Monitor, Moon, Settings, Sun } from "lucide-react";
import { useI18n } from "@/app/providers/i18n-provider";
import { useTheme } from "@/app/providers/theme-provider";
import { NavLink } from "@/features/settings/components/shared";
import { usePreferences } from "@/features/settings/preferences-provider";

import { InstallPwaButton } from "./InstallPwaButton";

const nextTheme = { light: "dark", dark: "system", system: "light" } as const;
const themeIcon = { light: Sun, dark: Moon, system: Monitor };
const label = { light: "Light", dark: "Dark", system: "System" } as const;
export function SidebarActions() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const preferences = usePreferences();
  const ThemeIcon = themeIcon[theme];
  const next = nextTheme[theme];
  const themeLabel = `${t("Theme")} · ${t(label[theme])} → ${t(label[next])}`;
  return (
    <div className="sidebar-actions">
      <button
        type="button"
        aria-label={themeLabel}
        title={themeLabel}
        disabled={!preferences.settings}
        onClick={() => void preferences.save({ theme: next }, true)}
      >
        <ThemeIcon size={20} aria-hidden="true" />
      </button>
      <NavLink href="/settings">
        <Settings size={20} aria-hidden="true" />
        <span className="sr-only">{t("Settings")}</span>
      </NavLink>
      <InstallPwaButton />
    </div>
  );
}
