import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Modal } from "@/features/auth/components";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { useAuth } from "@/lib/auth-provider";
import { optimizeAvatar } from "@/lib/avatar-upload";
import { supabase } from "@/lib/supabase";
import { useCreateChannel } from "../../hooks/channels/useCreateChannel";
import { slugify, validSlug } from "../../lib/storyOrdering";
export function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const router = useRouter();
  const create = useCreateChannel();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [custom, setCustom] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File>();
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string>();
  useEffect(() => {
    const timer = setTimeout(() => setTerm(slug), 500);
    return () => clearTimeout(timer);
  }, [slug]);
  const available = useQuery({
    queryKey: ["channel-slug", user?.id, term],
    enabled: validSlug(term) && !created,
    queryFn: async () => {
      const r = await supabase.from("channels").select("id").eq("slug", term).maybeSingle();
      if (r.error) throw r.error;
      return !r.data;
    },
  });
  return (
    <Modal
      title={say("Create channel", "Crear canal")}
      className="channel-create-modal"
      onClose={busy ? undefined : onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const photo = file ? await optimizeAvatar(file) : null;
            const id = created ?? (await create.mutateAsync({ name, slug, description }));
            setCreated(id);
            if (photo)
              await saveGroupAvatar(
                id,
                user?.id ?? "",
                photo,
                null,
                async (patch) => {
                  const r = await supabase.rpc("update_channel_info", {
                    p_channel_id: id,
                    p_avatar_url: patch.avatar_url,
                  });
                  if (r.error) throw r.error;
                },
                "channel",
              );
            useChatUIStore.getState().notify(say("Channel created", "Canal creado"));
            onClose();
            await router.navigate({ href: `/channels/${id}/info` });
          } catch (e) {
            setError(
              e && typeof e === "object" && "message" in e
                ? String(e.message)
                : say(
                    "Unable to create channel. Try again.",
                    "No se pudo crear el canal. Reinténtalo.",
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
        <label className="field">
          {say("Channel photo (optional)", "Foto del canal (opcional)")}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </label>
        {file && (
          <button type="button" disabled={busy} onClick={() => setFile(undefined)}>
            {say("Remove selected photo", "Quitar foto seleccionada")}
          </button>
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
          <button type="button" className="button secondary" disabled={busy} onClick={onClose}>
            {say("Cancel", "Cancelar")}
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={
              busy ||
              !name.trim() ||
              !validSlug(slug) ||
              (!created && term === slug && available.data === false)
            }
          >
            {created ? say("Finish", "Finalizar") : say("Create channel", "Crear canal")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
