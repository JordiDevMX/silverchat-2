// Incoming call pipeline (7.2): a realtime INSERT on calls is only a hint.
// The verdict ("can this call still be answered?") comes from
// answerable_incoming_calls(), which measures the ring window on the server
// clock, so a wrong PC clock can neither drop a live call nor ring an expired
// or canceled one. The same function recovers calls missed while briefly
// disconnected. Local decisions (expired/busy) live in lib/callState.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { busyRejectCall } from "../lib/callActions";
import { decideIncomingCall } from "../lib/callState";
import { enterIncomingCall, useCallStore } from "../stores/callStore";
import type { CallParticipant, IncomingCallVerdict } from "../types";

export function useIncomingCall(userId: string | undefined) {
  // Realtime payloads for the same call can race the catch-up query; process
  // each call id once per session (sync marker before any await).
  const queryClient = useQueryClient();
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!userId) return;
    const seen = handled.current;

    const resolvePeer = async (verdict: IncomingCallVerdict, viewerId: string) => {
      const { data: chat } = await supabase
        .from("chats")
        .select("direct_pair_key")
        .eq("id", verdict.chat_id)
        .maybeSingle();
      const otherId =
        chat?.direct_pair_key?.split("::").find((id) => id !== viewerId) ?? verdict.initiator_id;
      if (!otherId) return;
      const { data: other } = await supabase
        .from("profiles_visible")
        .select("id, username, display_name, avatar_url, last_seen_at")
        .eq("id", otherId)
        .maybeSingle();
      const participant: CallParticipant = other?.id
        ? {
            id: other.id,
            username: other.username,
            display_name: other.display_name,
            avatar_url: other.avatar_url,
            last_seen_at: other.last_seen_at,
          }
        : { id: otherId, display_name: `User ${otherId.replace(/-/g, "").slice(0, 8)}` };
      enterIncomingCall(
        {
          id: verdict.id,
          chatId: verdict.chat_id,
          type: verdict.type,
          roomName: verdict.livekit_room_name,
          initiatorId: verdict.initiator_id,
        },
        participant,
        verdict.expires_in_ms,
      );
    };

    const handle = async (callId: string) => {
      if (seen.has(callId)) return;
      seen.add(callId);
      // Expired, canceled, answered, own and non-member rows return nothing:
      // the server verdict already covers what used to be client-side checks.
      const { data, error } = await supabase.rpc("answerable_incoming_calls", {
        p_call_id: callId,
      });
      if (error) {
        seen.delete(callId); // let the next hint or catch-up retry
        return;
      }
      const verdict = data?.[0];
      if (!verdict) return;
      const decision = decideIncomingCall(verdict, useCallStore.getState().phase);
      if (decision.kind === "ignore") return;
      if (decision.kind === "busy-reject") {
        await busyRejectCall(verdict.id);
        return;
      }
      await resolvePeer(verdict, userId);
    };

    // Belt and suspenders (7.2): recover answerable rows the realtime event
    // missed. Same server verdict, so no local clock is involved.
    const catchUp = async () => {
      const { data } = await supabase.rpc("answerable_incoming_calls");
      for (const row of data ?? []) await handle(row.id);
    };

    const refreshHistory = () => queryClient.invalidateQueries({ queryKey: ["calls", userId] });
    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        ({ new: call }) => {
          void refreshHistory();
          if (call.status === "ringing") void handle(call.id);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "calls" },
        () => void refreshHistory(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void refreshHistory();
          void catchUp();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
