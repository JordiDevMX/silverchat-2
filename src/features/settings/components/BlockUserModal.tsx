import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/app/providers/i18n-provider";
import { Modal } from "@/features/auth/components";
import { useAuth } from "@/lib/auth-provider";
import { blockUser } from "../hooks";
import { useAction } from "./shared";
export function BlockUserModal({
  target,
  onClose,
}: {
  target: { id: string; display_name: string };
  onClose: () => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const action = useAction();
  const { language, t } = useI18n();
  return (
    <Modal
      title={`${t("Block")} ${target.display_name}?`}
      onClose={action.busy ? undefined : onClose}
    >
      <p>
        {language === "es"
          ? "No podrán enviarte mensajes y no verás sus mensajes."
          : "They won’t be able to message you, and you won’t see their messages."}
      </p>
      {action.feedback}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={action.busy} onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button danger"
          type="button"
          disabled={action.busy || !user}
          onClick={() =>
            void action.run(async () => {
              if (!user) return;
              await blockUser(target.id, user.id);
              await Promise.all(
                ["blocked", "contacts", "public-profile", "avatar-url", "chats"].map((key) =>
                  cache.invalidateQueries({ queryKey: [key] }),
                ),
              );
              onClose();
            })
          }
        >
          {t("Block")}
        </button>
      </div>
    </Modal>
  );
}
