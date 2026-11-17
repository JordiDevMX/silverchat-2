// Regression test for Guardian round-2 finding AUD-006: the start_call RPC
// must be invoked with the Supabase client bound as the receiver, and the
// outgoing request must carry the right URL and payload. Uses the real
// @supabase/supabase-js builder machinery with a stubbed fetch, so a
// detached receiver (`Cannot read properties of undefined (reading 'rest')`)
// or a never-issued request both fail this test.
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

process.env.NODE_ENV ??= "test";

interface CapturedRequest {
  url: string;
  method: string | undefined;
  body: string | null;
}

const captured: CapturedRequest[] = [];

// Patch fetch before the client issues anything. The stub returns the
// PostgREST success shape Supabase expects.
const stubFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  captured.push({
    url: String(input),
    method: init?.method,
    body: typeof init?.body === "string" ? init.body : null,
  });
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

const client = createClient("http://localhost:54321", "test-anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: stubFetch as unknown as typeof fetch },
});

test("start_call is invoked with the client receiver and issues the RPC request", async () => {
  const mod = await import("../src/features/calls/lib/startCallRpc.ts");
  // Before the fix under audit this line detached the receiver and threw:
  // "Cannot read properties of undefined (reading 'rest')" — awaited
  // through the thenable PostgREST builder.
  const { invokeStartCall } = mod;
  const { data, error } = await invokeStartCall(client, {
    p_chat_id: "11111111-1111-4111-8111-111111111111",
    p_type: "voice",
  });

  const request = captured.at(-1);
  assert.ok(request, "the RPC call must issue exactly one HTTP request");
  assert.match(
    request.url,
    /\/rest\/v1\/rpc\/start_call/,
    "the request must target the start_call RPC endpoint",
  );
  assert.equal(request.method, "POST", "RPC invocation must be a PostgREST POST");
  assert.ok(
    /"p_chat_id":"11111111-1111-4111-8111-111111111111"/.test(request.body ?? ""),
    "the request body must carry p_chat_id",
  );
  assert.match(request.body ?? "", /"p_type":"voice"/, "the request body must carry p_type");
  assert.equal(error, null, "a 200 PostgREST response must surface no error");
  assert.deepEqual(data, {}, "the stubbed POST response body is surfaced as data");
});
