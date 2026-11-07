import { Button } from "@/components/ui/button";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { useCreateChannelDialog } from "../../hooks/channels/useCreateChannelDialog";
import { slugify, validSlug } from "../../lib/storyOrdering";
export function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const {
    user,
    say,
    name,
    setName,
    slug,
    setSlug,
    custom,
    setCustom,
    description,
    setDescription,
    file,
    setFile,
    photoOpen,
    setPhotoOpen,
    preview,
    term,
    error,
    busy,
    created,
    available,
    submit,
  } = useCreateChannelDialog(onClose);
  return (
    <MotionOverlay
      title={say("Create channel", "Crear canal")}
      className="channel-create-modal channel-overlay"
      onClose={onClose}
      canClose={!busy && !photoOpen}
    >
      {(close) => (
        <>
          <form className="channel-form" onSubmit={submit}>
            <label className="field">
              {say("Name", "Nombre")}
              <input
                value={name}
                maxLength={100}
                required
                disabled={busy || !!created}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!custom) setSlug(slugify(e.target.value));
                }}
              />
            </label>
            <label className="field">
              {say("Slug", "Identificador")}
              <input
                value={slug}
                maxLength={50}
                pattern="[a-z0-9-]{3,50}"
                required
                disabled={busy || !!created}
                onChange={(e) => {
                  setCustom(true);
                  setSlug(e.target.value);
                }}
              />
            </label>
            {validSlug(slug) && !created && (
              <small role="status">
                {term !== slug || available.isFetching
                  ? say("Checking availability…", "Comprobando disponibilidad…")
                  : available.isError
                    ? say(
                        "Availability check failed; submit to retry.",
                        "Falló la comprobación; envía para reintentar.",
                      )
                    : available.data
                      ? say("Available", "Disponible")
                      : say("Slug already taken", "Identificador ocupado")}
              </small>
            )}
            <label className="field">
              {say("Description", "Descripción")}
              <textarea
                value={description}
                maxLength={500}
                disabled={busy || !!created}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={busy}
              onClick={() => setPhotoOpen(true)}
            >
              {say("Channel photo (optional)", "Foto del canal (opcional)")}
            </Button>
            {preview && (
              <img
                className="avatar-preview"
                src={preview}
                alt={say("Channel photo preview", "Vista previa de foto del canal")}
              />
            )}
            {file && (
              <Button type="button" disabled={busy} onClick={() => setFile(undefined)}>
                {say("Remove selected photo", "Quitar foto seleccionada")}
              </Button>
            )}
            {error && <p role="alert">{error}</p>}
            {created && error && (
              <p>
                {say(
                  "Channel created. Retry the photo upload or continue without a photo.",
                  "Canal creado. Reintenta subir la foto o continúa sin ella.",
                )}
              </p>
            )}
            <div className="modal-actions">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={busy}
                onClick={close}
              >
                {say("Cancel", "Cancelar")}
              </Button>
              <Button
                type="submit"
                className="rounded-xl"
                disabled={
                  busy ||
                  !name.trim() ||
                  !validSlug(slug) ||
                  (!created && term === slug && available.data === false)
                }
              >
                {created ? say("Finish", "Finalizar") : say("Create channel", "Crear canal")}
              </Button>
            </div>
          </form>
          {photoOpen && (
            <AvatarPickerModal
              profile={{ id: user?.id ?? "", avatar_url: null }}
              onSave={async (photo) => {
                setFile(photo ?? undefined);
                return { cleanupPending: false };
              }}
              onSaved={() => {}}
              onClose={() => setPhotoOpen(false)}
            />
          )}
        </>
      )}
    </MotionOverlay>
  );
}
