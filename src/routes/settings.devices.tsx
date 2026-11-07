import { Laptop } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { SettingsPage } from "@/features/settings/components/presentation";
import { QueryState } from "@/features/settings/components/shared";
import { useDeviceList } from "@/features/settings/hooks";
import { useOtherDevicesConfirmation } from "@/features/settings/hooks/useSettingsDialogActions";
import { getOrCreateDeviceFingerprint } from "@/lib/devices";

function relativeTime(value: string, language: string) {
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const unit = Math.abs(minutes) < 60 ? "minute" : Math.abs(minutes) < 1440 ? "hour" : "day";
  return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
    Math.round(minutes / (unit === "minute" ? 1 : unit === "hour" ? 60 : 1440)),
    unit,
  );
}
export function DevicesPage() {
  const devices = useDeviceList();
  const [confirm, setConfirm] = useState(false);
  const action = useOtherDevicesConfirmation(() => setConfirm(false));
  const { t, language } = useI18n();
  const fingerprint = getOrCreateDeviceFingerprint();
  return (
    <SettingsPage title="Devices">
      <Button variant="outline" type="button" onClick={() => setConfirm(true)}>
        {t("Sign out all other devices")}
      </Button>
      <QueryState
        loading={devices.isLoading}
        error={devices.error}
        retry={() => void devices.refetch()}
      />
      <div className="settings-card">
        {devices.data?.map((device) => (
          <div className="device-row" key={device.id}>
            <Laptop size={24} />
            <div>
              <strong>{device.device_name}</strong>
              <small>
                {language === "es" ? "Última actividad" : "Last active"}{" "}
                {relativeTime(device.last_active_at, language)}
              </small>
            </div>
            {fingerprint && device.device_fingerprint === fingerprint && (
              <span className="settings-badge">{t("This device")}</span>
            )}
          </div>
        ))}
      </div>
      {devices.data?.length === 0 && <p>{t("No devices recorded yet.")}</p>}
      {action.feedback}
      {confirm && (
        <SettingsDialog
          title={t("Sign out all other devices")}
          onClose={() => setConfirm(false)}
          canClose={!action.busy}
        >
          {(close) => (
            <>
              <p>{t("Your current session will stay signed in.")}</p>
              {action.feedback}
              <div className="modal-actions">
                <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
                  {t("Cancel")}
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  disabled={action.busy}
                  onClick={() => void action.confirm()}
                >
                  {t("Confirm")}
                </Button>
              </div>
            </>
          )}
        </SettingsDialog>
      )}
    </SettingsPage>
  );
}
