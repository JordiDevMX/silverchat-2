import { BadgeCheck, BellOff, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChannelFollowButton, ChannelInfoSurface } from "@/components/ui/channel-surfaces";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { SettingsRow } from "@/components/ui/settings-row";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import { saveGroupAvatar } from "@/features/chat-settings/lib/groupAvatar";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import { useMessageText } from "@/features/messages/i18n";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useChannelDeletion } from "../../hooks/channels/useChannelDeletion";
import { useChannelInfo } from "../../hooks/channels/useChannelInfo";
import { useFollowChannel } from "../../hooks/channels/useFollowChannel";
import { useMuteChannel } from "../../hooks/channels/useMuteChannel";
import { useUnfollowChannel } from "../../hooks/channels/useUnfollowChannel";
import { useUpdateChannelInfo } from "../../hooks/channels/useUpdateChannelInfo";
import type { Channel } from "../../types";
import { ChannelHeader } from "./ChannelHeader";

function EditFields({ channel, onDone }: { channel: Channel; onDone: () => void }) {
  const { say } = useMessageText();
  const save = useUpdateChannelInfo(channel.id);
  const [name, setName] = useState(channel.name);
  const [slug, setSlug] = useState(channel.slug);
  const [description, setDescription] = useState(channel.description ?? "");
  return (
    <MotionOverlay
      title={say("Edit channel", "Editar canal")}
      className="channel-overlay channel-create-modal"
      onClose={onDone}
      canClose={!save.isPending}
    >
      {(close) => (
        <form
          className="channel-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({ name, slug, description }, { onSuccess: onDone });
          }}
        >
          <label className="field">
            {say("Name", "Nombre")}
            <input
              value={name}
              maxLength={100}
              required
              onChange={(e) => setName(e.target.value)}
            />
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
            <Button type="button" variant="outline" disabled={save.isPending} onClick={close}>
              {say("Cancel", "Cancelar")}
            </Button>
            <Button type="submit" disabled={save.isPending || !name.trim()}>
              {say("Save", "Guardar")}
            </Button>
          </div>
        </form>
      )}
    </MotionOverlay>
  );
}
export function ChannelInfoScreen({ channelId }: { channelId: string }) {
  const { busy, error, deleteChannel } = useChannelDeletion(channelId);
  const q = useChannelInfo(channelId);
  const save = useUpdateChannelInfo(channelId);
  const add = useFollowChannel();
  const remove = useUnfollowChannel();
  const mute = useMuteChannel(channelId);
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [muteOpen, setMuteOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const c = q.data?.channel;
  const follow = q.data?.follow ?? null;
  return (
    <main id="main" className="novedades-page channel-info">
      <NavLink href={`/channels/${channelId}`}>
        ← {say("Back to channel", "Volver al canal")}
      </NavLink>
      <QueryState loading={q.isPending} error={q.error} retry={() => void q.refetch()} />
      {!q.isPending && !c && <p>{say("Channel unavailable", "Canal no disponible")}</p>}
      {c && (
        <>
          <ChannelHeader channel={c} follow={follow} />
          <ChannelInfoSurface
            avatar={
              <>
                <Avatar
                  profile={{ id: c.id, display_name: c.name, avatar_url: c.avatar_url }}
                  size="large"
                />
                {c.owner_id === user?.id && (
                  <Button variant="outline" onClick={() => setPhoto(true)}>
                    {say("Change photo", "Cambiar foto")}
                  </Button>
                )}
              </>
            }
            title={
              <>
                {c.name}{" "}
                {c.is_verified && (
                  <BadgeCheck className="text-neon" aria-label={say("Verified", "Verificado")} />
                )}
              </>
            }
            meta={
              <>
                @{c.slug} · {c.follower_count} {say("followers", "seguidores")}
              </>
            }
            description={c.description}
            created={
              <>
                {say("Created", "Creado")}{" "}
                {new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(
                  new Date(c.created_at),
                )}
              </>
            }
          >
            <ChannelFollowButton
              following={!!follow}
              busy={add.isPending || remove.isPending}
              label={follow ? say("Unfollow", "Dejar de seguir") : say("Follow", "Seguir")}
              onClick={() => {
                if (follow) remove.mutate(c.id);
                else add.mutate(c.id);
              }}
            />
            {follow && (
              <SettingsRow
                icon={<BellOff />}
                label={say("Mute notifications", "Silenciar notificaciones")}
                onClick={() => setMuteOpen(true)}
              />
            )}
            {c.owner_id === user?.id && (
              <>
                <SettingsRow
                  icon={<Pencil />}
                  label={say("Edit channel", "Editar canal")}
                  onClick={() => setEditing(true)}
                />
                <SettingsRow
                  icon={<Trash2 />}
                  className="text-destructive"
                  label={say("Delete channel", "Eliminar canal")}
                  onClick={() => setConfirm(true)}
                />
              </>
            )}
          </ChannelInfoSurface>
          {muteOpen && (
            <MuteSubmenu
              muted={!!follow?.muted_until && Date.parse(follow.muted_until) > Date.now()}
              busy={mute.isPending}
              onClose={() => setMuteOpen(false)}
              onChoose={(until) => mute.mutate(until, { onSuccess: () => setMuteOpen(false) })}
            />
          )}
          {c.owner_id === user?.id && (
            <>
              {editing && <EditFields key={c.id} channel={c} onDone={() => setEditing(false)} />}
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
            <MotionOverlay
              className="channel-overlay"
              title={say("Delete this channel?", "¿Eliminar este canal?")}
              onClose={() => setConfirm(false)}
              canClose={!busy}
            >
              {(close) => (
                <>
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
                    <Button type="button" disabled={busy} variant="outline" onClick={close}>
                      {say("Cancel", "Cancelar")}
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      variant="destructive"
                      onClick={deleteChannel}
                    >
                      {say("Delete channel", "Eliminar canal")}
                    </Button>
                  </div>
                </>
              )}
            </MotionOverlay>
          )}
        </>
      )}
    </main>
  );
}
