import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { LogoutConfirmModal } from "@/features/settings/components/LogoutConfirmModal";
import {
  Avatar,
  NavLink,
  QueryState,
  SettingRow,
  SettingsPage,
} from "@/features/settings/components/shared";
import { useProfile } from "@/features/settings/hooks";
import { SETTINGS_NAV } from "./settings";
export function SettingsIndexPage() {
  const profile = useProfile();
  const [logout, setLogout] = useState(false);
  const { t } = useI18n();
  return (
    <SettingsPage title="Settings" description="Your space, your way.">
      <QueryState
        loading={profile.isLoading}
        error={profile.error}
        retry={() => void profile.refetch()}
      />
      {profile.data && (
        <div className="profile-card">
          <Avatar profile={profile.data} size="large" />
          <div>
            <h2>{profile.data.display_name}</h2>
            <p>@{profile.data.username}</p>
            <NavLink className="button secondary" href="/settings/profile">
              {t("Edit profile")}
            </NavLink>
          </div>
        </div>
      )}
      <div className="settings-card">
        {SETTINGS_NAV.map(({ path, label, icon: Icon }) => (
          <SettingRow
            key={path}
            href={`/settings/${path}`}
            label={label}
            icon={<Icon size={20} />}
          />
        ))}
      </div>
      <button
        className="button danger settings-logout"
        type="button"
        onClick={() => setLogout(true)}
      >
        {t("Log out")}
      </button>
      {logout && <LogoutConfirmModal onClose={() => setLogout(false)} />}
    </SettingsPage>
  );
}
