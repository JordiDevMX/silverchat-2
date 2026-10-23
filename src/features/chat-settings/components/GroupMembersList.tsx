import { useState } from "react";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useGroupMembers } from "../hooks/useGroupMembers";
import { useChatUIStore } from "../stores/uiStore";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";
export function GroupMembersList({ chatId }: { chatId: string }) {
  const hook = useGroupMembers(chatId);
  const chat = hook.chat.data;
  const { user } = useAuth();
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    action: "promote" | "demote" | "remove";
    userId: string;
    name: string;
  }>();
  const [error, setError] = useState(false);
  if (!chat) return <ChatSettingsLoading query={hook.chat} />;
  if (!["group", "community_chat"].includes(chat.type)) return <ChatSettingsLoading />;
  const admin = chat.own?.role === "admin";
  return (
    <main id="main" className="chat-settings-screen">
      <header>
        <NavLink href={`/chats/${chatId}/info`}>
          ← {say("Group info", "Información del grupo")}
        </NavLink>
        <h1>
          {hook.members.length} {say("members", "miembros")}
        </h1>
        {admin && (
          <button
            type="button"
            className="button primary"
            onClick={() => ui.open(chatId, { kind: "add" })}
          >
            + {say("Add", "Añadir")}
          </button>
        )}
      </header>
      {(["admin", "member"] as const).map((role) => (
        <section key={role}>
          <h2>
            {role === "admin" ? say("Admins", "Administradores") : say("Members", "Miembros")}
          </h2>
          {hook.members
            .filter((m) => m.role === role)
            .map((member) => (
              <div className="group-member" key={member.user_id}>
                <button
                  type="button"
                  className="member-identity"
                  onClick={() => ui.open(chatId, { kind: "contact", userId: member.user_id })}
                >
                  <Avatar profile={member.profile ?? { id: member.user_id }} size="small" />
                  <span>
                    <strong>
                      {member.profile?.display_name ?? say("Member", "Miembro")}
                      {member.user_id === chat.createdBy && ` · ${say("Creator", "Creador")}`}
                    </strong>
                    <small>
                      @{member.profile?.username ?? "—"}{" "}
                      {role === "admin" && ` · ${say("Admin", "Administrador")}`}
                    </small>
                  </span>
                </button>
                {admin && (
                  <div>
                    <button
                      type="button"
                      className="message-icon"
                      aria-label={`${say("Member actions", "Acciones del miembro")}: ${member.profile?.display_name ?? member.user_id}`}
                      aria-expanded={menu === member.user_id}
                      onClick={() => setMenu(menu === member.user_id ? null : member.user_id)}
                    >
                      ⋮
                    </button>
                    {menu === member.user_id && (
                      <div className="member-actions">
                        {(member.role === "member"
                          ? ["promote"]
                          : member.user_id !== chat.createdBy
                            ? ["demote"]
                            : []
                        )
                          .concat(
                            member.user_id !== chat.createdBy && member.user_id !== user?.id
                              ? ["remove"]
                              : [],
                          )
                          .map((action) => (
                            <button
                              type="button"
                              key={action}
                              onClick={() => {
                                setMenu(null);
                                setError(false);
                                setConfirm({
                                  action: action as "promote" | "demote" | "remove",
                                  userId: member.user_id,
                                  name: member.profile?.display_name ?? say("Member", "Miembro"),
                                });
                              }}
                            >
                              {action === "promote"
                                ? say("Promote to admin", "Ascender a administrador")
                                : action === "demote"
                                  ? say("Demote from admin", "Quitar administrador")
                                  : say("Remove from group", "Eliminar del grupo")}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </section>
      ))}
      {confirm && (
        <Modal
          title={`${confirm.action === "remove" ? say("Remove", "Eliminar") : confirm.action === "promote" ? say("Promote", "Ascender") : say("Demote", "Degradar")} ${confirm.name}?`}
          onClose={hook.busy ? undefined : () => setConfirm(undefined)}
        >
          {error && (
            <p role="alert">
              {say(
                "Unable to update this member. Your permissions may have changed.",
                "No se pudo actualizar este miembro. Tus permisos pueden haber cambiado.",
              )}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={hook.busy}
              onClick={() => setConfirm(undefined)}
            >
              {say("Cancel", "Cancelar")}
            </button>
            <button
              type="button"
              className="button primary"
              disabled={hook.busy}
              onClick={async () => {
                try {
                  await hook.run(confirm);
                  setConfirm(undefined);
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
      <ChatSettingsLayer chat={chat} />
    </main>
  );
}
