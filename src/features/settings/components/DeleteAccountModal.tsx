import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { useAccountDeletion } from "../hooks/useAccountActions";
export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { confirmation, setConfirmation, action, t, scheduleDeletion } =
    useAccountDeletion(onClose);
  return (
    <SettingsDialog title={t("Delete your account?")} onClose={onClose} canClose={!action.busy}>
      {(close) => (
        <>
          <p>
            {t(
              "Your account will be permanently deleted after a 30-day grace period. During this time, you can cancel this from any device.",
            )}
          </p>
          <p>
            {t(
              "Your messages will remain visible to other users in your conversations but attributed to “Deleted User”. Your profile, avatar, and personal data will be removed.",
            )}
          </p>
          <label htmlFor="delete-confirm">{t("Type DELETE to confirm")}</label>
          <input
            id="delete-confirm"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {action.feedback}
          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={action.busy || confirmation !== "DELETE"}
              onClick={() => void scheduleDeletion()}
            >
              {t("Schedule deletion")}
            </Button>
          </div>
        </>
      )}
    </SettingsDialog>
  );
}
