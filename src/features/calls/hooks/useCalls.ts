// Call log query (6.2): last 100 calls across my active chats, shaped
// client-side (isOutgoing, other participant, self-chat removal).
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import type { CallLogEntry } from "../lib/callState";
import type { CallParticipant, CallStatus, CallType } from "../types";

const callsKey = (userId: string) => ["calls", userId] as const;

interface CallsQueryRow {
  id: string;
  chat_id: string;
  type: CallType;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  decline_reason: string | null;
  ended_reason: string | null;
  initiator_id: string | null;
  chat: { id: string; type: string; direct_pair_key: string | null };
}

interface MembershipRow {
  chat_id: string;
}

interface ProfileRow {
  id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
}

async function fetchCalls(userId: string): Promise<CallLogEntry[]> {
  // RLS (calls_select) already restricts rows to active chats I am a member
  // of; the membership pre-fetch only narrows the IN list.
  const { data: memberships, error: membersError } = await supabase
    .from("chat_members")
    .select("chat_id")
    .eq("user_id", userId);
  if (membersError) throw membersError;
  const chatIds = ((memberships ?? []) as MembershipRow[]).map((row) => row.chat_id);
  if (!chatIds.length) return [];

  const { data: rows, error } = await supabase
    .from("calls")
    .select(
      `id, chat_id, type, status, started_at, answered_at, ended_at,
       duration_seconds, decline_reason, ended_reason, initiator_id,
       chat:chats!calls_chat_id_fkey(id, type, direct_pair_key)`,
    )
    .in("chat_id", chatIds)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const calls = (rows ?? []) as unknown as CallsQueryRow[];
  const selfCalls = calls.filter((call) => call.chat.type !== "self");
  const otherIds = [
    ...new Set(
      selfCalls.map(
        (call) =>
          call.chat.direct_pair_key?.split("::").find((id) => id !== userId) ?? call.initiator_id,
      ),
    ),
  ].filter((id): id is string => !!id);
  const { data: profiles } = otherIds.length
    ? await supabase
        .from("profiles_visible")
        .select("id, username, display_name, avatar_url, last_seen_at")
        .in("id", otherIds)
    : { data: [] as ProfileRow[] | null };

  const toParticipant = (
    profile: ProfileRow | undefined,
    otherId: string | null,
  ): CallParticipant => {
    if (profile?.id) {
      return {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        last_seen_at: profile.last_seen_at,
      };
    }
    return {
      id: otherId ?? "",
      display_name: otherId ? `User ${otherId.replace(/-/g, "").slice(0, 8)}` : null,
    };
  };

  return selfCalls.map((call) => {
    const otherId =
      call.chat.direct_pair_key?.split("::").find((id) => id !== userId) ?? call.initiator_id;
    const other = (profiles ?? []).find((profile) => profile.id === otherId);
    return {
      id: call.id,
      chatId: call.chat_id,
      type: call.type,
      status: call.status,
      startedAt: call.started_at,
      answeredAt: call.answered_at,
      endedAt: call.ended_at,
      durationSeconds: call.duration_seconds,
      declineReason: call.decline_reason,
      endedReason: call.ended_reason,
      isOutgoing: call.initiator_id === userId,
      other: toParticipant(other, otherId),
    };
  });
}

export function useCalls() {
  const { user, mfaRequired } = useAuth();
  return useQuery({
    queryKey: callsKey(user?.id ?? ""),
    queryFn: () => fetchCalls(user?.id ?? ""),
    enabled: !!user && !mfaRequired,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
