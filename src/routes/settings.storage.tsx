import { useI18n } from "@/app/providers/i18n-provider";
import { QueryState, SettingsPage } from "@/features/settings/components/shared";
import { useStorageUsage } from "@/features/settings/hooks";
export function StoragePage() {
  const usage = useStorageUsage();
  const { t, language } = useI18n();
  const mb = (bytes: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(bytes / 1048576);
  return (
    <SettingsPage title="Storage">
      <QueryState
        loading={usage.isLoading}
        error={usage.error}
        retry={() => void usage.refetch()}
      />
      {usage.data && (
        <>
          <div className="settings-card settings-card-body storage-total">
            <p>{t("Storage usage")}</p>
            <h2>
              {mb(usage.data.total)} <span>MB {t("used")}</span>
            </h2>
            <progress
              aria-label={t("Storage usage")}
              value={Math.min(usage.data.total, usage.data.softLimit)}
              max={usage.data.softLimit || 1}
            />
            <small>{t("Soft indicator only; this is not an account quota.")}</small>
          </div>
          <div className="settings-card">
            {[
              ["avatars", "Avatars"],
              ["chat-media", "Chat media"],
              ["story-media", "Stories"],
              ["channel-media", "Channel media"],
            ].map(([key, label]) => (
              <div className="storage-row" key={key}>
                <span>{t(label ?? "")}</span>
                <strong>{mb(usage.data?.buckets[key ?? ""] ?? 0)} MB</strong>
              </div>
            ))}
          </div>
          <p className="quiet-note">
            {t("Files are automatically compressed on upload. Larger limits may apply.")}
          </p>
        </>
      )}
    </SettingsPage>
  );
}
