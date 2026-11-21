import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Ban,
  History,
  Megaphone,
  Shield,
  UserMinus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/features/auth/components";
import { useMessageText } from "@/features/messages/i18n";
import {
  canExpelTarget,
  canManageCommunityAdmins,
  canManageCommunityModerators,
  canSilenceTarget,
  canTransferCommunityOwnership,
  canUnbanCommunityMember,
  getRoleLabel,
  isSilenced,
  resolveCommunityRole,
} from "@/features/roles/lib/permissions";
import type { CommunityRole } from "@/features/roles/types";
import { Avatar, QueryState } from "@/features/settings/components/shared";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { useCommunityMembers } from "../hooks/useCommunityMembers";
import { refreshCommunities } from "../lib/cache";
import { communityApi } from "../lib/communityApi";
import type { Community } from "../types";

const SILENCE_DURATIONS = [
  { label: "15 minutes", ms: 15 * 60_000 },
  { label: "1 hour", ms: 60 * 60_000 },
  { label: "24 hours", ms: 24 * 60 * 60_000 },
  { label: "7 days", ms: 7 * 24 * 60 * 60_000 },
];

export function CommunityMembersModerationModal({
  community,
  onClose,
}: {
  community: Community;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const cache = useQueryClient();
  const membersQuery = useCommunityMembers(community.id);
  const api = communityApi(supabase);
  const [error, setError] = useState("");
  const [silenceTarget, setSilenceTarget] = useState<{ id: string; name: string } | null>(null);
  const [durationMs, setDurationMs] = useState(SILENCE_DURATIONS[1]?.ms ?? 60 * 60_000);
  const [reason, setReason] = useState("");
  const [expelTarget, setExpelTarget] = useState<{ id: string; name: string } | null>(null);
  const [expelReason, setExpelReason] = useState("");
  const [deleteMessages, setDeleteMessages] = useState(false);

  const actorRole: CommunityRole = resolveCommunityRole(
    community.role,
    user?.id,
    community.owner_id,
  );
  const manageAdmins = canManageCommunityAdmins(actorRole);
  const manageMods = canManageCommunityModerators(actorRole);

  const writersQuery = useQuery({
    queryKey: ["community-announcement-writers", user?.id, community.id],
    enabled: Boolean(user && manageMods),
    queryFn: async () => {
      const r = await supabase
        .from("community_announcement_writers")
        .select("user_id")
        .eq("community_id", community.id);
      if (r.error) throw r.error;
      return new Set((r.data ?? []).map((row) => row.user_id));
    },
  });

  const invalidateAll = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["community-members", user?.id, community.id] }),
      cache.invalidateQueries({
        queryKey: ["community-announcement-writers", user?.id, community.id],
      }),
      cache.invalidateQueries({ queryKey: ["community-audit-logs", user?.id, community.id] }),
      cache.invalidateQueries({ queryKey: ["community-bans", user?.id, community.id] }),
      refreshCommunities(cache, user?.id ?? ""),
    ]);
  };

  const runAction = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      setError("");
      setSilenceTarget(null);
      setExpelTarget(null);
      setReason("");
      setExpelReason("");
      setDeleteMessages(false);
      await invalidateAll();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Action failed"),
  });

  const members = membersQuery.data ?? [];
  const writers = writersQuery.data ?? new Set<string>();

  return (
    <Modal title={say("Community members", "Miembros de la comunidad")} onClose={onClose}>
      <div className="flex max-h-[75dvh] flex-col gap-3 overflow-y-auto">
        <QueryState
          loading={membersQuery.isPending}
          error={membersQuery.error}
          retry={() => void membersQuery.refetch()}
        />
        <ul className="flex flex-col gap-2">
          {members.map((m) => {
            const targetRole = resolveCommunityRole(m.role, m.user_id, community.owner_id);
            const silenced = isSilenced(m.silenced_until);
            const name = m.profile?.display_name ?? say("Member", "Miembro");
            const isSelf = m.user_id === user?.id;
            return (
              <li
                key={m.user_id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar profile={m.profile ?? { id: m.user_id }} size="small" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{m.profile?.username ?? "—"} · {getRoleLabel(targetRole, say)}
                        {silenced ? ` · ${say("Silenced", "Silenciado")}` : ""}
                        {targetRole === "moderator" && writers.has(m.user_id)
                          ? ` · ${say("Announcements", "Avisos")}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
                {!isSelf && (
                  <div className="flex flex-wrap gap-1.5">
                    {manageAdmins && targetRole === "member" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={runAction.isPending}
                        onClick={() =>
                          runAction.mutate(() => api.member(community.id, m.user_id, "promote"))
                        }
                      >
                        Promote admin
                      </Button>
                    )}
                    {manageAdmins && actorRole === "owner" && targetRole === "admin" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={runAction.isPending}
                        onClick={() =>
                          runAction.mutate(() => api.member(community.id, m.user_id, "demote"))
                        }
                      >
                        Demote admin
                      </Button>
                    )}
                    {manageMods && targetRole === "member" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={runAction.isPending}
                        onClick={() =>
                          runAction.mutate(() => api.appointModerator(community.id, m.user_id))
                        }
                      >
                        <Shield size={14} />
                        Make moderator
                      </Button>
                    )}
                    {manageMods && targetRole === "moderator" && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runAction.isPending}
                          onClick={() =>
                            runAction.mutate(() =>
                              api.setAnnouncementWriter(
                                community.id,
                                m.user_id,
                                !writers.has(m.user_id),
                              ),
                            )
                          }
                        >
                          <Megaphone size={14} />
                          {writers.has(m.user_id) ? "Revoke announcements" : "Allow announcements"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runAction.isPending}
                          onClick={() =>
                            runAction.mutate(() => api.removeModerator(community.id, m.user_id))
                          }
                        >
                          Remove moderator
                        </Button>
                      </>
                    )}
                    {canSilenceTarget(actorRole, targetRole) &&
                      (silenced ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runAction.isPending}
                          onClick={() =>
                            runAction.mutate(() => api.unsilenceMember(community.id, m.user_id))
                          }
                        >
                          <Volume2 size={14} />
                          Lift silence
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={runAction.isPending}
                          onClick={() => setSilenceTarget({ id: m.user_id, name })}
                        >
                          <VolumeX size={14} />
                          Silence
                        </Button>
                      ))}
                    {canExpelTarget(actorRole, targetRole) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={runAction.isPending}
                        onClick={() => {
                          setDeleteMessages(false);
                          setExpelReason("");
                          setExpelTarget({ id: m.user_id, name });
                        }}
                      >
                        <UserMinus size={14} />
                        Expel
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {silenceTarget && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <h3 className="text-sm font-semibold">Silence {silenceTarget.name}</h3>
            <label className="text-xs font-medium">
              Duration
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                value={durationMs}
                onChange={(e) => setDurationMs(Number(e.target.value))}
              >
                {SILENCE_DURATIONS.map((d) => (
                  <option key={d.label} value={d.ms}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium">
              Reason (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={runAction.isPending}
                onClick={() =>
                  runAction.mutate(() =>
                    api.silenceMember(
                      community.id,
                      silenceTarget.id,
                      new Date(Date.now() + durationMs).toISOString(),
                      reason.trim() || undefined,
                    ),
                  )
                }
              >
                Confirm silence
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runAction.isPending}
                onClick={() => setSilenceTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {expelTarget && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3">
            <h3 className="text-sm font-semibold">Expel & block {expelTarget.name}?</h3>
            <p className="text-xs text-muted-foreground">
              The member is removed from all community chats and blocked from rejoining until
              unbanned.
            </p>
            <label className="text-xs font-medium">
              Reason (optional)
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                maxLength={500}
                value={expelReason}
                onChange={(e) => setExpelReason(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={deleteMessages}
                onChange={(e) => setDeleteMessages(e.target.checked)}
              />
              Also delete member's recent messages across community chats
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={runAction.isPending}
                onClick={() =>
                  runAction.mutate(() =>
                    api.expelMember(
                      community.id,
                      expelTarget.id,
                      expelReason.trim() || undefined,
                      deleteMessages,
                    ),
                  )
                }
              >
                Confirm expulsion
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={runAction.isPending}
                onClick={() => setExpelTarget(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {say("Close", "Cerrar")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CommunityBansModal({
  community,
  onClose,
}: {
  community: Community;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const api = communityApi(supabase);
  const actorRole = resolveCommunityRole(community.role, user?.id, community.owner_id);
  const canUnban = canUnbanCommunityMember(actorRole);

  const bansQuery = useQuery({
    queryKey: ["community-bans", user?.id, community.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const r = await supabase
        .from("community_bans")
        .select("*")
        .eq("community_id", community.id)
        .order("banned_at", { ascending: false });
      if (r.error) throw r.error;
      const rows = r.data ?? [];
      if (!rows.length) return [];
      const profiles = await supabase
        .from("profiles_visible")
        .select("id, display_name, username, avatar_url")
        .in(
          "id",
          rows.map((b) => b.user_id),
        );
      const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
      return rows.map((b) => ({ ...b, profile: byId.get(b.user_id) }));
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (targetId: string) => api.unbanMember(community.id, targetId),
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["community-bans", user?.id, community.id] }),
        cache.invalidateQueries({ queryKey: ["community-audit-logs", user?.id, community.id] }),
      ]);
    },
  });

  return (
    <Modal title="Blocked community users" onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        <QueryState
          loading={bansQuery.isPending}
          error={bansQuery.error}
          retry={() => void bansQuery.refetch()}
        />
        {!canUnban && (
          <p className="text-xs text-muted-foreground">
            Moderators have read-only access. Only owners or admins can permit re-entry.
          </p>
        )}
        {bansQuery.isSuccess && bansQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No blocked users.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(bansQuery.data ?? []).map((ban) => (
              <li
                key={ban.user_id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {ban.profile?.display_name ?? ban.user_id.slice(0, 8)}
                  </p>
                  {ban.reason && (
                    <p className="truncate text-xs text-muted-foreground">Reason: {ban.reason}</p>
                  )}
                </div>
                {canUnban && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={unbanMutation.isPending}
                    onClick={() => unbanMutation.mutate(ban.user_id)}
                  >
                    <Ban size={14} />
                    Permit re-entry
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CommunityAuditLogModal({
  community,
  onClose,
}: {
  community: Community;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const logsQuery = useQuery({
    queryKey: ["community-audit-logs", user?.id, community.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const r = await supabase
        .from("community_audit_logs")
        .select("*")
        .eq("community_id", community.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  return (
    <Modal title="Moderation audit log" onClose={onClose}>
      <div className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto">
        <QueryState
          loading={logsQuery.isPending}
          error={logsQuery.error}
          retry={() => void logsQuery.refetch()}
        />
        {logsQuery.isSuccess && logsQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No moderation events recorded yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(logsQuery.data ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-0.5 rounded-lg border border-border/60 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <History size={13} />
                    {entry.action_type}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {entry.reason && <p className="text-muted-foreground">Reason: {entry.reason}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function TransferCommunityOwnershipModal({
  community,
  onClose,
}: {
  community: Community;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const membersQuery = useCommunityMembers(community.id);
  const api = communityApi(supabase);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  const actorRole = resolveCommunityRole(community.role, user?.id, community.owner_id);
  const candidates = (membersQuery.data ?? []).filter((m) =>
    canTransferCommunityOwnership(actorRole, user?.id, m.user_id),
  );

  const transferMutation = useMutation({
    mutationFn: () => api.transferOwnership(community.id, selectedId),
    onSuccess: async () => {
      await Promise.all([
        refreshCommunities(cache, user?.id ?? ""),
        cache.invalidateQueries({ queryKey: ["community-members", user?.id, community.id] }),
        cache.invalidateQueries({ queryKey: ["community-audit-logs", user?.id, community.id] }),
      ]);
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Transfer failed"),
  });

  return (
    <Modal title="Transfer community ownership" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Select any current member to become the new owner. Your role will become Admin.
        </p>
        <QueryState
          loading={membersQuery.isPending}
          error={membersQuery.error}
          retry={() => void membersQuery.refetch()}
        />
        <select
          className="rounded-md border border-border bg-background px-2.5 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Choose a member…</option>
          {candidates.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.profile?.display_name ?? m.user_id} (@{m.profile?.username ?? "—"}) · {m.role}
            </option>
          ))}
        </select>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!selectedId || transferMutation.isPending}
            onClick={() => transferMutation.mutate()}
          >
            <ArrowRightLeft size={14} />
            Confirm transfer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
