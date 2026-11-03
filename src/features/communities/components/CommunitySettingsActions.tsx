import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { AddMembersModal } from "@/features/chat-settings/components/AddMembersModal";
import { GroupMembersList } from "@/features/chat-settings/components/GroupMembersList";
import { MuteSubmenu } from "@/features/chat-settings/components/MuteSubmenu";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { useAuth } from "@/lib/auth-provider";
import { useCommunityChats } from "../hooks/useCommunityChats";
import { useDeleteCommunity } from "../hooks/useDeleteCommunity";
import { useLeaveCommunity } from "../hooks/useLeaveCommunity";
import { useMuteCommunity } from "../hooks/useMuteCommunity";
import { getAvailableCommunityActions } from "../lib/communityActions";
import type { Community } from "../types";
import { CreateCommunityChatModal } from "./CreateCommunityChatModal";
export function CommunitySettingsActions({
  community,
  chat,
}: {
  community: Community;
  chat: ChatDetails;
}) {
  const { say } = useMessageText();
  const { user } = useAuth();
  const [modal, setModal] = useState<
    "members" | "add" | "mute" | "leave" | "delete" | "create" | null
  >(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(false);
  const chats = useCommunityChats(community.id);
  const leave = useLeaveCommunity(community.id);
  const remove = useDeleteCommunity(community.id);
  const mute = useMuteCommunity(community.id);
  const owner = community.owner_id === user?.id;
  const admin = community.role === "admin";
  const muted =
    !!chats.data?.length &&
    chats.data.every(
      (c) => !!c.membership.muted_until && Date.parse(c.membership.muted_until) > Date.now(),
    );
  const actions = getAvailableCommunityActions(community, user?.id ?? "", admin, owner, muted);
  const open = (value: typeof modal) => {
    setError(false);
    setConfirmation("");
    setModal(value);
  };
  return (
    <>
      <div className="group-links flex flex-col gap-3">
        <button type="button" className="button secondary" onClick={() => open("members")}>
          {say("View members", "Ver miembros")}
        </button>
        <button type="button" className="button secondary" onClick={() => open("mute")}>
          {muted
            ? say("Unmute community", "Activar sonido de la comunidad")
            : say("Mute community", "Silenciar comunidad")}
        </button>
        {actions.includes("add_members") && (
          <button type="button" className="button secondary" onClick={() => open("add")}>
            {say("Add members", "Añadir miembros")}
          </button>
        )}
        {actions.includes("create_chat") && (
          <button type="button" className="button secondary" onClick={() => open("create")}>
            {say("Create chat", "Crear chat")}
          </button>
        )}
        <button type="button" className="button danger" onClick={() => open("leave")}>
          {say("Leave community", "Salir de la comunidad")}
        </button>
        {actions.includes("delete") && (
          <button type="button" className="button danger" onClick={() => open("delete")}>
            {say("Delete community", "Eliminar comunidad")}
          </button>
        )}
      </div>
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
          onChoose={async (until) => {
            try {
              await mute.mutateAsync(until);
              setModal(null);
              setError(false);
            } catch {
              setError(true);
            }
          }}
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
            <button
              type="button"
              className="button secondary"
              disabled={leave.isPending || remove.isPending}
              onClick={() => setModal(null)}
            >
              {say("Cancel", "Cancelar")}
            </button>
            <button
              type="button"
              className="button danger"
              disabled={
                leave.isPending ||
                remove.isPending ||
                (modal === "delete" && confirmation !== community.name)
              }
              onClick={async () => {
                setError(false);
                try {
                  if (modal === "leave") await leave.mutateAsync();
                  else await remove.mutateAsync();
                  setModal(null);
                } catch {
                  setError(true);
                }
              }}
            >
              {say("Confirm", "Confirmar")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
