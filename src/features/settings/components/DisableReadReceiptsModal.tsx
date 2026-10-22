import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { usePreferences } from "../preferences-provider";
import { useAction } from "./shared";
export function DisableReadReceiptsModal({ onClose }: { onClose: () => void }) {
  const { save } = usePreferences();
  const action = useAction();
  const { t } = useI18n();
  return (
    <Modal title={t("Turn off read receipts?")} onClose={action.busy ? undefined : onClose}>
      <p>
        {t(
          "When read receipts are off, you won’t see when others have read your messages, and they won’t see when you’ve read theirs. This applies to everyone until you turn it back on.",
        )}
      </p>
      {action.feedback}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Keep enabled")}
        </button>
        <button
          className="button primary"
          type="button"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await save({ read_receipts_enabled: false });
              onClose();
            })
          }
        >
          {t("Turn off")}
        </button>
      </div>
    </Modal>
  );
}
