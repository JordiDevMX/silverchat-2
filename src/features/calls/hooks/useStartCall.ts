// Outgoing call start (9.2): permissions FIRST (L6), then start_call RPC,
// then resolve the peer and enter the outgoing-ringing phase.
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { requestCallPermissions } from "../lib/callActions";
import { invokeStartCall } from "../lib/startCallRpc";
import { enterOutgoingCall, useCallStore } from "../stores/callStore";
import type { CallParticipant, CallType } from "../types";

/** Typed start failure so the UI can pick the right toast. Parameter
 * properties are avoided (erasableSyntaxOnly tsconfig). */
export class CallStartError extends Error {
  kind: "permission" | "busy" | "error";
  constructor(kind: "permission" | "busy" | "error", cause?: unknown) {
    super(kind);
    this.kind = kind;
    this.cause = cause;
  }
}

function isBusyError(message: string): boolean {
  // Covers all three start_call rejections: caller busy ("You are already in
  // a call"), chat busy ("A call is already in progress in this chat") and
  // recipient busy ("The recipient is already in a call"), which embeds the
  // same suffix.
  return message.includes("already in a call") || message.includes("already in progress");
}

// Linting/typing note: the start_call union is absent from the generated
// types until `pnpm db:types` runs; invokeStartCall (lib/startCallRpc)
// owns the receiver-safe invocation, which was audited as AUD-006.

interface StartCallInput {
  chatId: string;
  type: CallType;
}

async function resolveParticipant(chatId: string, userId: string): Promise<CallParticipant> {
  const { data: chatRow } = await supabase
    .from("chats")
    .select("direct_pair_key")
    .eq("id", chatId)
    .single();
  // Direct chats carry an "id1::id2" pair key; a self chat has no peer.
  const otherId = chatRow?.direct_pair_key?.split("::").find((id) => id !== userId) ?? userId;
  const { data: other } = await supabase
    .from("profiles_visible")
    .select("id, username, display_name, avatar_url, last_seen_at")
    .eq("id", otherId)
    .maybeSingle();
  return other?.id
    ? {
        id: other.id,
        username: other.username,
        display_name: other.display_name,
        avatar_url: other.avatar_url,
        last_seen_at: other.last_seen_at,
      }
    : { id: otherId, display_name: `User ${otherId.replace(/-/g, "").slice(0, 8)}` };
}

async function startCall(input: StartCallInput, userId: string): Promise<void> {
  const granted = await requestCallPermissions(input.type === "video");
  if (granted !== "ok") throw new CallStartError(granted);

  const { data: callId, error } = await invokeStartCall(supabase, {
    p_chat_id: input.chatId,
    p_type: input.type,
  });
  if (error) {
    throw new CallStartError(isBusyError(error.message) ? "busy" : "error", error);
  }

  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("id, chat_id, type, livekit_room_name, initiator_id, status, decline_reason")
    .eq("id", callId as string)
    .single();
  if (callError || !call) throw new CallStartError("error", callError);

  const other = await resolveParticipant(call.chat_id, userId);
  if (call.decline_reason === "busy") {
    if (useCallStore.getState().phase === "idle") useCallStore.setState({ busyPeer: other });
    return;
  }
  enterOutgoingCall(
    {
      id: call.id,
      chatId: call.chat_id,
      type: call.type,
      roomName: call.livekit_room_name,
      initiatorId: call.initiator_id,
    },
    other,
  );
}

export function useStartCall() {
  const { user, mfaRequired } = useAuth();
  return useMutation({
    mutationFn: (input: StartCallInput) => {
      const userId = user?.id;
      if (!userId || mfaRequired) throw new CallStartError("error");
      return startCall(input, userId);
    },
  });
}
