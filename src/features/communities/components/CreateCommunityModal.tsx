import { Button } from "@/components/ui/button";
import { PhotoEditorPanel } from "@/features/roles/components/PhotoEditorPanel";
import { useCreateCommunityDialog } from "../hooks/useCreateCommunityDialog";
import { CreationDialog } from "./CreationDialog";
export function CreateCommunityModal({ onClose }: { onClose: () => void }) {
  const {
    say,
    name,
    setName,
    description,
    setDescription,
    file,
    setFile,
    createdId,
    busy,
    error,
    submit,
  } = useCreateCommunityDialog(onClose);
  return (
    <CreationDialog
      title={say("New community", "Nueva comunidad")}
      onClose={busy ? undefined : onClose}
    >
      <form
        className="community-creation-form"
        data-clipboard-reason="avatar-hint"
        onSubmit={submit}
      >
        <label className="field">
          {say("Name", "Nombre")}
          <input
            required
            maxLength={100}
            value={name}
            disabled={busy || !!createdId}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          {say("Description", "Descripción")}
          <textarea
            maxLength={500}
            rows={3}
            value={description}
            disabled={busy || !!createdId}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <PhotoEditorPanel
          stagedFile={file}
          busy={busy}
          previewAlt={say("Community photo", "Foto de la comunidad")}
          onSelectCropped={(cropped) => setFile(cropped)}
          onRemove={file ? () => setFile(null) : undefined}
        />
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={onClose}
          >
            {say("Cancel", "Cancelar")}
          </Button>
          <Button type="submit" className="rounded-xl" disabled={busy || !name.trim()}>
            {busy ? say("Creating…", "Creando…") : say("Create community", "Crear comunidad")}
          </Button>
        </div>
      </form>
    </CreationDialog>
  );
}
