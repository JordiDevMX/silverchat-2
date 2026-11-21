import assert from "node:assert/strict";
import jsQR from "jsqr";
import { launchBrowser } from "./lib/browser.mjs";

const origin = process.env.UI_BASE_URL ?? process.env.TEST_ORIGIN ?? "http://127.0.0.1:5175";

const me = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const peerAdminId = "00000000-0000-4000-8000-000000000003";
const memberId = "00000000-0000-4000-8000-000000000004";
const grpId = "00000000-0000-4000-8000-000000000101";
const chId = "00000000-0000-4000-8000-000000000201";
const commId = "00000000-0000-4000-8000-000000000301";
const genChatId = "00000000-0000-4000-8000-000000000302";
const avisosChatId = "00000000-0000-4000-8000-000000000303";
const invId = "00000000-0000-4000-8000-000000000401";
const reqId = "00000000-0000-4000-8000-000000000501";

const now = "2026-11-20T12:00:00Z";
const profiles = [
  {
    id: me,
    username: "alice",
    display_name: "Alice Me",
    avatar_url: null,
    bio: null,
    last_seen_at: now,
    social_links: {},
  },
  {
    id: ownerId,
    username: "bob_owner",
    display_name: "Bob Owner",
    avatar_url: null,
    bio: null,
    last_seen_at: now,
    social_links: {},
  },
  {
    id: peerAdminId,
    username: "carol_admin",
    display_name: "Carol Admin",
    avatar_url: null,
    bio: null,
    last_seen_at: now,
    social_links: {},
  },
  {
    id: memberId,
    username: "dave_member",
    display_name: "Dave Member",
    avatar_url: null,
    bio: null,
    last_seen_at: now,
    social_links: {},
  },
];

const extraContacts = Array.from({ length: 49 }, (_, i) => {
  const num = i + 1;
  const id = `00000000-0000-4000-8000-000000001${String(num).padStart(3, "0")}`;
  return {
    id,
    chatId: `00000000-0000-4000-8000-000000002${String(num).padStart(3, "0")}`,
    profile: {
      id,
      username: `contact_${String(num).padStart(2, "0")}`,
      display_name: `Contact ${String(num).padStart(2, "0")}`,
      avatar_url: null,
      bio: null,
      last_seen_at: now,
      social_links: {},
    },
  };
});
const allVisibleProfiles = [...profiles, ...extraContacts.map((c) => c.profile)];

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const browser = await launchBrowser();
const errors = [];

let groupRoleOwnerMode = false; // false => `me` is non-owner admin; true => `me` is owner
let commRoleMode = "moderator"; // "moderator" | "admin" | "owner"
let commSilencedUntil = null;
const rpcCalls = [];
const invitePayloads = [];

