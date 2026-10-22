import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { DeleteAccountModal } from "@/features/settings/components/DeleteAccountModal";
import { SettingRow, SettingsPage, useAction } from "@/features/settings/components/shared";
import { useProfile, useProfileRefresh } from "@/features/settings/hooks";
import { refreshSession } from "@/lib/auth";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
export function AccountPage() {
  const auth = useAuth();
  const profile = useProfile();
  const refresh = useProfileRefresh();
  const [emailModal, setEmailModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [switchModal, setSwitchModal] = useState(false);
  const action = useAction();
  const router = useRouter();
  const { t, language } = useI18n();
  const date = profile.data?.scheduled_deletion_at;
  return (
    <SettingsPage title="Account">
      <div className="settings-card settings-card-body">
        <h2>{t("Email")}</h2>
        <p>{auth.user?.email}</p>
        <button className="button secondary" type="button" onClick={() => setEmailModal(true)}>
          {t("Change email")}
        </button>
      </div>
      <div className="settings-card">
        <SettingRow href="/settings/security" label="Two-factor authentication" />
      </div>
      <button className="button secondary" type="button" onClick={() => setSwitchModal(true)}>
        {t("Add another account")}
      </button>
      <div className="settings-card settings-card-body danger-zone">
        <h2>{t("Delete account")}</h2>
        {date ? (
          <>
            <p>
              {language === "es" ? "Eliminación programada para" : "Deletion scheduled for"}{" "}
              {new Date(date).toLocaleDateString(language)}
            </p>
            <button
              className="button secondary"
              type="button"
              disabled={action.busy || new Date(date).getTime() <= Date.now()}
              onClick={() =>
                void action.run(async () => {
                  const r = await supabase.rpc("cancel_account_deletion");
                  if (r.error) throw r.error;
                  await refresh();
                })
              }
            >
              {t("Cancel deletion")}
            </button>
          </>
        ) : (
          <button className="button danger" type="button" onClick={() => setDeleteModal(true)}>
            {t("Delete account")}
          </button>
        )}
      </div>
      {action.feedback}
      {emailModal && <EmailModal onClose={() => setEmailModal(false)} />}{" "}
      {deleteModal && <DeleteAccountModal onClose={() => setDeleteModal(false)} />}{" "}
      {switchModal && (
        <Modal
          title={t("Add another account")}
          onClose={action.busy ? undefined : () => setSwitchModal(false)}
        >
          <p>
            {language === "es"
              ? "Se cerrará tu sesión actual para iniciar sesión con otra cuenta."
              : "You’ll sign out of this account before signing in to another."}
          </p>
          {action.feedback}
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={action.busy}
              onClick={() => setSwitchModal(false)}
            >
              {t("Cancel")}
            </button>
            <button
              className="button primary"
              type="button"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await auth.signOut();
                  await router.navigate({ href: "/auth/login" });
                })
              }
            >
              {t("Log out")}
            </button>
          </div>
        </Modal>
      )}
    </SettingsPage>
  );
}
function EmailModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const action = useAction();
  const { t, language } = useI18n();
  return (
    <Modal title={t("Change email")} onClose={action.busy ? undefined : onClose}>
      {sent ? (
        <p role="status">
          {language === "es"
            ? `Confirmación enviada a ${email}. Haz clic en el enlace para completar el cambio.`
            : `Confirmation sent to ${email}. Click the link to complete the change.`}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await refreshSession({ action: "change_email", email: email.trim() });
              setSent(true);
            });
          }}
        >
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
          <button className="button primary" type="submit" disabled={action.busy}>
            {t("Confirm")}
          </button>
        </form>
      )}
      <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
        {t("Back")}
      </button>
    </Modal>
  );
}
