import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { useBlockUser } from "../hooks/useBlockUser";
export function BlockUserModal({
  target,
  onClose,
}: {
  target: { id: string; display_name: string };
  onClose: () => void;
}) {
  const { user, action, t, language, block } = useBlockUser(target.id, onClose);
  return (
    <SettingsDialog
      title={`${t("Block")} ${target.display_name}?`}
      onClose={onClose}
      canClose={!action.busy}
    >
      {(close) => (
        <>
          <p>
            {language === "es"
              ? "No podrán enviarte mensajes y no verás sus mensajes."
              : "They won’t be able to message you, and you won’t see their messages."}
          </p>
          {action.feedback}
          <div className="modal-actions">
            <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              type="button"
              disabled={action.busy || !user}
              onClick={() => void block()}
            >
              {t("Block")}
            </Button>
          </div>
        </>
      )}
    </SettingsDialog>
  );
}
