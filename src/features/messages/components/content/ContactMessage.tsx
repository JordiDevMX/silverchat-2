import { Link } from "@tanstack/react-router";
import { Avatar } from "@/features/settings/components/shared";
import { useMessageText } from "../../i18n";
import type { Message } from "../../types";
export function ContactMessage({ message }: { message: Message }) {
  const { say } = useMessageText();
  const data = message.contact_data;
  const d = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const username =
    typeof d.username === "string" && /^[a-zA-Z0-9_]+$/.test(d.username) ? d.username : null;
  const name =
    typeof d.display_name === "string" ? d.display_name : (username ?? say("Contact", "Contacto"));
  return (
    <div className="message-contact">
      <Avatar
        profile={{
          id: typeof d.user_id === "string" ? d.user_id : "",
          display_name: name,
          username,
        }}
        size="small"
      />
      <div>
        <strong>{name}</strong>
        {username && (
          <>
            <small>@{username}</small>
            <Link to="/profile/$username" params={{ username }}>
              {say("Save contact", "Guardar contacto")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
