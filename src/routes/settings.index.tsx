import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { LogoutConfirmModal } from "@/features/settings/components/LogoutConfirmModal";
import { SettingsPage } from "@/features/settings/components/presentation";
import { Avatar, NavLink, QueryState, SettingRow } from "@/features/settings/components/shared";
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
            <Button asChild variant="outline">
              <NavLink href="/settings/profile">{t("Edit profile")}</NavLink>
            </Button>
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
      <Button
        variant="destructive"
        className="settings-logout"
        type="button"
        onClick={() => setLogout(true)}
      >
        {t("Log out")}
      </Button>
      {logout && <LogoutConfirmModal onClose={() => setLogout(false)} />}
    </SettingsPage>
  );
}
