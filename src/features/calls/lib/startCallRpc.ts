// start_call RPC entry point (Guardian round 2, AUD-006).
//
// Supabase-js methods are plain functions on the client, so assigning
// `supabase.rpc` to a standalone const and calling it detaches the
// receiver; the builder construction then throws
// `TypeError: Cannot read properties of undefined (reading 'rest')`
// before any request is made. The only correct invocation keeps the
// client bound: `rpc.call(client, ...)`. This module owns that one
// invocation and the regression test
// (tests/calls-start-rpc.test.ts) proves the real outgoing request
// reaches /rest/v1/rpc/start_call.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StartCallArgs {
  p_chat_id: string;
  p_type: "voice" | "video";
}

export interface StartCallRpcResult {
  data: unknown;
  error: { message: string } | null;
}

/** Generated database types predate migration 20261116120000; the RPC
 * union gains start_call after `pnpm db:types` runs against a migrated
 * environment. Until then the RPC entry point is invoked through this
 * single typed wrapper. */
type RpcEntry = (
  this: SupabaseClient,
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<StartCallRpcResult>;

export function invokeStartCall(
  client: SupabaseClient,
  args: StartCallArgs,
): PromiseLike<StartCallRpcResult> {
  const rpc = client.rpc as unknown as RpcEntry;
  // Receiver preserved: the client must stay bound as `this`, otherwise
  // PostgREST builder construction fails before the request is issued.
  return rpc.call(client, "start_call", { ...args });
}
