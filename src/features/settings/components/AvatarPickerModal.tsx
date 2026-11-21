import { Button } from "@/components/ui/button";
import { SettingsDialog } from "@/components/ui/settings-surfaces";
import { PhotoEditorPanel } from "@/features/roles/components/PhotoEditorPanel";
import { saveAvatar } from "@/lib/avatar-upload";
import { type Profile, useProfileRefresh } from "../hooks";
import { useAction } from "../hooks/useAction";
import { useAvatarUrl } from "../hooks/useAvatar";

export function AvatarPickerModal({
  profile,
  onClose,
  onSaved,
  onSave,
}: {
  profile: Pick<Profile, "id" | "avatar_url">;
  onSave?: (file: File | null) => Promise<{ cleanupPending: boolean }>;
  onClose: () => void;
  onSaved: (warning: boolean) => void;
}) {
  const action = useAction();
  const refresh = useProfileRefresh();
  const url = useAvatarUrl(profile.avatar_url);

  const persist = async (file: File | null) => {
    await action.run(async () => {
      const result = onSave
        ? await onSave(file)
        : await saveAvatar(profile.id, file, profile.avatar_url);
      if (!onSave) await refresh();
      onSaved(result.cleanupPending);
      onClose();
    });
  };

  return (
    <SettingsDialog
      title="Change photo"
      onClose={onClose}
      canClose={!action.busy}
      className="avatar-picker-dialog"
    >
      {(close) => (
        <div className="flex flex-col gap-3">
          <PhotoEditorPanel
            existingUrl={url.data}
            hasExisting={Boolean(profile.avatar_url)}
            busy={action.busy}
            applyLabel={action.busy ? "Saving…" : "Save"}
            onSelectCropped={(file) => persist(file)}
            onRemove={() => persist(null)}
            footerExtra={
              <Button variant="outline" type="button" disabled={action.busy} onClick={close}>
                Cancel
              </Button>
            }
          />
          {action.feedback}
        </div>
      )}
    </SettingsDialog>
  );
}
