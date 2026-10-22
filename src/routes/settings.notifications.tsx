import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { QueryState, SettingsPage, Toggle, useAction } from "@/features/settings/components/shared";
import { inAppNotification, playNotificationSound } from "@/features/settings/notifications";
import { usePreferences } from "@/features/settings/preferences-provider";
export function NotificationsPage() {
  const { settings, loading, save } = usePreferences();
  const action = useAction();
  const [preview, setPreview] = useState("");
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
          <button
            className="button secondary"
            type="button"
            disabled={!settings.notifications_enabled}
            onClick={() => {
              const result = inAppNotification(
                settings,
                t("This is how your message previews look."),
                t("New message"),
              );
              if (result) {
                setPreview(result.text);
                if (result.sound) void playNotificationSound().catch(() => undefined);
              }
            }}
          >
            {t("Preview notification")}
          </button>
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
