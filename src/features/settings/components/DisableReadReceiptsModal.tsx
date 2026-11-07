import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { usePreferenceConfirmation } from "../hooks/useSettingsDialogActions";
export function DisableReadReceiptsModal({ onClose }: { onClose: () => void }) {
  const action = usePreferenceConfirmation(onClose);
  const { t } = useI18n();
  return (
    <SettingsDialog title={t("Turn off read receipts?")} onClose={onClose} canClose={!action.busy}>
      {(close) => (
        <>
          <p>
            {t(
              "When read receipts are off, you won’t see when others have read your messages, and they won’t see when you’ve read theirs. This applies to everyone until you turn it back on.",
            )}
          </p>
          {action.feedback}
          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
              {t("Keep enabled")}
            </Button>
            <Button
              type="button"
              disabled={action.busy}
              onClick={() => void action.confirm({ read_receipts_enabled: false })}
            >
              {t("Turn off")}
            </Button>
          </div>
        </>
      )}
    </SettingsDialog>
  );
}
