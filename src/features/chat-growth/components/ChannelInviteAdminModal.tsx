import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import {
  matchesUserFilter,
  type UserSearchResult,
  useDirectContacts,
  useUserSearch,
} from "@/features/chats/hooks/useUserSearch";
import { useMessageText } from "@/features/messages/i18n";
import { messageKey } from "@/features/messages/types";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { SupportedGrowthChatType } from "../types";

export function ChannelInviteAdminModal({
  chatType,
  chatName,
  inviteUrl,
  onClose,
}: {
  chatType: SupportedGrowthChatType;
  chatName: string;
  inviteUrl: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const notify = useChatUIStore((s) => s.notify);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const contacts = useDirectContacts();
  const search = useUserSearch(query);

  const isChannel = chatType === "channel";
  const title = isChannel
    ? say("Invite admins", "Invitar a administradores")
    : say("Invite members", "Invitar miembros");

  const inviteMessage = isChannel
    ? say(
        `Join me as an admin for '${chatName}' on SilverChat: ${inviteUrl}`,
        `Te invito a administrar '${chatName}' en SilverChat: ${inviteUrl}`,
      )
    : say(
        `Join '${chatName}' on SilverChat: ${inviteUrl}`,
        `Únete a '${chatName}' en SilverChat: ${inviteUrl}`,
      );

  const contactUsers = (contacts.data ?? [])
    .map((item) => item.user)
    .filter((u) => matchesUserFilter(u, query));
  const contactIds = new Set(contactUsers.map((u) => u.id));
  const otherUsers = search.hasQuery ? search.results.filter((u) => !contactIds.has(u.id)) : [];

  const copyLink = async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      notify(say("Invite link copied", "Enlace de invitación copiado"));
    } catch {
      setError(say("Unable to copy link. Try again.", "No se pudo copiar el enlace. Reintenta."));
    }
  };

  const sendInvite = async (target: UserSearchResult) => {
    if (!user?.id || sendingTo) return;
    setSendingTo(target.id);
    setError("");
    try {
      const knownChatId = contacts.data?.find((item) => item.user.id === target.id)?.chatId;
      let targetChatId = knownChatId;
      if (!targetChatId) {
        const pairKey =
          user.id < target.id ? `${user.id}::${target.id}` : `${target.id}::${user.id}`;
        const existing = await supabase
          .from("chats")
          .select("id")
          .eq("direct_pair_key", pairKey)
          .eq("status", "active")
          .maybeSingle();
        if (existing.error) throw existing.error;
        targetChatId = existing.data?.id;
      }

      if (targetChatId) {
        const inserted = await supabase.from("messages").insert({
          id: crypto.randomUUID(),
          chat_id: targetChatId,
          sender_id: user.id,
          type: "text",
          content: inviteMessage,
        });
        if (inserted.error) throw inserted.error;
        void cache.invalidateQueries({ queryKey: messageKey(user.id, targetChatId) });
      } else {
        const rpc = await supabase.rpc("create_direct_chat_request", {
          p_target_user_id: target.id,
          p_initial_content: inviteMessage,
        });
        if (rpc.error) throw rpc.error;
      }

      void cache.invalidateQueries({ queryKey: ["chats"] });
      void cache.invalidateQueries({ queryKey: ["direct-contacts"] });
      void cache.invalidateQueries({ queryKey: ["message-requests"] });
      notify(
        say(
          `Invitation sent to ${target.display_name}`,
          `Invitación enviada a ${target.display_name}`,
        ),
      );
      onClose();
    } catch {
      setError(
        say(
          "Unable to send invitation. Try again.",
          "No se pudo enviar la invitación. Reinténtalo.",
        ),
      );
    } finally {
      setSendingTo(null);
    }
  };

  const renderUserRow = (target: UserSearchResult) => (
    <button
      key={target.id}
      type="button"
      className="chat-growth-invite-row"
      disabled={!!sendingTo}
      onClick={() => void sendInvite(target)}
    >
      <Avatar profile={target} size="small" />
      <span>
        <strong>{target.display_name}</strong>
        <small>@{target.username}</small>
      </span>
      <Send size={16} aria-hidden="true" />
    </button>
  );

  return (
    <MotionOverlay
      title={title}
      className="channel-overlay chat-growth-invite-modal"
      onClose={onClose}
      canClose={!sendingTo}
    >
      {(close) => (
        <>
          <div className="chat-growth-copy-row">
            <span className="chat-growth-invite-url">{inviteUrl}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {copied ? say("Copied", "Copiado") : say("Copy link", "Copiar enlace")}
            </Button>
          </div>

          <input
            type="search"
            className="input"
            aria-label={say("Search by name or username", "Buscar por nombre o usuario")}
            placeholder={say("Search by name or @username", "Buscar por nombre o @usuario")}
            value={query}
            disabled={!!sendingTo}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="chat-growth-invite-list">
            {contactUsers.map(renderUserRow)}
            {contacts.isPending && <p>{say("Loading…", "Cargando…")}</p>}
            {search.isLoading && <p role="status">{say("Searching…", "Buscando…")}</p>}
            {otherUsers.map(renderUserRow)}
            {!contacts.isPending &&
              !search.isLoading &&
              !contactUsers.length &&
              !otherUsers.length && (
                <p className="quiet-note">
                  {say("No matching contacts found.", "No se encontraron contactos.")}
                </p>
              )}
          </div>

          {error && <p role="alert">{error}</p>}

          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={!!sendingTo} onClick={close}>
              {say("Cancel", "Cancelar")}
            </Button>
          </div>
        </>
      )}
    </MotionOverlay>
  );
}
