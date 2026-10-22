import { useState } from "react";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { supabase } from "@/lib/supabase";
import { useProfileRefresh } from "../hooks";
import { useAction } from "./shared";
export function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const action = useAction();
  const refresh = useProfileRefresh();
  const { t } = useI18n();
  return (
    <Modal title={t("Delete your account?")} onClose={action.busy ? undefined : onClose}>
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
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button danger"
          type="button"
          disabled={action.busy || confirmation !== "DELETE"}
          onClick={() =>
            void action.run(async () => {
              const r = await supabase.rpc("schedule_account_deletion");
              if (r.error) throw r.error;
              await refresh();
              onClose();
            })
          }
        >
          {t("Schedule deletion")}
        </button>
      </div>
    </Modal>
  );
}
