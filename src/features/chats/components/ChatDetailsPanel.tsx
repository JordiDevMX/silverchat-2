import { Images, Pin, Users } from "lucide-react";
import { useChat } from "@/features/messages/hooks/useChat";
import { usePinnedMessages } from "@/features/messages/hooks/usePinnedMessages";
import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";

export function ChatDetailsPanel({
  chatId,
  communityId,
}: {
  chatId: string;
  communityId?: string;
}) {
  const chat = useChat(chatId);
  const { say } = useMessageText();
  if (!chat.data || (communityId && chat.data.communityId !== communityId)) return null;
  const base = communityId ? `/communities/${communityId}/chats/${chatId}` : `/chats/${chatId}`;
  return (
    <aside className="chat-details-pane" aria-label={say("Chat details", "Detalles del chat")}>
      <h2>{say("Chat details", "Detalles del chat")}</h2>
      <PinnedSection chatId={chatId} base={base} />
      <NavLink className="detail-heading" href={`${base}/media?tab=media`}>
        <Images size={17} />
        {say("Shared media", "Archivos compartidos")}
      </NavLink>
      {["community_chat", "group"].includes(chat.data.type) && (
        <details>
          <summary className="detail-heading">
            <Users size={17} />
            {say("Members", "Miembros")} ({chat.data.members.length})
          </summary>
          <ul>
            {chat.data.members.map((member) => (
              <li key={member.user_id}>
                {member.profile?.display_name || say("Member", "Miembro")}
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

function PinnedSection({ chatId, base }: { chatId: string; base: string }) {
  const pins = usePinnedMessages(chatId);
  const { say } = useMessageText();
  return (
    <section>
      <h3 className="detail-heading">
        <Pin size={17} />
        {say("Pinned messages", "Mensajes fijados")}
      </h3>
      <QueryState loading={pins.isPending} error={pins.error} retry={() => void pins.refetch()} />
      {pins.data?.length === 0 && <p>{say("No pinned messages", "No hay mensajes fijados")}</p>}
      {pins.data?.map((message) => (
        <NavLink
          key={message.id}
          className="pinned-preview"
          href={`${base}?scrollTo=${message.id}`}
        >
          {message.content || say("Attachment", "Archivo adjunto")}
        </NavLink>
      ))}
    </section>
  );
}
