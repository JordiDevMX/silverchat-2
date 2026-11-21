import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "server_misconfigured" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const { data: mfaSatisfied, error: mfaError } = await userClient.rpc("auth_mfa_satisfied");
    if (mfaError || !mfaSatisfied) return json({ error: "mfa_required" }, 403);

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ error: "invalid_payload" }, 400);
    }

    const { kind, channelId, uploadId, messageId, path, download, filename } = payload as {
      kind?: unknown;
      channelId?: unknown;
      uploadId?: unknown;
      messageId?: unknown;
      path?: unknown;
      download?: unknown;
      filename?: unknown;
    };

    let rpcName: string;
    let rpcArgs: Record<string, unknown>;
    let ttlSeconds = 3600;

    if (kind === "channel_avatar") {
      if (
        typeof channelId !== "string" ||
        !UUID_RE.test(channelId) ||
        typeof path !== "string" ||
        !path
      ) {
        return json({ error: "channel_avatar requires channelId and path" }, 400);
      }
      rpcName = "authorize_channel_avatar_read";
      rpcArgs = { p_channel_id: channelId, p_path: path };
      ttlSeconds = 900;
    } else if (kind === "channel_post_media") {
      if (
        typeof uploadId !== "string" ||
        !UUID_RE.test(uploadId) ||
        typeof channelId !== "string" ||
        !UUID_RE.test(channelId)
      ) {
        return json({ error: "channel_post_media requires uploadId and channelId" }, 400);
      }
      rpcName = "authorize_channel_post_media_read";
      rpcArgs = { p_upload_id: uploadId, p_channel_id: channelId };
    } else if (kind === "forwarded_channel_media") {
      if (
        typeof uploadId !== "string" ||
        !UUID_RE.test(uploadId) ||
        typeof messageId !== "string" ||
        !UUID_RE.test(messageId)
      ) {
        return json({ error: "forwarded_channel_media requires uploadId and messageId" }, 400);
      }
      rpcName = "authorize_forwarded_channel_media_read";
      rpcArgs = { p_upload_id: uploadId, p_message_id: messageId };
    } else {
      return json({ error: "unsupported_kind" }, 400);
    }

    // Authorize under the caller's authenticated identity (RLS + SECURITY DEFINER guards).
    const { data: authData, error: rpcError } = await userClient.rpc(rpcName, rpcArgs);
    const row = Array.isArray(authData) ? authData[0] : authData;
    if (rpcError || !row?.bucket || !row?.path) {
      return json({ error: rpcError?.message ?? "forbidden" }, 403);
    }

    // Reserve service-role client strictly for signing after authorization passes.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const downloadOpt =
      download === true && kind !== "channel_avatar"
        ? { download: typeof filename === "string" && filename.trim() ? filename.trim() : true }
        : undefined;

    const { data: signed, error: signError } = await adminClient.storage
      .from(row.bucket)
      .createSignedUrl(row.path, ttlSeconds, downloadOpt);

    if (signError || !signed?.signedUrl) {
      return json({ error: signError?.message ?? "signing_failed" }, 500);
    }

    return json({ signedUrl: signed.signedUrl, expiresIn: ttlSeconds }, 200);
  } catch (err: unknown) {
    return json({ error: err instanceof Error ? err.message : "internal_error" }, 500);
  }
});
