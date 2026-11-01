import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getAvailableChatActions } from "../src/features/chat-settings/lib/chatActions.ts";
import {
  formatCommunityTimestamp,
  getAvailableCommunityActions,
  orderCommunities,
  orderCommunityChats,
} from "../src/features/communities/lib/communityActions.ts";
import { communityApi } from "../src/features/communities/lib/communityApi.ts";
import { communityDetails } from "../src/features/communities/lib/communityDetails.ts";
import type { Community, CommunityChat } from "../src/features/communities/types.ts";

const community: Community = {
  id: "community",
  name: "Friends",
  description: null,
  avatar_url: null,
  owner_id: "owner",
  member_count: 3,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  joined_at: "2026-01-01",
  role: "admin",
};
test("community timestamps cover hours, yesterday across month boundaries, weekdays and old dates", () => {
  const now = new Date(2026, 10, 1, 14);
  assert.match(
    formatCommunityTimestamp(new Date(2026, 10, 1, 12).toISOString(), "en", now),
    /2 hours ago/,
  );
  assert.equal(
    formatCommunityTimestamp(new Date(2026, 9, 31, 14).toISOString(), "en", now),
    "yesterday",
  );
  assert.equal(formatCommunityTimestamp(null, "en", now), "");
  assert.equal(formatCommunityTimestamp("invalid", "en", now), "");
  assert.match(formatCommunityTimestamp(new Date(2025, 0, 1).toISOString(), "en", now), /2025/);
});
test("community mutation hooks' RPC adapter sends exact arguments, retains null unmute and omitted info fields", async () => {
  const calls: unknown[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: name.startsWith("create") ? "new-id" : null, error: null };
    },
  } as unknown as Parameters<typeof communityApi>[0];
  const api = communityApi(client);
  assert.equal(await api.create({ name: "  Friends  " }), "new-id");
  await api.createChat("community", { name: " Plans ", description: "Friday" });
  await api.leave("community");
  await api.mute("community", null);
  await api.update("community", { description: "", avatar_url: "" });
  await api.delete("community");
  for (const action of ["promote", "demote", "remove"] as const)
    await api.member("community", "member", action);
  await api.join("community", "member");
  assert.deepEqual(calls, [
    ["create_community", { p_name: "Friends", p_description: "" }],
    [
      "create_community_chat",
      { p_community_id: "community", p_name: "Plans", p_description: "Friday" },
    ],
    ["leave_community", { p_community_id: "community" }],
    ["mute_community", { p_community_id: "community", p_muted_until: null }],
    [
      "update_community_info",
      { p_community_id: "community", p_name: undefined, p_description: "", p_avatar_url: "" },
    ],
    ["delete_community", { p_community_id: "community" }],
    ["promote_community_admin", { p_community_id: "community", p_user_id: "member" }],
    ["demote_community_admin", { p_community_id: "community", p_user_id: "member" }],
    ["remove_community_member", { p_community_id: "community", p_user_id: "member" }],
    ["join_community", { p_community_id: "community", p_user_id: "member" }],
  ]);
});
test("community RPC failures reject, including partial add and permission changes", async () => {
  const error = { message: "Community admin required", code: "42501" };
  const api = communityApi({ rpc: async () => ({ data: null, error }) } as unknown as Parameters<
    typeof communityApi
  >[0]);
  for (const call of [
    () => api.create({ name: "X" }),
    () => api.createChat("c", { name: "X" }),
    () => api.leave("c"),
    () => api.mute("c", null),
    () => api.update("c", { name: "X" }),
    () => api.delete("c"),
    () => api.join("c", "u"),
    () => api.member("c", "u", "remove"),
  ])
    await assert.rejects(call, (e) => e === error);
});
test("community card order is newest first with stable ties, without mutating cache arrays", () => {
  const items = [
    { ...community, id: "b" },
    { ...community, id: "new", created_at: "2026-02-01" },
    { ...community, id: "a" },
  ];
  assert.deepEqual(
    orderCommunities(items).map((c) => c.id),
    ["new", "a", "b"],
  );
  assert.equal(items[0]?.id, "b");
});
test("card previews order last activity descending with never-used chats last and deterministic ties", () => {
  const row = (id: string, at: string | null, created = "2026-01-01") =>
    ({ id, last_message_at: at, created_at: created }) as CommunityChat;
  const chats = [
    row("empty", null),
    row("older", "2026-02-01"),
    row("b", "2026-03-01"),
    row("a", "2026-03-01"),
  ];
  assert.deepEqual(
    orderCommunityChats(chats)
      .slice(0, 3)
      .map((c) => c.id),
    ["a", "b", "older"],
  );
  assert.equal(chats[0]?.id, "empty");
});
test("community chat action matrix never exposes group membership, block or report actions", () => {
  const chat = communityDetails(community, [], "owner");
  assert.deepEqual(getAvailableChatActions(chat), [
    "view_community_info",
    "search_in_chat",
    "mute",
    "mark_unread",
    "pin",
    "clear_chat",
  ]);
  if (chat.own) {
    chat.own.muted_until = "9999-12-31T23:59:59Z";
    chat.own.pinned_at = "2026-01-01";
    chat.own.role = "member";
  }
  assert.deepEqual(getAvailableChatActions(chat), [
    "view_community_info",
    "search_in_chat",
    "unmute",
    "mark_unread",
    "unpin",
    "clear_chat",
  ]);
});
test("community settings actions distinguish members, admins and owners who may leave", () => {
  assert.deepEqual(getAvailableCommunityActions(community, "member", false, false, false), [
    "view_info",
    "view_members",
    "mute",
    "leave",
  ]);
  assert.deepEqual(getAvailableCommunityActions(community, "admin", true, false, true), [
    "view_info",
    "view_members",
    "unmute",
    "add_members",
    "create_chat",
    "leave",
  ]);
  assert.ok(getAvailableCommunityActions(community, "owner", true, true, false).includes("delete"));
  assert.ok(
    !getAvailableCommunityActions(community, "stranger", true, true, false).includes("delete"),
  );
});
test("shared settings adapter protects the current owner after succession, not the original creator", () => {
  const details = communityDetails(
    { ...community, owner_id: "successor" },
    [{ community_id: "community", user_id: "successor", role: "admin", joined_at: "2026-01-02" }],
    "owner",
  );
  assert.equal(details.createdBy, "successor");
  assert.equal(details.members[0]?.role, "admin");
  assert.equal(details.communityId, "community");
});
test("migration has the required RPC privilege boundary and both succession triggers", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/0014_communities.sql", import.meta.url),
    "utf8",
  );
  for (const name of [
    "create_community",
    "create_community_chat",
    "leave_community",
    "mute_community",
    "update_community_info",
    "remove_community_member",
    "promote_community_admin",
    "demote_community_admin",
    "delete_community",
  ]) {
    const body = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`));
    const definition = body.slice(0, body.indexOf("$$;") + 3);
    assert.match(definition, /SECURITY DEFINER/);
    assert.match(definition, /SET search_path = ''/);
    assert.match(definition, /auth_mfa_satisfied/);
    assert.match(
      body,
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]+FROM PUBLIC, anon, service_role;`),
    );
  }
  assert.match(sql, /BEFORE DELETE ON public\.profiles/);
  assert.match(sql, /AFTER DELETE ON public\.community_members/);
  assert.equal(
    (sql.match(/CASE WHEN role = 'admin' THEN 0 ELSE 1 END,\s+joined_at ASC, user_id ASC/g) ?? [])
      .length,
    2,
  );
  assert.ok(sql.trimEnd().endsWith("COMMIT;"));
});
