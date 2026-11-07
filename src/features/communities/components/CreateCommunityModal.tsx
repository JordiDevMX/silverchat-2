import { Button } from "@/components/ui/button";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
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
    photo,
    setPhoto,
    preview,
    createdId,
    busy,
    error,
    submit,
  } = useCreateCommunityDialog(onClose);
  return (
    <CreationDialog
      title={say("New community", "Nueva comunidad")}
      onClose={busy ? undefined : onClose}
      paused={photo}
    >
      <form className="community-creation-form" onSubmit={submit}>
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
        {preview && (
          <img
            src={preview}
            className="size-20 rounded-full object-cover"
            alt={say("Community photo", "Foto de la comunidad")}
          />
        )}
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() => setPhoto(true)}
        >
          {say("Choose photo", "Elegir foto")}
        </Button>
        {file && (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={() => setFile(null)}
          >
            {say("Remove photo", "Quitar foto")}
          </Button>
        )}
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
      {photo && (
        <AvatarPickerModal
          profile={{ id: "new-community", avatar_url: null }}
          onClose={() => setPhoto(false)}
          onSaved={() => {}}
          onSave={async (image) => {
            setFile(image);
            return { cleanupPending: false };
          }}
        />
      )}
    </CreationDialog>
  );
}
