import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import cleanup from "../netlify/functions/cleanup-deleted-accounts.ts";
import { inAppNotification } from "../src/features/settings/notifications.ts";
import { AVATAR_GRADIENTS, getGradientForUser, getInitials } from "../src/lib/avatar.ts";
import { normalizeSocialLinks, socialHref } from "../src/lib/social-links.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
process.env.SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-only";
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
test("avatar uses the first SHA-256 byte, and Unicode-safe initials", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id)));
  assert.deepEqual(await getGradientForUser(id), AVATAR_GRADIENTS[(hash[0] ?? 0) % 12]);
  assert.deepEqual(await getGradientForUser(id), await getGradientForUser(id));
  assert.equal(
    getInitials({ first_name: "Ada", last_name: "Lovelace", display_name: "", username: "" }),
    "AL",
  );
  assert.equal(getInitials({ first_name: "Ada", display_name: "", username: "" }), "AA");
  assert.equal(getInitials({ display_name: "Ángela María Ruiz", username: "" }), "ÁR");
  assert.equal(getInitials({ display_name: "", username: "jordi" }), "JO");
});
test("social fields accept arbitrary strings but render unsafe schemes inert", () => {
  const links = normalizeSocialLinks({
    twitter: " javascript:alert(1) ",
    discord: "a".repeat(600),
    custom: [
      null,
      { url: 22 },
      ...Array.from({ length: 25 }, () => ({ label: " hello ", url: " just text " })),
    ],
  });
  assert.equal(links.twitter, "javascript:alert(1)");
  assert.equal(links.discord?.length, 500);
  assert.equal(links.custom?.length, 20);
  assert.equal(links.custom?.[0]?.label, "hello");
  assert.equal(socialHref("javascript:alert(1)"), undefined);
  assert.equal(socialHref("data:text/html,hi"), undefined);
  assert.equal(socialHref("//example.test"), undefined);
  assert.equal(socialHref("https://example.test"), "https://example.test/");
});
test("in-app notification switches suppress notifications, sound and previews", () => {
  const on = {
    notifications_enabled: true,
    notification_sound_enabled: true,
    notification_previews_enabled: true,
  };
  assert.deepEqual(inAppNotification(on, "private text", "New message"), {
    text: "private text",
    sound: true,
  });
  assert.equal(
    inAppNotification({ ...on, notifications_enabled: false }, "private text", "New message"),
    null,
  );
  assert.deepEqual(
    inAppNotification(
      { ...on, notification_sound_enabled: false, notification_previews_enabled: false },
      "private text",
      "New message",
    ),
    { text: "New message", sound: false },
  );
});
test("cleanup removes tracked Storage objects before admin deletion and skips cancellation", async () => {
  let batches = 0;
  const deletes: string[] = [];
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname.endsWith("/profiles") && !url.searchParams.has("id")) {
      batches++;
      return response(
        batches === 1
          ? [
              {
                id: "eeeeeeee-1111-4111-8111-111111111111",
                scheduled_deletion_at: "2000-01-01T00:00:00Z",
              },
              {
                id: "eeeeeeee-2222-4222-8222-222222222222",
                scheduled_deletion_at: "2000-01-01T00:00:00Z",
              },
            ]
          : [],
      );
    }
    if (url.pathname.endsWith("/profiles")) {
      if (url.searchParams.get("id")?.startsWith("gt.")) return response([]);
      return response({
        scheduled_deletion_at:
          url.searchParams.get("id") === "eq.eeeeeeee-2222-4222-8222-222222222222"
            ? null
            : "2000-01-01T00:00:00Z",
      });
    }
    if (url.pathname.endsWith("/file_uploads"))
      return response([{ bucket: "avatars", path: "due/avatar.webp" }]);
    if (url.pathname.includes("/storage/")) return response([]);
    if (url.pathname.includes("/admin/users/")) {
      deletes.push(url.pathname);
      return response({ user: { id: "eeeeeeee-1111-4111-8111-111111111111" } });
    }
    throw new Error(`Unexpected mock route ${url.pathname}`);
  };
  const result = await cleanup();
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { total: 2, deleted: 1, failed: 0 });
  assert.equal(deletes.length, 1);
  assert.ok(deletes[0]?.endsWith("/eeeeeeee-1111-4111-8111-111111111111"));
  assert.ok(
    calls.indexOf("DELETE /storage/v1/object/avatars") <
      calls.indexOf("DELETE /auth/v1/admin/users/eeeeeeee-1111-4111-8111-111111111111"),
  );
});
test("cleanup retains accounts for retry if Storage removal fails", async () => {
  let deletion = false;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/profiles")) {
      if (url.searchParams.get("id")?.startsWith("gt.")) return response([]);
      return response(
        url.searchParams.get("id")
          ? { scheduled_deletion_at: "2000-01-01T00:00:00Z" }
          : [
              {
                id: "eeeeeeee-1111-4111-8111-111111111111",
                scheduled_deletion_at: "2000-01-01T00:00:00Z",
              },
            ],
      );
    }
    if (url.pathname.endsWith("/file_uploads"))
      return response([{ bucket: "avatars", path: "due/avatar.webp" }]);
    if (url.pathname.includes("/storage/"))
      return response({ message: "storage unavailable" }, 503);
    deletion = true;
    throw new Error("Must not delete auth user");
  };
  const result = await cleanup();
  assert.equal(result.status, 500);
  assert.equal(deletion, false);
  assert.deepEqual(await result.json(), { total: 1, deleted: 0, failed: 1 });
});
