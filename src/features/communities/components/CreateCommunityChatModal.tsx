import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useCreateCommunityChat } from "../hooks/useCreateCommunityChat";
import { CreationDialog } from "./CreationDialog";
export function CreateCommunityChatModal({
  communityId,
  onClose,
}: {
  communityId: string;
  onClose: () => void;
}) {
  const { say } = useMessageText();
  const router = useRouter();
  const mutation = useCreateCommunityChat(communityId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <CreationDialog
      title={say("New chat", "Nuevo chat")}
      onClose={mutation.isPending ? undefined : onClose}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || mutation.isPending) return;
          try {
            const id = await mutation.mutateAsync({ name, description });
            await router.navigate({ href: `/communities/${communityId}/chats/${id}` });
            onClose();
          } catch {
            /* Mutation error is rendered below. */
          }
        }}
      >
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
        {mutation.isError && (
          <p role="alert">
            {say(
              "Unable to create chat. Check your permissions and retry.",
              "No se pudo crear el chat. Revisa tus permisos y reintenta.",
            )}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            {say("Cancel", "Cancelar")}
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={mutation.isPending || !name.trim()}
          >
            {say("Create chat", "Crear chat")}
          </button>
        </div>
      </form>
    </CreationDialog>
  );
}
