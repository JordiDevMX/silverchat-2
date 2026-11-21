import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, RefreshCw, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CardSurface } from "@/components/ui/settings-row";
import type { ChatDetails } from "@/features/messages/types";
import {
  canShareGroupLink,
  isGroupStaff,
  resolveGroupRole,
} from "@/features/roles/lib/permissions";
import type { GroupPermissions } from "@/features/roles/types";
import { Avatar } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { refreshChatSettings } from "../lib/cache";
import { useChatUIStore } from "../stores/uiStore";

function extractPermissions(chat: ChatDetails): GroupPermissions {
  return {
    onlyAdminsCanAddMembers: Boolean(chat.onlyAdminsCanAddMembers),
    onlyAdminsCanShareLink: Boolean(chat.onlyAdminsCanShareLink),
    onlyAdminsCanSend: Boolean(chat.onlyAdminsCanSend),
    onlyAdminsCanEditInfo: Boolean(chat.onlyAdminsCanEditInfo),
    requireAdminApproval: Boolean(chat.requireAdminApproval),
  };
}

export function GroupInviteCard({ chat }: { chat: ChatDetails }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const notify = useChatUIStore((s) => s.notify);
  const [copied, setCopied] = useState(false);

  const role = resolveGroupRole(
    chat.own?.role === "admin" ? "admin" : "member",
    user?.id,
    chat.ownerId ?? chat.createdBy,
  );
  const canShare = canShareGroupLink(role, extractPermissions(chat));
  const staff = isGroupStaff(role);

  const inviteQuery = useQuery({
    queryKey: ["group-invite", user?.id ?? "", chat.id],
    enabled: canShare && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_group_invite", { p_chat_id: chat.id });
      if (error) throw error;
      return data;
    },
  });

  const rotateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rotate_group_invite", { p_chat_id: chat.id });
      if (error) throw error;
      return data;
    },
    onSuccess: (token) => {
      cache.setQueryData(["group-invite", user?.id ?? "", chat.id], token);
      notify("Invite link rotated. Previous links are now inactive.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("revoke_group_invite", { p_chat_id: chat.id });
      if (error) throw error;
    },
    onSuccess: () => {
      cache.setQueryData(["group-invite", user?.id ?? "", chat.id], null);
      notify("Invite link revoked.");
    },
  });

  if (!canShare) return null;

  const token = inviteQuery.data ?? null;
  const inviteUrl =
    token && typeof window !== "undefined" ? `${window.location.origin}/chats/join/${token}` : "";

  const copyLink = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    notify("Invite link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <CardSurface className="flex flex-col gap-3 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Link2 size={16} />
          Group invite link
        </span>
      </div>

      {inviteQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading invite link…</p>
      ) : token ? (
        <>
          <code className="block break-all rounded-md bg-muted px-2.5 py-2 text-xs">
            {inviteUrl}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            {staff && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rotateMutation.isPending || revokeMutation.isPending}
                  onClick={() => rotateMutation.mutate()}
                >
                  <RefreshCw size={14} />
                  Reset link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={rotateMutation.isPending || revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate()}
                >
                  <ShieldAlert size={14} />
                  Revoke link
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">No active invite link.</p>
          {staff && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={rotateMutation.isPending}
              onClick={() => rotateMutation.mutate()}
            >
              <RefreshCw size={14} />
              Generate invite link
            </Button>
          )}
        </div>
      )}
    </CardSurface>
  );
}

export function GroupJoinRequestsSection({ chat }: { chat: ChatDetails }) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const notify = useChatUIStore((s) => s.notify);

  const role = resolveGroupRole(
    chat.own?.role === "admin" ? "admin" : "member",
    user?.id,
    chat.ownerId ?? chat.createdBy,
  );
  const staff = isGroupStaff(role);

  const requestsQuery = useQuery({
    queryKey: ["group-join-requests", user?.id ?? "", chat.id],
    enabled: staff && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_join_requests")
        .select("*")
        .eq("chat_id", chat.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const userIds = [...new Set(rows.flatMap((r) => [r.target_user_id, r.requested_by]))];
      const profiles = await supabase
        .from("profiles_visible")
        .select("id, display_name, username, avatar_url")
        .in("id", userIds);
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        targetProfile: byId.get(r.target_user_id),
        requesterProfile: byId.get(r.requested_by),
      }));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_group_join_request", {
        p_request_id: requestId,
        p_approve: approve,
      });
      if (error) throw error;
      return approve;
    },
    onSuccess: (approve) => {
      void cache.invalidateQueries({ queryKey: ["group-join-requests", user?.id ?? "", chat.id] });
      void refreshChatSettings(cache, user?.id ?? "", chat.id);
      notify(approve ? "Join request approved" : "Join request declined");
    },
    onError: (err) => {
      notify(err instanceof Error ? err.message : "Could not process request");
    },
  });

  if (!staff || !requestsQuery.data?.length) return null;

  return (
    <CardSurface className="flex flex-col gap-2.5 p-3.5">
      <h3 className="text-sm font-semibold">Pending join requests ({requestsQuery.data.length})</h3>
      <ul className="flex flex-col gap-2">
        {requestsQuery.data.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Avatar profile={req.targetProfile ?? { id: req.target_user_id }} size="small" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {req.targetProfile?.display_name ?? "User"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{req.targetProfile?.username ?? req.target_user_id.slice(0, 8)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="default"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ requestId: req.id, approve: true })}
              >
                <UserCheck size={14} />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={reviewMutation.isPending}
                onClick={() => reviewMutation.mutate({ requestId: req.id, approve: false })}
              >
                <UserX size={14} />
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </CardSurface>
  );
}