const jwt = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ sub: me, aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
const authUser = {
  id: me,
  email: "alice@example.test",
  aud: "authenticated",
  role: "authenticated",
  user_metadata: { username: "alice" },
  app_metadata: { provider: "email" },
  factors: [],
};

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await context.route("**/api/auth/**", (route) =>
    json(route, {
      accessToken: jwt,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      user: authUser,
      aal: "aal2",
      mfaRequired: false,
    }),
  );

  await context.route("**/auth/v1/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/user")) return json(route, authUser);
    if (u.pathname.endsWith("/factors")) return json(route, []);
    return json(route, {});
  });

  await context.routeWebSocket("**/realtime/v1/websocket**", (ws) =>
    ws.onMessage((raw) => {
      const msg = JSON.parse(raw);
      ws.send(
        JSON.stringify([
          msg[0],
          msg[1],
          msg[2],
          "phx_reply",
          { status: "ok", response: { postgres_changes: [] } },
        ]),
      );
    }),
  );

  await context.route("**/functions/v1/sign-channel-media", (route) =>
    json(route, { signedUrl: `${origin}/favicon.ico`, expiresIn: 900 }),
  );

  await context.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const body = req.postDataJSON?.() ?? {};
    const accept = req.headers().accept ?? "";
    const single = accept.includes("vnd.pgrst.object");
    const out = (rows) => json(route, single ? (rows[0] ?? null) : rows);

    if (p.includes("/rpc/")) {
      const fn = p.split("/rpc/").pop();
      rpcCalls.push({ fn, body });
      if (fn === "auth_mfa_satisfied") return json(route, true);
      if (fn === "get_group_invite") return json(route, "tok-abc-1234567890");
      if (fn === "rotate_group_invite") return json(route, "tok-rotated-999999");
      if (fn === "revoke_group_invite") return json(route, null);
      if (fn === "review_group_join_request") return json(route, null);
      if (fn === "update_group_info") return json(route, null);
      if (fn === "create_channel")
        return json(route, body.p_channel_id ?? "00000000-0000-4000-8000-000000000999");
      if (fn === "send_channel_invitations") {
        const batch = body.p_invitations ?? [];
        assert.ok(
          batch.length >= 1 && batch.length <= 50,
          `Expected <=50 batch, got ${batch.length}`,
        );
        invitePayloads.push(batch);
        if (invitePayloads.length === 1) {
          return json(
            route,
            batch.map((item) =>
              item.recipient_id === peerAdminId
                ? { recipient_id: item.recipient_id, ok: false, reason: "ineligible" }
                : { recipient_id: item.recipient_id, id: item.id, ok: true },
            ),
          );
        }
        if (invitePayloads.length === 2 && batch.length === 1) {
          return json(route, { code: "P0001", message: "Cross-batch failure on contact 51" }, 400);
        }
        return json(
          route,
          batch.map((item) => ({
            recipient_id: item.recipient_id,
            id: item.id,
            ok: true,
          })),
        );
      }
      if (fn === "get_channel_viewer_context")
        return json(route, { viewer_role: "admin", following: true });
      if (fn === "get_channel_staff") {
        return json(route, [
          {
            user_id: ownerId,
            role: "owner",
            joined_at: now,
            username: "bob_owner",
            display_name: "Bob Owner",
            avatar_url: null,
          },
          {
            user_id: me,
            role: "admin",
            joined_at: now,
            username: "alice",
            display_name: "Alice Me",
            avatar_url: null,
          },
        ]);
      }
      if (fn === "get_channel_messages") return json(route, []);
      if (fn === "get_chat_messages") return json(route, []);
      if (fn === "create_community_chat")
        return json(route, "00000000-0000-4000-8000-000000000304");
      if (fn === "mark_chat_as_read") return json(route, null);
      return json(route, null);
    }

    if (p.endsWith("/profiles")) return json(route, single ? profiles[0] : allVisibleProfiles);
    if (p.endsWith("/user_settings")) {
      return out([
        {
          user_id: me,
          theme: "light",
          accent: "blue",
          language: "en",
          read_receipts_enabled: true,
        },
      ]);
    }
    if (p.endsWith("/profiles_visible")) return out(allVisibleProfiles);
    if (p.endsWith("/chats")) {
      const id = u.searchParams.get("id")?.slice(3);
      const rows = [
        {
          id: grpId,
          type: "group",
          status: "active",
          name: "SRP Group",
          description: "Group desc",
          avatar_url: null,
          created_by: ownerId,
          owner_id: groupRoleOwnerMode ? me : ownerId,
          created_at: now,
          updated_at: now,
          only_admins_can_add_members: false,
          only_admins_can_share_link: false,
          only_admins_can_send: false,
          only_admins_can_edit_info: false,
          require_admin_approval: true,
        },
        {
          id: genChatId,
          type: "community_chat",
          status: "active",
          community_id: commId,
          name: "General",
          description: "Open community room",
          avatar_url: null,
          created_by: ownerId,
          owner_id: ownerId,
          system_role: null,
          write_policy: "all",
          created_at: now,
          updated_at: now,
        },
        {
          id: avisosChatId,
          type: "community_chat",
          status: "active",
          community_id: commId,
          name: "Official News",
          description: "Announcements",
          avatar_url: null,
          created_by: ownerId,
          owner_id: ownerId,
          system_role: "announcements",
          write_policy: "admins",
          created_at: now,
          updated_at: now,
        },
      ];
      return out(id ? rows.filter((r) => r.id === id) : rows);
    }
    if (p.endsWith("/chat_members")) {
      const sel = u.searchParams.get("select") ?? "";
      if (u.searchParams.get("chat.type") === "eq.direct") {
        return json(route, [
          {
            chat_id: "00000000-0000-4000-8000-000000000701",
            chat: {
              id: "00000000-0000-4000-8000-000000000701",
              type: "direct",
              status: "active",
              direct_pair_key: `${me}::${ownerId}`,
              last_message_at: now,
            },
          },
          {
            chat_id: "00000000-0000-4000-8000-000000000702",
            chat: {
              id: "00000000-0000-4000-8000-000000000702",
              type: "direct",
              status: "active",
              direct_pair_key: `${me}::${peerAdminId}`,
              last_message_at: now,
            },
          },
          ...extraContacts.map((c) => ({
            chat_id: c.chatId,
            chat: {
              id: c.chatId,
              type: "direct",
              status: "active",
              direct_pair_key: `${me}::${c.id}`,
              last_message_at: now,
            },
          })),
        ]);
      }
      if (sel === "chat_id, user_id" || sel === "chat_id,user_id") {
        return json(route, [
          { chat_id: "00000000-0000-4000-8000-000000000701", user_id: ownerId },
          { chat_id: "00000000-0000-4000-8000-000000000702", user_id: peerAdminId },
          ...extraContacts.map((c) => ({ chat_id: c.chatId, user_id: c.id })),
        ]);
      }
      if (sel.includes("chat:chats")) {
        return json(route, [
          {
            chat_id: genChatId,
            user_id: me,
            role: "member",
            joined_at: now,
            muted_until: null,
            pinned_at: null,
            manually_unread: false,
            chat: {
              id: genChatId,
              type: "community_chat",
              community_id: commId,
              name: "General",
              description: null,
              avatar_url: null,
              system_role: null,
              write_policy: "all",
              created_at: now,
              updated_at: now,
              last_message_at: null,
              last_message_preview: null,
            },
          },
          {
            chat_id: avisosChatId,
            user_id: me,
            role: "member",
            joined_at: now,
            muted_until: null,
            pinned_at: null,
            manually_unread: false,
            chat: {
              id: avisosChatId,
              type: "community_chat",
              community_id: commId,
              name: "Official News",
              description: null,
              avatar_url: null,
              system_role: "announcements",
              write_policy: "admins",
              created_at: now,
              updated_at: now,
              last_message_at: null,
              last_message_preview: null,
            },
          },
        ]);
      }
      return out([
        { chat_id: grpId, user_id: me, role: "admin", joined_at: now },
        { chat_id: grpId, user_id: ownerId, role: "admin", joined_at: now },
        { chat_id: grpId, user_id: peerAdminId, role: "admin", joined_at: now },
        { chat_id: grpId, user_id: memberId, role: "member", joined_at: now },
      ]);
    }
    if (p.endsWith("/group_join_requests")) {
      return out([
        {
          id: reqId,
          chat_id: grpId,
          requested_by: me,
          target_user_id: memberId,
          status: "pending",
          created_at: now,
        },
      ]);
    }
    if (p.endsWith("/channels_public")) {
      return out([
        {
          id: chId,
          name: "Tech Channel",
          slug: "tech-channel",
          description: "Updates",
          avatar_url: null,
          follower_count: 5,
          is_verified: false,
          created_at: now,
          updated_at: now,
          last_message_at: null,
          last_message_id: null,
          last_message_preview: null,
        },
      ]);
    }
    if (p.endsWith("/channel_followers")) {
      return out([
        { channel_id: chId, user_id: me, muted_until: null, last_read_at: now, followed_at: now },
      ]);
    }
    if (p.endsWith("/channel_invitations_received")) {
      return out([{ id: invId, channel_id: chId, status: "pending", created_at: now }]);
    }
    if (p.endsWith("/channel_invitations_sent")) return out([]);
    if (p.endsWith("/communities")) {
      return out([
        {
          id: commId,
          name: "SRP Community",
          description: "Main hub",
          avatar_url: null,
          owner_id: commRoleMode === "owner" ? me : ownerId,
          member_count: 4,
          created_at: now,
          updated_at: now,
        },
      ]);
    }
    if (p.endsWith("/community_members")) {
      const communityObj = {
        id: commId,
        name: "SRP Community",
        description: "Main hub",
        avatar_url: null,
        owner_id: commRoleMode === "owner" ? me : ownerId,
        member_count: 4,
        created_at: now,
        updated_at: now,
      };
      const uidFilter = u.searchParams.get("user_id");
      const rows = [
        {
          community_id: commId,
          user_id: me,
          role: commRoleMode === "moderator" ? "moderator" : "admin",
          joined_at: now,
          silenced_until: commSilencedUntil,
          silenced_by: null,
          silence_reason: null,
        },
        {
          community_id: commId,
          user_id: ownerId,
          role: "admin",
          joined_at: now,
          silenced_until: null,
          silenced_by: null,
          silence_reason: null,
        },
        {
          community_id: commId,
          user_id: memberId,
          role: "member",
          joined_at: now,
          silenced_until: null,
          silenced_by: null,
          silence_reason: null,
        },
      ]
        .filter((m) => !uidFilter || uidFilter.includes(m.user_id))
        .map((m) => ({
          ...m,
          ...(u.searchParams.get("select")?.includes("community:")
            ? { community: communityObj }
            : {}),
        }));
      return out(rows);
    }
    if (p.endsWith("/community_bans")) {
      return out([
        {
          community_id: commId,
          user_id: memberId,
          banned_by: ownerId,
          reason: "Spam",
          banned_at: now,
        },
      ]);
    }
    if (p.endsWith("/community_audit_logs")) {
      return out([
        {
          id: "log-1",
          community_id: commId,
          actor_id: ownerId,
          target_user_id: memberId,
          target_chat_id: null,
          action_type: "expel_member",
          reason: "Spam",
          details: {},
          created_at: now,
        },
      ]);
    }
    if (p.endsWith("/community_announcement_writers")) return out([]);
    if (p.endsWith("/chat_requests") || p.endsWith("/user_blocks") || p.endsWith("/stories"))
      return out([]);
    return out([]);
  });

  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (err) => errors.push(err.message));

  // 1. OC-08 Communities enabled & Official announcements badge
  await page.goto(`${origin}/communities/${commId}`);
  assert.equal(await page.getByRole("heading", { name: "Coming soon" }).count(), 0);
  await page.getByText("Official", { exact: true }).waitFor();

  // 2. Community info: Moderator sees read-only Blocked users + Audit log, NO Transfer ownership
  await page.goto(`${origin}/communities/${commId}/info`);
  await page.getByRole("button", { name: "Blocked users", exact: true }).click();
  await page.getByText("Moderators have read-only access.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Permit re-entry" }).count(), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Moderation audit log", exact: true }).click();
  await page.getByText("expel_member").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Transfer ownership" }).count(), 0);

  // 2b. Community admin (not owner) cannot see Promote admin & CAN use 10m / custom silence duration (Finding 5)
  commRoleMode = "admin";
  await page.reload();
  await page.getByRole("button", { name: "View members", exact: true }).click();
  const commMembersDialog = page.getByRole("dialog", { name: "Community members", exact: true });
  await commMembersDialog.getByText("Dave Member", { exact: true }).waitFor();
  assert.equal(
    await commMembersDialog.getByRole("button", { name: "Promote admin", exact: true }).count(),
    0,
  );
  await commMembersDialog.getByRole("button", { name: "Silence", exact: true }).click();
  const durationSelect = commMembersDialog.getByLabel("Duration", { exact: true });
  await durationSelect.selectOption("10m");
  await durationSelect.selectOption("custom");
  await commMembersDialog.getByLabel("Custom duration (minutes)", { exact: true }).fill("45");
  await Promise.all([
    page.waitForResponse((res) => res.url().includes("/rest/v1/rpc/silence_community_member")),
    commMembersDialog.getByRole("button", { name: "Confirm silence", exact: true }).click(),
  ]);
  await commMembersDialog
    .getByRole("button", { name: "Confirm silence", exact: true })
    .waitFor({ state: "detached" });
  const silenceCall = rpcCalls.findLast((c) => c.fn === "silence_community_member");
  assert.ok(silenceCall);
  const deltaMin = (Date.parse(silenceCall.body.p_silenced_until) - Date.now()) / 60_000;
  assert.ok(deltaMin >= 44 && deltaMin <= 46, `Expected ~45m silence, got ${deltaMin}`);
  await commMembersDialog.getByRole("button", { name: "Close", exact: true }).click();
  commRoleMode = "moderator";

  // Silenced member sees RestrictedComposerNotice with expiry
  commSilencedUntil = new Date(Date.now() + 3600_000).toISOString();
  await page.goto(`${origin}/communities/${commId}/chats/${genChatId}`);
  await page.getByText("You are silenced until", { exact: false }).waitFor();

  // 3. Group creation page: inline PhotoEditorPanel + 5 GroupPermissions switches & presets
  await page.goto(`${origin}/chats/new-group`);
  await page.getByRole("button", { name: "Restricted", exact: true }).click();
  const switches = page.getByRole("switch");
  assert.equal(await switches.count(), 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(await switches.nth(i).getAttribute("aria-checked"), "true");
  }

  // 4. Group info & OC-01 member actions + QR code with 4-module quiet zone + jsQR SVG decode
  await page.goto(`${origin}/chats/${grpId}/info`);
  await page.getByText("Group invite link", { exact: true }).waitFor();
  const qrSvg = page.getByRole("img", { name: "Group invite QR code", exact: true });
  await qrSvg.waitFor();
  const qrBox = await qrSvg.getAttribute("viewBox");
  const qrPathD = await qrSvg.locator("path").getAttribute("d");
  assert.ok(qrBox && qrPathD?.startsWith("M4,4h1v1h-1z"), "Expected 4-module quiet zone in QR SVG");
  const qrRaster = await qrSvg.evaluate(async (svgEl) => {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgText = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const size = 320;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size);
    return { width: data.width, height: data.height, rgba: Array.from(data.data) };
  });
  const svgDecoded = jsQR(new Uint8ClampedArray(qrRaster.rgba), qrRaster.width, qrRaster.height, {
    inversionAttempts: "dontInvert",
  });
  assert.equal(
    svgDecoded?.data,
    `${origin}/chats/join/tok-abc-1234567890`,
    "Rendered Group invite SVG QR must round-trip decode to exact invite URL",
  );
  await page.getByText("Pending join requests (1)").waitFor();
  await page.goto(`${origin}/chats/${grpId}/members`);
  await page.getByRole("heading", { name: /4 members/ }).waitFor();
  // Non-owner admin: NO menu button on Bob Owner or Carol Admin!
  assert.equal(await page.getByRole("button", { name: "Member actions: Bob Owner" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Member actions: Carol Admin" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Member actions: Dave Member" }).count(), 1);
  // Owner: sees Demote/Remove on Carol Admin
  groupRoleOwnerMode = true;
  await page.reload();
  await page.getByRole("button", { name: "Member actions: Carol Admin" }).click();
  await page.getByRole("button", { name: "Demote from admin", exact: true }).waitFor();
  await page.getByRole("button", { name: "Remove from group", exact: true }).waitFor();

  // 5. Novedades: channel-attributed invitation banner & 3-step CreateChannelModal
  await page.goto(`${origin}/novedades`);
  await page.getByText("You were invited to join 'Tech Channel'", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "Channel details", exact: true });
  await wizard.getByLabel("Name", { exact: true }).fill("New Waves");
  await wizard.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Channel photo", exact: true })
    .getByRole("button", { name: "Upload photo", exact: true })
    .waitFor();
  await page
    .getByRole("dialog", { name: "Channel photo", exact: true })
    .getByRole("button", { name: "Skip", exact: true })
    .click();
  const inviteDialog = page.getByRole("dialog", { name: "Invite contacts", exact: true });
  // Check all 51 contacts (>50 limit) to exercise 50+1 batching & cross-batch retry
  const checkboxes = inviteDialog.locator('input[type="checkbox"]');
  const totalContacts = await checkboxes.count();
  assert.equal(totalContacts, 51, "Expected 51 loaded direct contacts");
  for (let i = 0; i < totalContacts; i++) {
    await checkboxes.nth(i).check();
  }
  await inviteDialog.getByRole("button", { name: "Create channel", exact: true }).click();
  // Batch 1 (50): 49 Sent + Carol fails; Batch 2 (1): fails -> 49 Sent, 2 Retry needed
  await inviteDialog.getByRole("alert").waitFor();
  assert.equal(await inviteDialog.getByText("Sent", { exact: true }).count(), 49);
  assert.equal(await inviteDialog.getByText("Retry needed", { exact: true }).count(), 2);
  await inviteDialog.getByRole("button", { name: "Retry pending", exact: true }).click();
  await page.waitForURL("**/channels/**/info");
  assert.equal(invitePayloads.length, 3);
  assert.equal(invitePayloads[0].length, 50);
  assert.equal(invitePayloads[1].length, 1);
  assert.deepEqual(
    invitePayloads[2].map((x) => x.recipient_id),
    [peerAdminId, extraContacts[48].id],
  );

  // 6. Channel Info as admin (OC-02 no unfollow, OC-04 can report without owner block toggle)
  await page.goto(`${origin}/channels/${chId}/info`);
  assert.equal(await page.getByRole("button", { name: "Unfollow" }).count(), 0);
  await page.getByRole("button", { name: "Report channel", exact: true }).click();
  const reportModal = page.getByRole("dialog", { name: "Report channel" });
  assert.equal(await reportModal.getByRole("switch").count(), 0);
  await page.keyboard.press("Escape");

  // 7. Mobile layout responsiveness check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/chats/new-group`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.goto(`${origin}/communities/${commId}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

  assert.deepEqual(errors, []);
  console.log(
    "PASS: shared-roles-permissions browser E2E checks (desktop + mobile) passed cleanly!",
  );
} finally {
  await browser.close();
}
