import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MailPlus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardSurface } from "@/components/ui/settings-row";
import { useDirectContacts } from "@/features/chats/hooks/useUserSearch";
import { useMessageText } from "@/features/messages/i18n";
import { Avatar, NavLink } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshNovedades } from "../../lib/cache";
import { parseChannelInvitationResults } from "../../lib/channelInvitations";
import { type ChannelInvitationReceived, mapPublicChannelRow } from "../../types";

export function ChannelInvitationsBanner() {
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();

  const receivedQuery = useQuery({
    queryKey: ["channel-invitations-received", user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<ChannelInvitationReceived[]> => {
      const { data, error } = await supabase
        .from("channel_invitations_received")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []).filter((r): r is typeof r & { channel_id: string } =>
        Boolean(r.channel_id),
      );
      if (!rows.length) return [];
      const ids = [...new Set(rows.map((r) => r.channel_id))];
      const chRes = await supabase.from("channels_public").select("*").in("id", ids);
      if (chRes.error) throw chRes.error;
      const byId = new Map(
        (chRes.data ?? [])
          .filter((c): c is typeof c & { id: string } => Boolean(c.id))
          .map((c) => [c.id, mapPublicChannelRow(c)]),
      );
      return rows.map((r) => ({ ...r, channel: byId.get(r.channel_id) ?? null }));
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (inv: ChannelInvitationReceived) => {
      if (!inv.channel_id || !inv.id) return;
      const r = await supabase.rpc("follow_channel", {
        p_channel_id: inv.channel_id,
        p_invitation_id: inv.id,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["channel-invitations-received", user?.id] }),
        refreshNovedades(cache, user?.id ?? ""),
      ]);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const r = await supabase.rpc("dismiss_channel_invitation", { p_invitation_id: invitationId });
      if (r.error) throw r.error;
    },
    onSuccess: () =>
      void cache.invalidateQueries({ queryKey: ["channel-invitations-received", user?.id] }),
  });

  const items = receivedQuery.data ?? [];
  if (!items.length) return null;
  const busy = acceptMutation.isPending || dismissMutation.isPending;

  return (
    <section
      className="flex flex-col gap-2"
      aria-label={say("Channel invitations", "Invitaciones a canales")}
    >
      {items.map((inv) => (
        <CardSurface
          key={inv.id ?? inv.channel_id}
          className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {inv.channel && (
              <Avatar
                profile={{
                  id: inv.channel.id,
                  display_name: inv.channel.name,
                  avatar_url: inv.channel.avatar_url,
                }}
                size="small"
              />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {say(
                  `You were invited to join '${inv.channel?.name ?? "Channel"}'`,
                  `Te invitaron a unirte a '${inv.channel?.name ?? "Canal"}'`,
                )}
              </p>
              {inv.channel && (
                <NavLink
                  href={`/channels/${inv.channel.id}`}
                  className="text-xs text-muted-foreground underline"
                >
                  @{inv.channel.slug}
                </NavLink>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => acceptMutation.mutate(inv)}
            >
              <Check size={14} />
              {say("Follow", "Seguir")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inv.id && dismissMutation.mutate(inv.id)}
            >
              <X size={14} />
              {say("Dismiss", "Descartar")}
            </Button>
          </div>
        </CardSurface>
      ))}
    </section>
  );
}

export function ChannelInviteContactsPanel({ channelId }: { channelId: string }) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const contacts = useDirectContacts();
  const [failedRecipients, setFailedRecipients] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState("");

  const sentQuery = useQuery({
    queryKey: ["channel-invitations-sent", user?.id, channelId],
    enabled: Boolean(user),
    queryFn: async () => {
      const r = await supabase
        .from("channel_invitations_sent")
        .select("*")
        .eq("channel_id", channelId);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (recipientId: string) => {
      const r = await supabase.rpc("send_channel_invitations", {
        p_channel_id: channelId,
        p_invitations: [{ id: crypto.randomUUID(), recipient_id: recipientId }],
      });
      if (r.error) throw r.error;
      const outcome = parseChannelInvitationResults(r.data, [recipientId]);
      if (outcome.failed.length > 0) {
        setFailedRecipients((prev) => new Set([...prev, recipientId]));
        throw new Error(
          say(
            "Unable to invite this contact right now.",
            "No se pudo invitar a este contacto ahora.",
          ),
        );
      }
      setFailedRecipients((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
      return recipientId;
    },
    onSuccess: () => {
      setError("");
      void cache.invalidateQueries({ queryKey: ["channel-invitations-sent", user?.id, channelId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not send invitation"),
  });

  const sentByRecipient = new Map(
    (sentQuery.data ?? [])
      .filter((row): row is typeof row & { recipient_id: string } => Boolean(row.recipient_id))
      .map((row) => [row.recipient_id, row.status ?? "pending"]),
  );

  const list = (contacts.data ?? []).map((item) => item.user);
  if (!list.length) return null;

  return (
    <CardSurface className="flex flex-col gap-2.5 p-3.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MailPlus size={16} />
        {say("Invite contacts", "Invitar contactos")}
      </h3>
      <ul className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
        {list.map((contact) => {
          const status = sentByRecipient.get(contact.id);
          return (
            <li
              key={contact.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar profile={contact} size="small" />
                <span className="truncate text-sm">{contact.display_name}</span>
              </span>
              {status ? (
                <span className="text-xs font-medium capitalize text-muted-foreground">
                  {status === "accepted"
                    ? say("Accepted", "Aceptada")
                    : say("Pending", "Pendiente")}
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant={failedRecipients.has(contact.id) ? "destructive" : "outline"}
                  disabled={inviteMutation.isPending}
                  onClick={() => inviteMutation.mutate(contact.id)}
                >
                  {failedRecipients.has(contact.id)
                    ? say("Retry", "Reintentar")
                    : say("Invite", "Invitar")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </CardSurface>
  );
}
