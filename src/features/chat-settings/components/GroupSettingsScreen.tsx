import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatSettingsScreenSurface } from "@/components/ui/chat-settings-surfaces";
import { CardSurface } from "@/components/ui/settings-row";
import { CommunitySettingsActions } from "@/features/communities/components/CommunitySettingsActions";
import { communityApi } from "@/features/communities/lib/communityApi";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { GroupPermissionsControl } from "@/features/roles/components/GroupPermissionsControl";
import {
  canEditCommunityChatDescription,
  canEditCommunityChatName,
  canEditCommunityDescription,
  canEditCommunityName,
  canEditGroupInfo,
  isGroupStaff,
  resolveCommunityRole,
  resolveGroupRole,
} from "@/features/roles/lib/permissions";
import type { CommunityWritePolicy, GroupPermissions } from "@/features/roles/types";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useGroupFields } from "../hooks/useGroupFields";
import { useGroupSettings } from "../hooks/useGroupSettings";
import { refreshChatSettings } from "../lib/cache";
import { saveGroupAvatar } from "../lib/groupAvatar";
import { useChatUIStore } from "../stores/uiStore";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";
import { GroupInviteCard, GroupJoinRequestsSection } from "./GroupInviteSection";

function GroupFields({
  chat,
  busy,
  onSave,
  context = "group",
  canEditName = true,
  descriptionRef,
}: {
  chat: ChatDetails;
  busy: boolean;
  onSave: (patch: { name?: string; description?: string }) => Promise<void>;
  context?: "group" | "community";
  canEditName?: boolean;
  descriptionRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { say, name, setName, description, setDescription, error, save } = useGroupFields(
    chat,
    onSave,
  );
  return (
    <>
      <label className="field">
        {context === "community"
          ? say("Community name", "Nombre de la comunidad")
          : say("Group name", "Nombre del grupo")}
        <input
          value={name}
          maxLength={100}
          disabled={busy || !canEditName}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save("name")}
        />
      </label>
      <label className="field">
        {say("Description", "Descripción")}
        <textarea
          ref={descriptionRef}
          value={description}
          maxLength={500}
          rows={4}
          disabled={busy}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => void save("description")}
        />
      </label>
      <small>{description.length}/500</small>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function GroupSettingsScreen(
  props: { context?: "group"; chatId: string } | { context: "community"; communityId: string },
) {
  const context = props.context ?? "group";
  const chatId = props.context === "community" ? props.communityId : props.chatId;
  const hook = useGroupSettings(chatId, context);
  const chat = hook.chat.data;
  const { user } = useAuth();
  const cache = useQueryClient();
  const { say, language } = useMessageText();
  const ui = useChatUIStore();
  const [photo, setPhoto] = useState(false);
  const [permError, setPermError] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!chat) return;
    if (new URLSearchParams(window.location.search).get("focus") === "description") {
      descriptionRef.current?.focus();
    }
  }, [chat]);
  if (!chat) return <ChatSettingsLoading query={hook.chat} />;
  if (!["group", "community_chat"].includes(chat.type)) return <ChatSettingsLoading />;
  const groupRole = resolveGroupRole(
    chat.own?.role === "admin" ? "admin" : "member",
    user?.id,
    chat.ownerId ?? chat.createdBy,
  );
  const admin = isGroupStaff(groupRole);
  const groupPermissions: GroupPermissions = {
    onlyAdminsCanAddMembers: Boolean(chat.onlyAdminsCanAddMembers),
    onlyAdminsCanShareLink: Boolean(chat.onlyAdminsCanShareLink),
    onlyAdminsCanSend: Boolean(chat.onlyAdminsCanSend),
    onlyAdminsCanEditInfo: Boolean(chat.onlyAdminsCanEditInfo),
    requireAdminApproval: Boolean(chat.requireAdminApproval),
  };
  const commRole =
    context === "community" && hook.community
      ? resolveCommunityRole(hook.community.role, user?.id, hook.community.owner_id)
      : (chat.communityRole ?? "member");
  const canEditName =
    context === "community"
      ? canEditCommunityName(commRole)
      : chat.type === "community_chat"
        ? canEditCommunityChatName(commRole)
        : canEditGroupInfo(groupRole, groupPermissions);
  const canEdit =
    context === "community"
      ? canEditCommunityDescription(commRole)
      : chat.type === "community_chat"
        ? canEditCommunityChatDescription(commRole)
        : canEditGroupInfo(groupRole, groupPermissions);
  const canChangePhoto = context === "group" && chat.type === "group" ? canEdit : canEditName;
  const saveHandler =
    chat.type === "community_chat" && context === "group"
      ? async (patch: { name?: string; description?: string }) => {
          await communityApi(supabase).updateChatInfo(chat.id, patch);
          await refreshChatSettings(cache, user?.id ?? "", chat.id);
        }
      : hook.save;
  return (
    <ChatSettingsScreenSurface
      header={
        <>
          <NavLink href={context === "community" ? `/communities/${chatId}` : `/chats/${chatId}`}>
            ← {say("Back", "Volver")}
          </NavLink>
          <h1>
            {context === "community"
              ? say("Community info", "Información de la comunidad")
              : say("Group info", "Información del grupo")}
          </h1>
        </>
      }
    >
      <div className="group-photo">
        {chat.avatar ? (
          <Avatar
            profile={{
              id: chat.id,
              display_name: chat.name,
              avatar_url: chat.avatar,
            }}
            size="large"
          />
        ) : (
          <span className="group-avatar-placeholder">
            <Users size={42} />
          </span>
        )}
        {canChangePhoto && (
          <Button type="button" variant="outline" onClick={() => setPhoto(true)}>
            {say("Change photo", "Cambiar foto")}
          </Button>
        )}
      </div>
      <CardSurface className="chat-info-card" data-clipboard-reason="avatar-hint">
        {canEdit ? (
          <GroupFields
            key={`${chat.name}:${chat.description}`}
            chat={chat}
            busy={hook.busy}
            onSave={saveHandler}
            context={context}
            canEditName={canEditName}
            descriptionRef={descriptionRef}
          />
        ) : (
          <>
            <h2>{chat.name}</h2>
            <p className="group-description">{chat.description}</p>
          </>
        )}
        <p>
          {say("Created on", "Creado el")}{" "}
          {chat.createdAt
            ? new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(
                new Date(chat.createdAt),
              )
            : "—"}
        </p>
        <p>
          {hook.community?.member_count ?? chat.members.length} {say("members", "miembros")}
        </p>
      </CardSurface>
      {context === "community" && hook.community ? (
        <CommunitySettingsActions community={hook.community} chat={chat} />
      ) : (
        <>
          <nav className="group-links settings-card">
            <NavLink href={`/chats/${chatId}/members`}>
              {say("View members →", "Ver miembros →")}
            </NavLink>
            <NavLink href={`/chats/${chatId}/media?tab=media`}>
              {say("Shared media →", "Archivos compartidos →")}
            </NavLink>
          </nav>
          <GroupInviteCard chat={chat} />
          <GroupJoinRequestsSection chat={chat} />
          {chat.type === "group" && admin && (
            <CardSurface className="chat-permissions-card flex flex-col gap-3 p-3.5">
              <h3 className="text-sm font-semibold">
                {say("Group permissions", "Permisos del grupo")}
              </h3>
              <GroupPermissionsControl
                value={groupPermissions}
                disabled={hook.busy}
                onChange={(next) => {
                  setPermError("");
                  void hook
                    .save({
                      only_admins_can_add_members: next.onlyAdminsCanAddMembers,
                      only_admins_can_share_link: next.onlyAdminsCanShareLink,
                      only_admins_can_send: next.onlyAdminsCanSend,
                      only_admins_can_edit_info: next.onlyAdminsCanEditInfo,
                      require_admin_approval: next.requireAdminApproval,
                    })
                    .catch(() => {
                      setPermError(
                        say(
                          "Unable to update chat permissions. Please try again.",
                          "No se pudieron actualizar los permisos del chat. Inténtalo de nuevo.",
                        ),
                      );
                    });
                }}
              />
              {permError && (
                <p role="alert" className="text-sm text-destructive">
                  {permError}
                </p>
              )}
            </CardSurface>
          )}
          {chat.type === "community_chat" && canEditName && (
            <CardSurface className="chat-permissions-card flex flex-col gap-2 p-3.5">
              <h3 className="text-sm font-semibold">
                {say("Chat posting policy", "Política de publicación")}
              </h3>
              {chat.systemRole === "announcements" ? (
                <p className="text-xs text-muted-foreground">
                  {say(
                    "Official announcements chat: only owner/admins and explicitly granted moderators can post. Manage moderator grants in Community info.",
                    "Chat oficial de avisos: solo propietario, administradores y moderadores autorizados pueden publicar.",
                  )}
                </p>
              ) : (
                <select
                  className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
                  value={chat.writePolicy ?? "all"}
                  onChange={(e) => {
                    const nextPolicy = e.target.value as CommunityWritePolicy;
                    setPermError("");
                    void communityApi(supabase)
                      .updateChatInfo(chat.id, { writePolicy: nextPolicy })
                      .then(() => refreshChatSettings(cache, user?.id ?? "", chat.id))
                      .catch(() => {
                        setPermError(
                          say(
                            "Unable to update chat permissions. Please try again.",
                            "No se pudieron actualizar los permisos del chat. Inténtalo de nuevo.",
                          ),
                        );
                      });
                  }}
                >
                  <option value="all">{say("All members", "Todos los miembros")}</option>
                  <option value="moderators">
                    {say("Moderators, admins & owner", "Moderadores, admins y propietario")}
                  </option>
                  <option value="admins">{say("Admins & owner", "Admins y propietario")}</option>
                  <option value="owner_only">{say("Owner only", "Solo propietario")}</option>
                </select>
              )}
              {permError && (
                <p role="alert" className="text-sm text-destructive">
                  {permError}
                </p>
              )}
            </CardSurface>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={() => ui.open(chatId, { kind: "leave" })}
          >
            {say("Leave group", "Salir del grupo")}
          </Button>
        </>
      )}
      {photo && admin && (
        <AvatarPickerModal
          profile={{ id: chat.id, avatar_url: chat.avatar }}
          onSave={(file) =>
            saveGroupAvatar(chat.id, user?.id ?? "", file, chat.avatar, hook.save, context)
          }
          onSaved={(warning) =>
            ui.notify(
              warning
                ? say(
                    "Photo saved. Old photo cleanup is pending.",
                    "Foto guardada. La limpieza de la foto anterior está pendiente.",
                  )
                : say("Group photo updated", "Foto del grupo actualizada"),
            )
          }
          onClose={() => setPhoto(false)}
        />
      )}
      {context === "group" && <ChatSettingsLayer chat={chat} />}
    </ChatSettingsScreenSurface>
  );
}
