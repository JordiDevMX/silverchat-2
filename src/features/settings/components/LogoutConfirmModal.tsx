import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { useAuth } from "@/lib/auth-provider";
import { useAction } from "./shared";
export function LogoutConfirmModal({ onClose }: { onClose: () => void }) {
  const [all, setAll] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const action = useAction();
  const { t } = useI18n();
  return (
    <Modal title={t("Log out of SilverChat?")} onClose={action.busy ? undefined : onClose}>
      <p>{t("You’ll need to sign in again with a magic link.")}</p>
      <label className="check-row">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        {t("Also sign out of all other devices")}
      </label>
      {action.feedback}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button danger"
          type="button"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await auth.signOut(all);
              await router.navigate({ href: "/auth/login" });
            })
          }
        >
          {t("Log out")}
        </button>
      </div>
    </Modal>
  );
}
