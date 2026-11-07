import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { DeleteAccountModal } from "@/features/settings/components/DeleteAccountModal";
import { SettingsPage } from "@/features/settings/components/presentation";
import { SettingRow } from "@/features/settings/components/shared";
import { useAccountActions, useEmailChange } from "@/features/settings/hooks/useAccountActions";
export function AccountPage() {
  const { auth, profile, action, t, language, cancelDeletion, switchAccount } = useAccountActions();
  const [emailModal, setEmailModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [switchModal, setSwitchModal] = useState(false);

  const date = profile.data?.scheduled_deletion_at;
  return (
    <SettingsPage title="Account">
      <div className="settings-card settings-card-body">
        <h2>{t("Email")}</h2>
        <p>{auth.user?.email}</p>
        <Button variant="outline" type="button" onClick={() => setEmailModal(true)}>
          {t("Change email")}
        </Button>
      </div>
      <div className="settings-card">
        <SettingRow href="/settings/security" label="Two-factor authentication" />
      </div>
      <Button variant="outline" type="button" onClick={() => setSwitchModal(true)}>
        {t("Add another account")}
      </Button>
      <div className="settings-card settings-card-body danger-zone">
        <h2>{t("Delete account")}</h2>
        {date ? (
          <>
            <p>
              {language === "es" ? "Eliminación programada para" : "Deletion scheduled for"}{" "}
              {new Date(date).toLocaleDateString(language)}
            </p>
            <Button
              variant="outline"
              type="button"
              disabled={action.busy || new Date(date).getTime() <= Date.now()}
              onClick={() => void cancelDeletion()}
            >
              {t("Cancel deletion")}
            </Button>
          </>
        ) : (
          <Button variant="destructive" type="button" onClick={() => setDeleteModal(true)}>
            {t("Delete account")}
          </Button>
        )}
      </div>
      {action.feedback}
      {emailModal && <EmailModal onClose={() => setEmailModal(false)} />}{" "}
      {deleteModal && <DeleteAccountModal onClose={() => setDeleteModal(false)} />}{" "}
      {switchModal && (
        <SettingsDialog
          title={t("Add another account")}
          onClose={() => setSwitchModal(false)}
          canClose={!action.busy}
        >
          {(close) => (
            <>
              <p>
                {language === "es"
                  ? "Se cerrará tu sesión actual para iniciar sesión con otra cuenta."
                  : "You’ll sign out of this account before signing in to another."}
              </p>
              {action.feedback}
              <div className="modal-actions">
                <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
                  {t("Cancel")}
                </Button>
                <Button type="button" disabled={action.busy} onClick={() => void switchAccount()}>
                  {t("Log out")}
                </Button>
              </div>
            </>
          )}
        </SettingsDialog>
      )}
    </SettingsPage>
  );
}
function EmailModal({ onClose }: { onClose: () => void }) {
  const { email, setEmail, sent, action, t, language, submit } = useEmailChange();
  return (
    <SettingsDialog title={t("Change email")} onClose={onClose} canClose={!action.busy}>
      {(close) => (
        <>
          {sent ? (
            <p role="status">
              {language === "es"
                ? `Confirmación enviada a ${email}. Haz clic en el enlace para completar el cambio.`
                : `Confirmation sent to ${email}. Click the link to complete the change.`}
            </p>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="new-email">{t("New email")}</label>
              <input
                id="new-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {action.feedback}
              <Button type="submit" disabled={action.busy}>
                {t("Confirm")}
              </Button>
            </form>
          )}
          <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
            {t("Back")}
          </Button>
        </>
      )}
    </SettingsDialog>
  );
}
