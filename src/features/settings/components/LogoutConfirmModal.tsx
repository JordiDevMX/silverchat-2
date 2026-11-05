import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { useLogoutConfirmation } from "../hooks/useSettingsDialogActions";
export function LogoutConfirmModal({ onClose }: { onClose: () => void }) {
  const [all, setAll] = useState(false);
  const action = useLogoutConfirmation();
  const { t } = useI18n();
  return (
    <SettingsDialog title={t("Log out of SilverChat?")} onClose={onClose} canClose={!action.busy}>
      {(close) => (
        <>
          <p>{t("You’ll need to sign in again with a magic link.")}</p>
          <label className="check-row">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            {t("Also sign out of all other devices")}
          </label>
          {action.feedback}
          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={action.busy}
              onClick={() => void action.confirm(all)}
            >
              {t("Log out")}
            </Button>
          </div>
        </>
      )}
    </SettingsDialog>
  );
}
