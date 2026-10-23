import { Users } from "lucide-react";
import { useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import type { ChatDetails } from "@/features/messages/types";
import { AvatarPickerModal } from "@/features/settings/components/AvatarPickerModal";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { useGroupSettings } from "../hooks/useGroupSettings";
import { saveGroupAvatar } from "../lib/groupAvatar";
import { useChatUIStore } from "../stores/uiStore";
import { ChatSettingsLayer, ChatSettingsLoading } from "./ChatSettingsLayer";

function GroupFields({
  chat,
  busy,
  onSave,
}: {
  chat: ChatDetails;
  busy: boolean;
  onSave: (patch: { name?: string; description?: string }) => Promise<void>;
}) {
  const { say } = useMessageText();
  const [name, setName] = useState(chat.name);
  const [description, setDescription] = useState(chat.description ?? "");
  const [error, setError] = useState("");
  const save = async (field: "name" | "description") => {
    const value = field === "name" ? name : description;
    const original = field === "name" ? chat.name : (chat.description ?? "");
    if (value === original) return;
    if (field === "name" && !value.trim()) {
      setError(say("Group name is required.", "El nombre del grupo es obligatorio."));
      return;
    }
    setError("");
    try {
      await onSave({ [field]: value });
    } catch {
      setError(
        say(
          "Unable to save group details. Try again.",
          "No se pudieron guardar los datos del grupo. Inténtalo de nuevo.",
        ),
      );
    }
  };
  return (
    <>
      <label className="field">
        {say("Group name", "Nombre del grupo")}
        <input
          value={name}
          maxLength={100}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void save("name")}
        />
      </label>
      <label className="field">
        {say("Description", "Descripción")}
        <textarea
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
export function GroupSettingsScreen({ chatId }: { chatId: string }) {
  const hook = useGroupSettings(chatId);
  const chat = hook.chat.data;
  const { user } = useAuth();
  const { say, language } = useMessageText();
  const ui = useChatUIStore();
  const [photo, setPhoto] = useState(false);
  if (!chat) return <ChatSettingsLoading query={hook.chat} />;
  if (!["group", "community_chat"].includes(chat.type)) return <ChatSettingsLoading />;
  const admin = chat.own?.role === "admin";
  return (
    <main id="main" className="chat-settings-screen">
      <header>
        <NavLink href={`/chats/${chatId}`}>← {say("Back to chat", "Volver al chat")}</NavLink>
        <h1>{say("Group info", "Información del grupo")}</h1>
      </header>
      <div className="group-photo">
        {chat.avatar ? (
          <Avatar
            profile={{ id: chat.id, display_name: chat.name, avatar_url: chat.avatar }}
            size="large"
          />
        ) : (
          <span className="group-avatar-placeholder">
            <Users size={42} />
          </span>
        )}
        {admin && (
          <button type="button" className="button secondary" onClick={() => setPhoto(true)}>
            {say("Change photo", "Cambiar foto")}
          </button>
        )}
      </div>
      {admin ? (
        <GroupFields
          key={`${chat.name}:${chat.description}`}
          chat={chat}
          busy={hook.busy}
          onSave={hook.save}
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
        {chat.members.length} {say("members", "miembros")}
      </p>
      <nav className="group-links">
        <NavLink href={`/chats/${chatId}/members`}>
          {say("View members →", "Ver miembros →")}
        </NavLink>
        <NavLink href={`/chats/${chatId}/media?tab=media`}>
          {say("Shared media →", "Archivos compartidos →")}
        </NavLink>
      </nav>
      <button
        type="button"
        className="button danger"
        onClick={() => ui.open(chatId, { kind: "leave" })}
      >
        {say("Leave group", "Salir del grupo")}
      </button>
      {photo && admin && (
        <AvatarPickerModal
          profile={{ id: chat.id, avatar_url: chat.avatar }}
          onSave={(file) => saveGroupAvatar(chat.id, user?.id ?? "", file, chat.avatar, hook.save)}
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
      <ChatSettingsLayer chat={chat} />
    </main>
  );
}
