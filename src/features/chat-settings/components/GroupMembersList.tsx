import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChatSettingsDialog,
  ChatSettingsScreenSurface,
  MemberRowSurface,
} from "@/components/ui/chat-settings-surfaces";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useGroupMembers } from "../hooks/useGroupMembers";
import { useMemberConfirmation } from "../hooks/useMemberConfirmation";
import { useChatUIStore } from "../stores/uiStore";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";
export function GroupMembersList({
  chatId,
  context = "group",
  onBack,
}: {
  chatId: string;
  context?: "group" | "community";
  onBack?: () => void;
}) {
  const hook = useGroupMembers(chatId, context);
  const chat = hook.chat.data;
  const { user } = useAuth();
  const { say } = useMessageText();
  const ui = useChatUIStore();
  const [menu, setMenu] = useState<string | null>(null);
  const { confirm, setConfirm, error, setError, apply } = useMemberConfirmation(hook.run);
  if (!chat) return <ChatSettingsLoading query={hook.chat} />;
  if (!["group", "community_chat"].includes(chat.type)) return <ChatSettingsLoading />;
  const admin = chat.own?.role === "admin";
  return (
    <ChatSettingsScreenSurface
      as="section"
      id={context === "group" ? "main" : ""}
      className={context === "community" ? "community-members-panel" : ""}
      header={
        <>
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              {say("Back", "Volver")}
            </Button>
          ) : (
            <NavLink href={`/chats/${chatId}/info`}>
              ← {say("Group info", "Información del grupo")}
            </NavLink>
          )}
          <h1>
            {hook.members.length} {say("members", "miembros")}
          </h1>
          {admin && (
            <Button type="button" onClick={() => ui.open(chatId, { kind: "add" })}>
              + {say("Add", "Añadir")}
            </Button>
          )}
        </>
      }
    >
      <QueryState
        loading={hook.membersQuery.isPending}
        error={hook.membersQuery.error}
        retry={() => void hook.membersQuery.refetch()}
      />
      {(["admin", "member"] as const).map((role) => (
        <section className="chat-member-section" key={role}>
          <h2>
            {role === "admin" ? say("Admins", "Administradores") : say("Members", "Miembros")}
          </h2>
          {hook.members
            .filter((m) => m.role === role)
            .map((member) => (
              <MemberRowSurface key={member.user_id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="member-identity"
                  onClick={() => ui.open(chatId, { kind: "contact", userId: member.user_id })}
                >
                  <Avatar profile={member.profile ?? { id: member.user_id }} size="small" />
                  <span>
                    <strong>
                      {member.profile?.display_name ?? say("Member", "Miembro")}
                      {member.user_id === chat.createdBy &&
                        ` · ${context === "community" ? say("Owner", "Propietario") : say("Creator", "Creador")}`}
                    </strong>
                    <small>
                      @{member.profile?.username ?? "—"}{" "}
                      {role === "admin" && ` · ${say("Admin", "Administrador")}`}
                    </small>
                  </span>
                </Button>
                {admin && (
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${say("Member actions", "Acciones del miembro")}: ${member.profile?.display_name ?? member.user_id}`}
                      aria-expanded={menu === member.user_id}
                      onClick={() => setMenu(menu === member.user_id ? null : member.user_id)}
                    >
                      ⋮
                    </Button>
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
                            <Button
                              variant="ghost"
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
                                  : context === "community"
                                    ? say("Remove from community", "Eliminar de la comunidad")
                                    : say("Remove from group", "Eliminar del grupo")}
                            </Button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </MemberRowSurface>
            ))}
        </section>
      ))}
      {confirm && (
        <ChatSettingsDialog
          title={`${confirm.action === "remove" ? say("Remove", "Eliminar") : confirm.action === "promote" ? say("Promote", "Ascender") : say("Demote", "Degradar")} ${confirm.name}?`}
          onClose={() => setConfirm(undefined)}
          canClose={!hook.busy}
        >
          {(dismiss) => (
            <>
              {error && (
                <p role="alert">
                  {say(
                    "Unable to update this member. Your permissions may have changed.",
                    "No se pudo actualizar este miembro. Tus permisos pueden haber cambiado.",
                  )}
                </p>
              )}
              <div className="modal-actions">
                <Button type="button" variant="outline" disabled={hook.busy} onClick={dismiss}>
                  {say("Cancel", "Cancelar")}
                </Button>
                <Button type="button" disabled={hook.busy} onClick={apply}>
                  {say("Confirm", "Confirmar")}
                </Button>
              </div>
            </>
          )}
        </ChatSettingsDialog>
      )}
      <ChatSettingsLayer chat={chat} context={context} />
    </ChatSettingsScreenSurface>
  );
}
