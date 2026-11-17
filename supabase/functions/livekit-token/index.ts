// Prompt #12 — LiveKit token Edge Function.
// Validates authentication, call activity/recency and chat membership with
// the service role (RLS on calls may block the callee's cross-user read of
// the caller's row), then mints a short-lived LiveKit access token.
// Secrets (set via `supabase secrets set`): LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are auto-provided.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AccessToken } from "https://esm.sh/livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const { call_id: callId } = await req.json();
    if (!callId || typeof callId !== "string") {
      return json({ error: "call_id required" }, 400);
    }

    // Validate the call with the service role: an atomic check the callee's
    // RLS view cannot fully perform (it must see the caller's ringing row).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: call, error: callError } = await admin
      .from("calls")
      .select("id, chat_id, livekit_room_name, status, started_at")
      .eq("id", callId)
      .single();

    if (callError || !call) return json({ error: "call not found" }, 404);

    if (!["ringing", "answered"].includes(call.status)) {
      return json({ error: "call not active" }, 400);
    }

    // Tokens are only minted for calls younger than 5 minutes; joining an
    // answered call minutes later is a reconnect, handled in a later fase.
    const callAge = Date.now() - new Date(call.started_at).getTime();
    if (callAge > 5 * 60 * 1000) return json({ error: "call expired" }, 400);

    const { data: member } = await admin
      .from("chat_members")
      .select("chat_id")
      .eq("chat_id", call.chat_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) return json({ error: "not a chat member" }, 403);

    // 15 minutes: LiveKit's practical JWT ceiling for this MVP. Longer calls
    // would need a refresh flow (Fase 2).
    const accessToken = new AccessToken(
      Deno.env.get("LIVEKIT_API_KEY")!,
      Deno.env.get("LIVEKIT_API_SECRET")!,
      { identity: user.id, ttl: "15m" },
    );
    accessToken.addGrant({
      roomJoin: true,
      room: call.livekit_room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return json(
      { token: await accessToken.toJwt(), url: Deno.env.get("LIVEKIT_URL"), room: call.livekit_room_name },
      200,
    );
  } catch (error) {
    console.error("[livekit-token]", error);
    return json({ error: "internal", detail: String(error) }, 500);
  }
});
