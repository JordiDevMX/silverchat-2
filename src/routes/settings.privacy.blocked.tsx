import { Button } from "@/components/ui/button";
import { SettingsPage } from "@/features/settings/components/presentation";
import { Avatar, QueryState } from "@/features/settings/components/shared";
import { useBlockedContacts } from "@/features/settings/hooks/useBlockedContacts";
export function BlockedContactsPage() {
  const { blocked, action, t, unblock } = useBlockedContacts();
  return (
    <SettingsPage title="Blocked contacts">
      <p>
        {blocked.data?.length ?? 0} {t("Blocked contacts").toLowerCase()}
      </p>
      <QueryState
        loading={blocked.isLoading}
        error={blocked.error}
        retry={() => void blocked.refetch()}
      />
      <div className="settings-card">
        {blocked.data?.map((profile) => (
          <div className="contact-row" key={profile.id}>
            <Avatar profile={profile} size="small" />
            <span>
              <strong>{profile.display_name}</strong>
              <small>@{profile.username}</small>
            </span>
            <Button
              variant="outline"
              type="button"
              disabled={action.busy}
              onClick={() => void unblock(profile.id)}
            >
              {t("Unblock")}
            </Button>
          </div>
        ))}
      </div>
      {blocked.data?.length === 0 && (
        <p className="settings-empty">{t("You haven’t blocked anyone.")}</p>
      )}
      {action.feedback}
    </SettingsPage>
  );
}
