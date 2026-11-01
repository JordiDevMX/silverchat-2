import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useMessageText } from "@/features/messages/i18n";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useCreateCommunity } from "../hooks/useCreateCommunity";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
import { CreationDialog } from "./CreationDialog";
export function CreateCommunityModal({ onClose }: { onClose: () => void }) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const router = useRouter();
  const create = useCreateCommunity();
  const cache = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [photo, setPhoto] = useState(false);
  const [preview, setPreview] = useState("");
  const [createdId, setCreatedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : "";
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);
  return (
    <CreationDialog
      title={say("New community", "Nueva comunidad")}
      onClose={busy ? undefined : onClose}
      paused={photo}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          setError("");
          try {
            const id = createdId ?? (await create.mutateAsync({ name, description }));
            if (!id) throw new Error("Community unavailable");
            setCreatedId(id);
            if (file)
              await saveGroupAvatar(
                id,
                user?.id ?? "",
                file,
                null,
                async (patch) => {
                  await communityApi(supabase).update(id, patch);
                },
                "community",
              );
            await refreshCommunities(cache, user?.id ?? "");
            await router.navigate({ href: `/communities/${id}` });
            onClose();
          } catch {
            setError(
              say(
                "Unable to finish. Retry; an already created community will be reused.",
                "No se pudo terminar. Reintenta; se reutilizará la comunidad si ya se creó.",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
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
        {preview && (
          <img
            src={preview}
            className="size-20 rounded-full object-cover"
            alt={say("Community photo", "Foto de la comunidad")}
          />
        )}
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => setPhoto(true)}
        >
          {say("Choose photo", "Elegir foto")}
        </button>
        {file && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setFile(null)}
          >
            {say("Remove photo", "Quitar foto")}
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {say("Cancel", "Cancelar")}
          </button>
          <button type="submit" className="button primary" disabled={busy || !name.trim()}>
            {busy ? say("Creating…", "Creando…") : say("Create community", "Crear comunidad")}
          </button>
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
