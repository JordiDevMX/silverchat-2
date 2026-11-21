import { Button } from "@/components/ui/button";
import { useCreateCommunityChatDialog } from "../hooks/useCreateCommunityChatDialog";
import { CreationDialog } from "./CreationDialog";
export function CreateCommunityChatModal({
  communityId,
  onClose,
}: {
  communityId: string;
  onClose: () => void;
}) {
  const {
    say,
    name,
    setName,
    description,
    setDescription,
    writePolicy,
    setWritePolicy,
    mutation,
    submit,
  } = useCreateCommunityChatDialog(communityId, onClose);
  return (
    <CreationDialog
      title={say("New chat", "Nuevo chat")}
      onClose={mutation.isPending ? undefined : onClose}
    >
      <form className="community-creation-form" onSubmit={submit}>
        <label className="field">
          {say("Name", "Nombre")}
          <input
            required
            maxLength={100}
            value={name}
            disabled={mutation.isPending}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          {say("Description (optional)", "Descripción (opcional)")}
          <textarea
            maxLength={500}
            value={description}
            disabled={mutation.isPending}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          {say("Who can send messages", "Quién puede enviar mensajes")}
          <select
            value={writePolicy}
            disabled={mutation.isPending}
            onChange={(e) => setWritePolicy(e.target.value as typeof writePolicy)}
          >
            <option value="all">{say("All members", "Todos los miembros")}</option>
            <option value="moderators">
              {say("Moderators, admins & owner", "Moderadores, admins y propietario")}
            </option>
            <option value="admins">{say("Admins & owner", "Admins y propietario")}</option>
            <option value="owner_only">{say("Owner only", "Solo propietario")}</option>
          </select>
        </label>
        {mutation.isError && (
          <p role="alert">
            {say(
              "Unable to create chat. Check your permissions and retry.",
              "No se pudo crear el chat. Revisa tus permisos y reintenta.",
            )}
          </p>
        )}
        <div className="modal-actions">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {say("Cancel", "Cancelar")}
          </Button>
          <Button
            type="submit"
            className="rounded-xl"
            disabled={mutation.isPending || !name.trim()}
          >
            {say("Create chat", "Crear chat")}
          </Button>
        </div>
      </form>
    </CreationDialog>
  );
}
