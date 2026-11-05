import { Outlet, useLocation } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  CircleHelp,
  HardDrive,
  Laptop,
  LockKeyhole,
  Palette,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useI18n } from "@/app/providers/i18n-provider";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { SettingsRowContent, settingsRowClassName } from "@/components/ui/settings-row";
import { SettingsShellSurface } from "@/components/ui/settings-surfaces";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useProfile } from "@/features/settings/hooks";
import { usePreferences } from "@/features/settings/preferences-provider";
import "@/styles/settings.css";
export const SETTINGS_NAV = [
  { path: "account", label: "Account", icon: UserRound },
  { path: "devices", label: "Devices", icon: Laptop },
  { path: "storage", label: "Storage", icon: HardDrive },
  { path: "privacy", label: "Privacy", icon: LockKeyhole },
  { path: "appearance", label: "Appearance", icon: Palette },
  { path: "notifications", label: "Notifications", icon: Bell },
  { path: "security", label: "Security", icon: ShieldCheck },
  { path: "about", label: "About", icon: CircleHelp },
];
export function SettingsLayout() {
  const { t } = useI18n();
  const location = useLocation();
  const profile = useProfile();
  const preferences = usePreferences();
  const back =
    location.pathname === "/settings"
      ? "/chats"
      : location.pathname.includes("/privacy/")
        ? "/settings/privacy"
        : location.pathname.endsWith("/social")
          ? "/settings/profile"
          : "/settings";
  return (
    <SettingsShellSurface
      header={
        <>
          <NavLink href="/chats" className="settings-brand">
            <BrandLockup />
          </NavLink>
          <NavLink
            href={profile.data ? `/profile/${profile.data.username}` : "/settings"}
            className="settings-top-profile"
          >
            {profile.data && <Avatar profile={profile.data} size="small" />}
            <span>{profile.data?.display_name}</span>
          </NavLink>
        </>
      }
      sidebar={
        <>
          <NavLink href="/settings" className="settings-sidebar-title">
            <Settings2 size={20} />
            {t("Settings")}
          </NavLink>
          <nav aria-label={t("Settings")}>
            {SETTINGS_NAV.map(({ path, label, icon: Icon }) => (
              <div key={path} data-active={location.pathname.startsWith(`/settings/${path}`)}>
                <NavLink
                  href={`/settings/${path}`}
                  className={`setting-row ${settingsRowClassName}`}
                  aria-current={
                    location.pathname.startsWith(`/settings/${path}`) ? "page" : undefined
                  }
                >
                  <SettingsRowContent label={t(label)} icon={<Icon size={19} />} />
                </NavLink>
              </div>
            ))}
          </nav>
          <p className="sidebar-foot">SilverChat · {import.meta.env.VITE_APP_VERSION}</p>
        </>
      }
    >
      <main id="main">
        <NavLink href={back} className="settings-back">
          <ArrowLeft size={17} />
          {t("Back")}
        </NavLink>
        {preferences.error && (
          <div className="settings-error" role="alert">
            {preferences.error}
            <button type="button" onClick={preferences.retry}>
              {t("Try again")}
            </button>
          </div>
        )}
        <Outlet />
      </main>
    </SettingsShellSurface>
  );
}
