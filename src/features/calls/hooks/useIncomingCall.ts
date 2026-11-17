// Incoming call pipeline (7.2): realtime INSERT on calls + a mount-time
// catch-up query for events missed while briefly disconnected. Decisions
// (self / stale / busy-reject / ring) live in lib/callState and are tested.
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { busyRejectCall } from "../lib/callActions";
import { decideIncomingCall } from "../lib/callState";
import { enterIncomingCall, useCallStore } from "../stores/callStore";
import type { CallParticipant, IncomingCallRow } from "../types";

export function useIncomingCall(userId: string | undefined) {
  // Realtime payloads for the same call can race the catch-up query; process
  // each call id once per session (sync marker before any await).
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!userId) return;
    const seen = handled.current;

    const resolvePeer = async (call: IncomingCallRow, viewerId: string) => {
      const { data: chat } = await supabase
        .from("chats")
        .select("direct_pair_key")
        .eq("id", call.chat_id)
        .maybeSingle();
      const otherId =
        chat?.direct_pair_key?.split("::").find((id) => id !== viewerId) ?? call.initiator_id;
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
          id: call.id,
          chatId: call.chat_id,
          type: call.type,
          roomName: call.livekit_room_name,
          initiatorId: call.initiator_id,
        },
        participant,
        new Date().toISOString(),
      );
    };

    const handle = async (call: IncomingCallRow) => {
      if (seen.has(call.id)) return;
      seen.add(call.id);
      const decision = decideIncomingCall(call, userId, useCallStore.getState().phase);
      if (decision.kind === "ignore") return;
      // Defense in depth: membership check before ringing or rejecting.
      const { data: member } = await supabase
        .from("chat_members")
        .select("chat_id")
        .eq("chat_id", call.chat_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!member) return;
      if (decision.kind === "busy-reject") {
        await busyRejectCall(call.id);
        return;
      }
      await resolvePeer(call, userId);
    };

    // Belt and suspenders (7.2): catch ringing rows the realtime event missed.
    const catchUp = async () => {
      const since = new Date(Date.now() - 15_000).toISOString();
      const { data: rows } = await supabase
        .from("calls")
        .select("id, chat_id, initiator_id, status, type, started_at, livekit_room_name")
        .eq("status", "ringing")
        .gt("started_at", since)
        .order("started_at", { ascending: false });
      for (const row of rows ?? []) await handle(row as IncomingCallRow);
    };

    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls" },
        ({ new: call }) => void handle(call as IncomingCallRow),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void catchUp();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
