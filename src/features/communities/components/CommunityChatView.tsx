import { useMessageText } from "@/features/messages/i18n";
import { NavLink, QueryState } from "@/features/settings/components/shared";
import { Conversation } from "@/routes/_authenticated.chats.$chatId";
import { useCommunityConversation } from "../hooks/useCommunityConversation";
import { CommunityChatHeader } from "./CommunityChatHeader";
export function CommunityChatView({
  communityId,
  chatId,
  scrollTo,
}: {
  communityId: string;
  chatId: string;
  scrollTo?: string;
}) {
  const { chat, valid, readError, retryRead } = useCommunityConversation(communityId, chatId);
  const { say } = useMessageText();
  if (!valid)
    return (
      <main id="main" className="p-6">
        <NavLink href={`/communities/${communityId}`}>← {say("Back", "Volver")}</NavLink>
        <QueryState loading={chat.isPending} error={chat.error} retry={() => void chat.refetch()} />
        {chat.isSuccess && (
          <p>
            {say("Chat unavailable in this community.", "Chat no disponible en esta comunidad.")}
          </p>
        )}
      </main>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      {readError && (
        <button type="button" className="text-sm text-destructive" onClick={retryRead}>
          {say("Unable to mark read. Retry", "No se pudo marcar como leído. Reintentar")}
        </button>
      )}
      <Conversation key={chatId} chatId={chatId} Header={CommunityChatHeader} scrollTo={scrollTo} />
    </div>
  );
}
