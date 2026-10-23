import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useChannelInfo } from "../../hooks/channels/useChannelInfo";
import { useUpdateChannelInfo } from "../../hooks/channels/useUpdateChannelInfo";
import { refreshNovedades } from "../../lib/cache";
import type { Channel } from "../../types";
import { ChannelHeader } from "./ChannelHeader";

function EditFields({ channel, onDone }: { channel: Channel; onDone: () => void }) {
  const { say } = useMessageText();
  const save = useUpdateChannelInfo(channel.id);
  const [name, setName] = useState(channel.name);
  const [slug, setSlug] = useState(channel.slug);
  const [description, setDescription] = useState(channel.description ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ name, slug, description }, { onSuccess: onDone });
      }}
    >
      <label className="field">
        {say("Name", "Nombre")}
        <input value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        {say("Slug", "Identificador")}
        <input
          value={slug}
          pattern="[a-z0-9-]{3,50}"
          maxLength={50}
          required
          onChange={(e) => setSlug(e.target.value)}
        />
      </label>
      <label className="field">
        {say("Description", "Descripción")}
        <textarea
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {save.isError && <p role="alert">{save.error.message}</p>}
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          disabled={save.isPending}
          onClick={onDone}
        >
          {say("Cancel", "Cancelar")}
        </button>
        <button type="submit" className="button primary" disabled={save.isPending || !name.trim()}>
          {say("Save", "Guardar")}
        </button>
      </div>
    </form>
  );
}
export function ChannelInfoScreen({ channelId }: { channelId: string }) {
  const q = useChannelInfo(channelId);
  const save = useUpdateChannelInfo(channelId);
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const router = useRouter();
  const cache = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const c = q.data?.channel;
  return (
    <main id="main" className="novedades-page channel-info">
      <NavLink href={`/channels/${channelId}`}>
        ← {say("Back to channel", "Volver al canal")}
      </NavLink>
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {!q.isPending && !c && <p>{say("Channel unavailable", "Canal no disponible")}</p>}
      {c && (
        <>
          <ChannelHeader channel={c} follow={q.data?.follow ?? null} />
          <div className="group-photo">
            <Avatar
              profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
              size="large"
            />
            {c.owner_id === user?.id && (
              <button type="button" className="button secondary" onClick={() => setPhoto(true)}>
                {say("Change photo", "Cambiar foto")}
              </button>
            )}
          </div>
          <h1>
            {c.name} {c.is_verified && <BadgeCheck aria-label={say("Verified", "Verificado")} />}
          </h1>
          <p>
            @{c.slug} · {c.follower_count} {say("followers", "seguidores")}
          </p>
          <p className="channel-description">{c.description}</p>
          <p>
            {say("Created", "Creado")}{" "}
            {new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(
              new Date(c.created_at),
            )}
          </p>
          {c.owner_id === user?.id && (
            <>
              {editing ? (
                <EditFields key={c.id} channel={c} onDone={() => setEditing(false)} />
              ) : (
                <button type="button" className="button secondary" onClick={() => setEditing(true)}>
                  {say("Edit channel", "Editar canal")}
                </button>
              )}
              <button type="button" className="button danger" onClick={() => setConfirm(true)}>
                {say("Delete channel", "Eliminar canal")}
              </button>
              {photo && (
                <AvatarPickerModal
                  profile={{ id: c.id, avatar_url: c.avatar_url }}
                  onSave={(file) =>
                    saveGroupAvatar(
                      c.id,
                      user?.id ?? "",
                      file,
                      c.avatar_url,
                      save.mutateAsync,
                      "channel",
                    )
                  }
                  onSaved={(warning) =>
                    useChatUIStore
                      .getState()
                      .notify(
                        warning
                          ? say(
                              "Photo saved; old photo cleanup is pending.",
                              "Foto guardada; limpieza pendiente.",
                            )
                          : say("Channel photo updated", "Foto del canal actualizada"),
                      )
                  }
                  onClose={() => setPhoto(false)}
                />
              )}
            </>
          )}
          {confirm && (
            <Modal
              title={say("Delete this channel?", "¿Eliminar este canal?")}
              onClose={busy ? undefined : () => setConfirm(false)}
            >
              <p>
                {say(
                  "All posts and followers will be removed permanently.",
                  "Todas las publicaciones y los seguidores se eliminarán permanentemente.",
                )}
              </p>
              {error && (
                <p role="alert">
                  {say(
                    "Unable to delete channel. Try again.",
                    "No se pudo eliminar el canal. Reinténtalo.",
                  )}
                </p>
              )}
              <div className="modal-actions">
                <button type="button" disabled={busy} onClick={() => setConfirm(false)}>
                  {say("Cancel", "Cancelar")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="button danger"
                  onClick={async () => {
                    setBusy(true);
                    setError(false);
                    try {
                      const r = await supabase
                        .from("channels")
                        .delete()
                        .eq("id", c.id)
                        .eq("owner_id", user?.id ?? "")
                        .select("id")
                        .single();
                      if (r.error) throw r.error;
                      await refreshNovedades(cache, user?.id ?? "");
                      await router.navigate({ href: "/novedades" });
                    } catch {
                      setError(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {say("Delete channel", "Eliminar canal")}
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </main>
  );
}
