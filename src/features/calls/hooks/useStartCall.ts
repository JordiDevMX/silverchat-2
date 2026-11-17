// Outgoing call start (9.2): permissions FIRST (L6), then start_call RPC,
// then resolve the peer and enter the outgoing-ringing phase.
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/lib/supabase";
import { requestCallPermissions } from "../lib/callActions";
import { enterOutgoingCall } from "../stores/callStore";
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
  return message.includes("already in a call") || message.includes("already in progress");
}

// start_call is created by migration 20261116120000; the generated RPC union
// lags behind until `pnpm db:types` runs against a migrated environment.
const rpc = supabase.rpc as unknown as (
  name: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

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

  const { data: callId, error } = await rpc("start_call", {
    p_chat_id: input.chatId,
    p_type: input.type,
  });
  if (error) {
    throw new CallStartError(isBusyError(error.message) ? "busy" : "error", error);
  }

  const { data: call, error: callError } = await supabase
    .from("calls")
    .select("id, chat_id, type, livekit_room_name, initiator_id")
    .eq("id", callId as string)
    .single();
  if (callError || !call) throw new CallStartError("error", callError);

  const other = await resolveParticipant(call.chat_id, userId);
  enterOutgoingCall(
    {
      id: call.id,
      chatId: call.chat_id,
      type: call.type,
      roomName: call.livekit_room_name,
      initiatorId: call.initiator_id,
    },
    other,
    new Date().toISOString(),
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
