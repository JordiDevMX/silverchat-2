import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { useChatUIStore } from "@/features/chat-settings/stores/uiStore";
import {
  matchesUserFilter,
  type UserSearchResult,
  useDirectContacts,
} from "@/features/chats/hooks/useUserSearch";
import { useMessageText } from "@/features/messages/i18n";
import { parseChannelInvitationResults } from "@/features/novedades/lib/channelInvitations";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { SupportedGrowthChatType } from "../types";

export function ChannelInviteAdminModal({
  channelId,
  chatType,
  chatName,
  inviteUrl,
  onClose,
}: {
  channelId: string;
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
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");
  const contacts = useDirectContacts();

  const isChannel = chatType === "channel";
  const sentQuery = useQuery({
    queryKey: ["channel-invitations-sent", user?.id, channelId],
    enabled: Boolean(user && isChannel && channelId),
    queryFn: async () => {
      const r = await supabase
        .from("channel_invitations_sent")
        .select("*")
        .eq("channel_id", channelId);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const sentByRecipient = new Map(
    (sentQuery.data ?? [])
      .filter((row): row is typeof row & { recipient_id: string } => Boolean(row.recipient_id))
      .map((row) => [row.recipient_id, row.status ?? "pending"]),
  );

  const title = isChannel
    ? say("Invite contacts", "Invitar contactos")
    : say("Invite members", "Invitar miembros");

  const contactUsers = (contacts.data ?? [])
    .map((item) => item.user)
    .filter((u) => matchesUserFilter(u, query));

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
    if (!user?.id || !isChannel || sendingTo) return;
    setSendingTo(target.id);
    setError("");
    try {
      const rpc = await supabase.rpc("send_channel_invitations", {
        p_channel_id: channelId,
        p_invitations: [{ id: crypto.randomUUID(), recipient_id: target.id }],
      });
      if (rpc.error) throw rpc.error;

      const outcome = parseChannelInvitationResults(rpc.data, [target.id]);
      if (outcome.failed.length > 0) {
        setFailedIds((prev) => new Set([...prev, target.id]));
        throw new Error(
          say(
            `Could not invite ${target.display_name}.`,
            `No se pudo invitar a ${target.display_name}.`,
          ),
        );
      }

      setFailedIds((prev) => {
        const next = new Set(prev);
        next.delete(target.id);
        return next;
      });
      await cache.invalidateQueries({ queryKey: ["channel-invitations-sent", user.id, channelId] });
      notify(
        say(
          `Channel invitation sent for '${chatName}'`,
          `Invitación del canal '${chatName}' enviada`,
        ),
      );
      onClose();
    } catch (err) {
      setFailedIds((prev) => new Set([...prev, target.id]));
      setError(
        err instanceof Error
          ? err.message
          : say(
              "Unable to send invitation. Try again.",
              "No se pudo enviar la invitación. Reinténtalo.",
            ),
      );
    } finally {
      setSendingTo(null);
    }
  };

  const renderUserRow = (target: UserSearchResult) => {
    const existingStatus = sentByRecipient.get(target.id);
    const failed = failedIds.has(target.id);
    return (
      <button
        key={target.id}
        type="button"
        className="chat-growth-invite-row"
        disabled={!!sendingTo || Boolean(existingStatus)}
        onClick={() => void sendInvite(target)}
      >
        <Avatar profile={target} size="small" />
        <span>
          <strong>{target.display_name}</strong>
          <small>
            @{target.username}
            {existingStatus
              ? ` · ${existingStatus === "accepted" ? say("Accepted", "Aceptada") : say("Pending", "Pendiente")}`
              : failed
                ? ` · ${say("Retry needed", "Reintentar")}`
                : ""}
          </small>
        </span>
        <Send size={16} aria-hidden="true" />
      </button>
    );
  };

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

          {isChannel && (
            <>
              <input
                type="search"
                className="input"
                aria-label={say("Filter contacts", "Filtrar contactos")}
                placeholder={say(
                  "Filter contacts by name or @username",
                  "Filtrar contactos por nombre o @usuario",
                )}
                value={query}
                disabled={!!sendingTo}
                onChange={(event) => setQuery(event.target.value)}
              />

              <div className="chat-growth-invite-list">
                {contactUsers.map(renderUserRow)}
                {contacts.isPending && <p>{say("Loading…", "Cargando…")}</p>}
                {!contacts.isPending && !contactUsers.length && (
                  <p className="quiet-note">
                    {say("No matching contacts found.", "No se encontraron contactos.")}
                  </p>
                )}
              </div>
            </>
          )}

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
