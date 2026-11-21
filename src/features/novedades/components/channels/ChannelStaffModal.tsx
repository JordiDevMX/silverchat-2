import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, ShieldPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MotionOverlay } from "@/components/ui/motion-overlay";
import { useDirectContacts } from "@/features/chats/hooks/useUserSearch";
import { useMessageText } from "@/features/messages/i18n";
import { getRoleLabel } from "@/features/roles/lib/permissions";
import { Avatar, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { ChannelStaffMember, ChannelStaffRole } from "../../types";

export function ChannelStaffModal({
  channelId,
  staffRole,
  onClose,
}: {
  channelId: string;
  staffRole: ChannelStaffRole;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const contacts = useDirectContacts();
  const [error, setError] = useState("");
  const [confirmTransferId, setConfirmTransferId] = useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: ["channel-staff", user?.id ?? "", channelId],
    enabled: Boolean(user && staffRole),
    queryFn: async (): Promise<ChannelStaffMember[]> => {
      const r = await supabase.rpc("get_channel_staff", { p_channel_id: channelId });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const invalidate = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["channel-staff", user?.id ?? "", channelId] }),
      cache.invalidateQueries({ queryKey: ["channel-info", user?.id, channelId] }),
      cache.invalidateQueries({ queryKey: ["channels", user?.id] }),
    ]);
  };

  const appointMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await supabase.rpc("appoint_channel_admin", {
        p_channel_id: channelId,
        p_user_id: userId,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      setError("");
      void invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not appoint admin"),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await supabase.rpc("remove_channel_admin", {
        p_channel_id: channelId,
        p_user_id: userId,
      });
      if (r.error) throw r.error;
    },
    onSuccess: () => {
      setError("");
      void invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not remove admin"),
  });

  const transferMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      const r = await supabase.rpc("transfer_channel_ownership", {
        p_channel_id: channelId,
        p_new_owner_id: newOwnerId,
      });
      if (r.error) throw r.error;
    },
    onSuccess: async () => {
      setError("");
      setConfirmTransferId(null);
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not transfer ownership"),
  });

  const isOwner = staffRole === "owner";
  const busy = appointMutation.isPending || removeMutation.isPending || transferMutation.isPending;
  const staffIds = new Set((staffQuery.data ?? []).map((s) => s.user_id));
  const candidateContacts = (contacts.data ?? [])
    .map((item) => item.user)
    .filter((u) => !staffIds.has(u.id));

  return (
    <MotionOverlay
      title={say("Channel staff", "Equipo del canal")}
      className="channel-overlay channel-create-modal"
      onClose={onClose}
      canClose={!busy}
    >
      {(close) => (
        <div className="flex flex-col gap-4">
          <QueryState
            loading={staffQuery.isPending}
            error={staffQuery.error}
            retry={() => void staffQuery.refetch()}
          />
          <ul className="flex flex-col gap-2">
            {(staffQuery.data ?? []).map((member) => {
              const memberRole: ChannelStaffRole = member.role === "owner" ? "owner" : "admin";
              return (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar
                      profile={{
                        id: member.user_id,
                        display_name: member.display_name,
                        avatar_url: member.avatar_url,
                      }}
                      size="small"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.display_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{member.username} · {getRoleLabel(memberRole, say)}
                      </p>
                    </div>
                  </div>
                  {isOwner && memberRole === "admin" && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmTransferId(member.user_id)}
                      >
                        <ArrowRightLeft size={14} />
                        {say("Transfer", "Transferir")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => removeMutation.mutate(member.user_id)}
                      >
                        <Trash2 size={14} />
                        {say("Remove", "Quitar")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {confirmTransferId && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <p className="mb-2 font-medium">
                {say(
                  "Transfer channel ownership to this admin? You will become an admin.",
                  "¿Transferir la propiedad del canal a este administrador? Pasarás a ser administrador.",
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => transferMutation.mutate(confirmTransferId)}
                >
                  {say("Confirm transfer", "Confirmar transferencia")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmTransferId(null)}
                >
                  {say("Cancel", "Cancelar")}
                </Button>
              </div>
            </div>
          )}

          {isOwner && candidateContacts.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">
                {say("Appoint admin from contacts", "Nombrar administrador desde contactos")}
              </h3>
              <ul className="flex max-h-44 flex-col gap-1.5 overflow-y-auto">
                {candidateContacts.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar profile={c} size="small" />
                      <span className="truncate text-sm">{c.display_name}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => appointMutation.mutate(c.id)}
                    >
                      <ShieldPlus size={14} />
                      {say("Appoint", "Nombrar")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              {say("Close", "Cerrar")}
            </Button>
          </div>
        </div>
      )}
    </MotionOverlay>
  );
}
