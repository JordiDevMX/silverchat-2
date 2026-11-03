import { BellOff, LogOut, MessageCirclePlus, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSurface, SettingsRow } from "@/components/ui/settings-row";
import { Modal } from "@/features/auth/components";
import { AddMembersModal } from "@/features/chat-settings/components/AddMembersModal";
import { GroupMembersList } from "@/features/chat-settings/components/GroupMembersList";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import type { ChatDetails } from "@/features/messages/types";
import { useCommunitySettingsActions } from "../hooks/useCommunitySettingsActions";
import type { Community } from "../types";
import { CreateCommunityChatModal } from "./CreateCommunityChatModal";
export function CommunitySettingsActions({
  community,
  chat,
}: {
  community: Community;
  chat: ChatDetails;
}) {
  const {
    say,
    modal,
    setModal,
    confirmation,
    setConfirmation,
    error,
    leave,
    remove,
    mute,
    owner,
    admin,
    muted,
    actions,
    open,
    chooseMute,
    confirmAction,
  } = useCommunitySettingsActions(community);
  return (
    <>
      <CardSurface className="community-actions">
        <SettingsRow
          icon={<Users />}
          label={say("View members", "Ver miembros")}
          onClick={() => open("members")}
        />
        <SettingsRow
          icon={<BellOff />}
          label={
            muted
              ? say("Unmute community", "Activar sonido de la comunidad")
              : say("Mute community", "Silenciar comunidad")
          }
          onClick={() => open("mute")}
        />
        {actions.includes("add_members") && (
          <SettingsRow
            icon={<UserPlus />}
            label={say("Add members", "Añadir miembros")}
            onClick={() => open("add")}
          />
        )}
        {actions.includes("create_chat") && (
          <SettingsRow
            icon={<MessageCirclePlus />}
            label={say("Create chat", "Crear chat")}
            onClick={() => open("create")}
          />
        )}
        <SettingsRow
          className="text-destructive [&_svg]:text-destructive"
          icon={<LogOut />}
          label={say("Leave community", "Salir de la comunidad")}
          onClick={() => open("leave")}
        />
        {actions.includes("delete") && (
          <SettingsRow
            className="text-destructive [&_svg]:text-destructive"
            icon={<Trash2 />}
            label={say("Delete community", "Eliminar comunidad")}
            onClick={() => open("delete")}
          />
        )}
      </CardSurface>
      {modal === "members" && (
        <Modal
          title={say("Community members", "Miembros de la comunidad")}
          className="chat-settings-modal"
          onClose={() => setModal(null)}
        >
          <GroupMembersList
            context="community"
            chatId={community.id}
            onBack={() => setModal(null)}
          />
        </Modal>
      )}
      {modal === "add" && admin && (
        <AddMembersModal chat={chat} context="community" onClose={() => setModal(null)} />
      )}
      {modal === "create" && admin && (
        <CreateCommunityChatModal communityId={community.id} onClose={() => setModal(null)} />
      )}
      {modal === "mute" && (
        <MuteSubmenu
          error={
            error
              ? say(
                  "Unable to mute the community. Retry.",
                  "No se pudo silenciar la comunidad. Reintenta.",
                )
              : undefined
          }
          muted={muted}
          busy={mute.isPending}
          onClose={() => setModal(null)}
          onChoose={chooseMute}
        />
      )}
      {error && (
        <p role="alert">
          {say(
            "Unable to complete the action. Retry.",
            "No se pudo completar la acción. Reintenta.",
          )}
        </p>
      )}
      {(modal === "leave" || (modal === "delete" && owner)) && (
        <Modal
          title={
            modal === "leave"
              ? say("Leave community?", "¿Salir de la comunidad?")
              : say("Delete community?", "¿Eliminar comunidad?")
          }
          onClose={leave.isPending || remove.isPending ? undefined : () => setModal(null)}
        >
          {modal === "leave" ? (
            <p>
              {owner
                ? community.member_count === 1
                  ? say(
                      "You're the only member. Leaving will delete this community and all its chats.",
                      "Eres el único miembro. Salir eliminará esta comunidad y todos sus chats.",
                    )
                  : say(
                      "You're the owner of this community. If you leave, the oldest admin (or oldest member if no admins) will automatically become the new owner.",
                      "Eres el propietario. Si sales, el administrador más antiguo (o el miembro más antiguo si no hay administradores) será el nuevo propietario.",
                    )
                : say(
                    "You will leave all chats in this community and stop receiving their messages.",
                    "Saldrás de todos los chats de esta comunidad y dejarás de recibir sus mensajes.",
                  )}
            </p>
          ) : (
            <label className="field">
              {say(
                `This permanently deletes all chats. Type ${community.name} to confirm.`,
                `Esto elimina todos los chats. Escribe ${community.name} para confirmar.`,
              )}
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
          )}
          {error && (
            <p role="alert">
              {say(
                "Unable to complete the action. Retry.",
                "No se pudo completar la acción. Reintenta.",
              )}
            </p>
          )}
          <div className="modal-actions">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={leave.isPending || remove.isPending}
              onClick={() => setModal(null)}
            >
              {say("Cancel", "Cancelar")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={
                leave.isPending ||
                remove.isPending ||
                (modal === "delete" && confirmation !== community.name)
              }
              onClick={confirmAction}
            >
              {say("Confirm", "Confirmar")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
