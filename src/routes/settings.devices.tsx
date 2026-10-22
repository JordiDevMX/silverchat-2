import { Laptop } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { QueryState, SettingsPage, useAction } from "@/features/settings/components/shared";
import { useDeviceList } from "@/features/settings/hooks";
import { signOutOtherDevices } from "@/lib/auth";
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
  const action = useAction();
  const { t, language } = useI18n();
  const fingerprint = getOrCreateDeviceFingerprint();
  return (
    <SettingsPage title="Devices">
      <button className="button secondary" type="button" onClick={() => setConfirm(true)}>
        {t("Sign out all other devices")}
      </button>
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
        <Modal
          title={t("Sign out all other devices")}
          onClose={action.busy ? undefined : () => setConfirm(false)}
        >
          <p>{t("Your current session will stay signed in.")}</p>
          {action.feedback}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={action.busy}
              onClick={() => setConfirm(false)}
            >
              {t("Cancel")}
            </button>
            <button
              className="button danger"
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await signOutOtherDevices();
                  setConfirm(false);
                }, "Other devices signed out")
              }
            >
              {t("Confirm")}
            </button>
          </div>
        </Modal>
      )}
    </SettingsPage>
  );
}
