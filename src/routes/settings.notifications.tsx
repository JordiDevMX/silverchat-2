import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { SettingsPage, Toggle } from "@/features/settings/components/presentation";
import { QueryState, useAction } from "@/features/settings/components/shared";
import { useNotificationPreview } from "@/features/settings/hooks/useNotificationPreview";
import { usePreferences } from "@/features/settings/preferences-provider";
export function NotificationsPage() {
  const { settings, loading, save } = usePreferences();
  const action = useAction();
  const { preview, setPreview, showPreview } = useNotificationPreview();
  const { t } = useI18n();
  return (
    <SettingsPage title="Notifications">
      <QueryState loading={loading} error={null} />
      {settings && (
        <>
          <div className="settings-card settings-card-body">
            <Toggle
              label="Notifications"
              checked={settings.notifications_enabled}
              disabled={action.busy}
              onChange={(v) => {
                setPreview("");
                void action.run(() => save({ notifications_enabled: v }));
              }}
            />
            <Toggle
              label="Sound"
              checked={settings.notification_sound_enabled}
              disabled={action.busy || !settings.notifications_enabled}
              onChange={(v) => void action.run(() => save({ notification_sound_enabled: v }))}
            />
            <Toggle
              label="Message previews"
              checked={settings.notification_previews_enabled}
              disabled={action.busy || !settings.notifications_enabled}
              onChange={(v) => {
                setPreview("");
                void action.run(() => save({ notification_previews_enabled: v }));
              }}
            />
          </div>
          <p className="quiet-note">
            {t(
              "Push notifications require installing the app. In-browser notifications are shown while the app is open in a tab.",
            )}{" "}
            {t("Web push is coming in a later release.")}
          </p>
          <Button
            variant="outline"
            type="button"
            disabled={!settings.notifications_enabled}
            onClick={() => showPreview(settings)}
          >
            {t("Preview notification")}
          </Button>
          {preview && (
            <p className="settings-notice" role="status">
              {preview}
            </p>
          )}
        </>
      )}
      {action.feedback}
    </SettingsPage>
  );
}
