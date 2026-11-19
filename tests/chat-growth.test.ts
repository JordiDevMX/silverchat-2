import assert from "node:assert/strict";
import test from "node:test";
import {
  growthDismissalKey,
  readGrowthDismissed,
  writeGrowthDismissed,
} from "../src/features/chat-growth/lib/dismissal.ts";
import {
  buildChannelGrowthModel,
  buildChatGrowthModel,
  buildStoryShareText,
  shouldAutoShowGrowthDialog,
} from "../src/features/chat-growth/lib/growthConfig.ts";
import type { Community } from "../src/features/communities/types.ts";
import type { ChatDetails } from "../src/features/messages/types.ts";
import type { Channel } from "../src/features/novedades/types.ts";

const makeChannel = (patch: Partial<Channel> = {}): Channel => ({
  id: "ch-1",
  name: "Silver Updates",
  slug: "silver-updates",
  description: null,
  avatar_url: "chat-ch-1/channel-1.webp",
  owner_id: "user-1",
  follower_count: 100,
  is_verified: false,
  created_at: "2026-11-19T00:00:00Z",
  updated_at: "2026-11-19T00:00:00Z",
  last_message_at: null,
  last_message_id: null,
  last_message_preview: null,
  ...patch,
});

const makeChat = (patch: Partial<ChatDetails> = {}): ChatDetails => ({
  id: "chat-1",
  type: "group",
  status: "active",
  name: "Weekend Crew",
  avatar: null,
  createdBy: "user-1",
  createdAt: "2026-11-19T00:00:00Z",
  description: null,
  members: [
    {
      chat_id: "chat-1",
      user_id: "user-1",
      role: "admin",
      joined_at: "2026-11-19T00:00:00Z",
      last_read_at: null,
      muted_until: null,
      pinned_at: null,
      archived_at: null,
      favorited_at: null,
      manually_unread: false,
    },
    {
      chat_id: "chat-1",
      user_id: "user-2",
      role: "member",
      joined_at: "2026-11-19T00:00:00Z",
      last_read_at: null,
      muted_until: null,
      pinned_at: null,
      archived_at: null,
      favorited_at: null,
      manually_unread: false,
    },
  ],
  own: {
    chat_id: "chat-1",
    user_id: "user-1",
    role: "admin",
    joined_at: "2026-11-19T00:00:00Z",
    last_read_at: null,
    muted_until: null,
    pinned_at: null,
    archived_at: null,
    favorited_at: null,
    manually_unread: false,
  },
  readOnly: false,
  ...patch,
});

test("shouldAutoShowGrowthDialog triggers exclusively for owner/admin on ready empty supported chats", () => {
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: true,
      isOwnerOrAdmin: true,
      messagesReady: true,
      messageCount: 0,
      dismissed: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: true,
      isOwnerOrAdmin: false,
      messagesReady: true,
      messageCount: 0,
      dismissed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: true,
      isOwnerOrAdmin: true,
      messagesReady: true,
      messageCount: 1,
      dismissed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: true,
      isOwnerOrAdmin: true,
      messagesReady: false,
      messageCount: 0,
      dismissed: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: true,
      isOwnerOrAdmin: true,
      messagesReady: true,
      messageCount: 0,
      dismissed: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoShowGrowthDialog({
      supported: false,
      isOwnerOrAdmin: true,
      messagesReady: true,
      messageCount: 0,
      dismissed: false,
    }),
    false,
  );
});

test("buildChannelGrowthModel formats owner copy, plurals, empty description, and actions", () => {
  const esOwner = buildChannelGrowthModel(
    makeChannel({ follower_count: 1 }),
    "user-1",
    "es",
    "https://app.test",
  );
  assert.equal(esOwner.type, "channel");
  assert.equal(esOwner.isOwnerOrAdmin, true);
  assert.equal(esOwner.isCreator, true);
  assert.equal(esOwner.title, "Creaste 'Silver Updates'");
  assert.equal(esOwner.subtitle, "Canal - 1 seguidor");
  assert.equal(esOwner.description, null);
  assert.equal(esOwner.emptyDescriptionLabel, "agregar una descripción");
  assert.equal(esOwner.primaryAction.label, "Compartir en mi estado");
  assert.equal(esOwner.primaryAction.icon, "share_status");
  assert.equal(esOwner.secondaryAction.label, "Invitar a administradores");
  assert.equal(esOwner.secondaryAction.icon, "plus");
  assert.equal(esOwner.inviteUrl, "https://app.test/channels/ch-1");

  const enPlural = buildChannelGrowthModel(
    makeChannel({ follower_count: 100, description: "News feed" }),
    "user-1",
    "en",
    "https://app.test",
  );
  assert.equal(enPlural.title, "You created 'Silver Updates'");
  assert.equal(enPlural.subtitle, "Channel - 100 followers");
  assert.equal(enPlural.description, "News feed");
  assert.equal(enPlural.primaryAction.label, "Share to my status");
  assert.equal(enPlural.secondaryAction.label, "Invite admins");

  const follower = buildChannelGrowthModel(makeChannel(), "user-2", "es", "https://app.test");
  assert.equal(follower.isOwnerOrAdmin, false);
});

test("buildChatGrowthModel distinguishes creator vs admin, handles groups/communities, and rejects direct/self", () => {
  assert.equal(
    buildChatGrowthModel(makeChat({ type: "direct" }), "user-1", "es", "https://app.test"),
    null,
  );
  assert.equal(
    buildChatGrowthModel(makeChat({ type: "self" }), "user-1", "es", "https://app.test"),
    null,
  );

  const creatorGroup = buildChatGrowthModel(makeChat(), "user-1", "es", "https://app.test");
  assert.ok(creatorGroup);
  assert.equal(creatorGroup.type, "group");
  assert.equal(creatorGroup.isOwnerOrAdmin, true);
  assert.equal(creatorGroup.isCreator, true);
  assert.equal(creatorGroup.title, "Creaste 'Weekend Crew'");
  assert.equal(creatorGroup.subtitle, "Grupo - 2 miembros");
  assert.equal(creatorGroup.secondaryAction.label, "Añadir miembros");
  assert.equal(creatorGroup.secondaryAction.icon, "user_plus");

  const nonCreatorAdmin = buildChatGrowthModel(
    makeChat({ createdBy: "user-99" }),
    "user-1",
    "es",
    "https://app.test",
  );
  assert.ok(nonCreatorAdmin);
  assert.equal(nonCreatorAdmin.isOwnerOrAdmin, true);
  assert.equal(nonCreatorAdmin.isCreator, false);
  assert.equal(nonCreatorAdmin.title, "Administras 'Weekend Crew'");

  const firstMember = makeChat().members[0];
  assert.ok(firstMember);
  const nonCreatorAdminEn = buildChatGrowthModel(
    makeChat({ createdBy: "user-99", members: [firstMember] }),
    "user-1",
    "en",
    "https://app.test",
  );
  assert.ok(nonCreatorAdminEn);
  assert.equal(nonCreatorAdminEn.title, "You manage 'Weekend Crew'");
  assert.equal(nonCreatorAdminEn.subtitle, "Group - 1 member");

  const ownMember = makeChat().own;
  assert.ok(ownMember);
  const regularMember = buildChatGrowthModel(
    makeChat({
      createdBy: "user-99",
      own: { ...ownMember, role: "member" },
    }),
    "user-1",
    "es",
    "https://app.test",
  );
  assert.ok(regularMember);
  assert.equal(regularMember.isOwnerOrAdmin, false);

  const community: Community = {
    id: "comm-1",
    name: "Local Devs",
    description: "Builders",
    avatar_url: null,
    owner_id: "user-1",
    member_count: 14,
    created_at: "2026-11-19T00:00:00Z",
    updated_at: "2026-11-19T00:00:00Z",
    role: "admin",
    joined_at: "2026-11-19T00:00:00Z",
  };
  const commChat = buildChatGrowthModel(
    makeChat({
      id: "chat-c1",
      type: "community_chat",
      name: "General",
      communityId: "comm-1",
      communityName: "Local Devs",
      description: "   ",
    }),
    "user-1",
    "es",
    "https://app.test",
    community,
  );
  assert.ok(commChat);
  assert.equal(commChat.type, "community_chat");
  assert.equal(commChat.subtitle, "Comunidad - 14 miembros");
  assert.equal(commChat.description, "Builders");
  assert.equal(commChat.inviteUrl, "https://app.test/communities/comm-1/chats/chat-c1");
});

test("buildStoryShareText stays within the 200-char story limit even for long chat names", () => {
  const longName = "A".repeat(180);
  const text = buildStoryShareText(
    "channel",
    longName,
    "https://silverchat.example/channels/12345678-1234-1234-1234-123456789012",
    "es",
  );
  assert.ok(text.length <= 200);
  assert.ok(text.includes("https://silverchat.example/channels/"));
});

test("dismissal storage persists per user, type, and chat and tolerates storage errors", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  assert.equal(readGrowthDismissed(storage, "u1", "channel", "c1"), false);
  writeGrowthDismissed(storage, "u1", "channel", "c1");
  assert.equal(readGrowthDismissed(storage, "u1", "channel", "c1"), true);
  assert.equal(readGrowthDismissed(storage, "u2", "channel", "c1"), false);
  assert.equal(readGrowthDismissed(storage, "u1", "group", "c1"), false);
  assert.equal(
    growthDismissalKey("u1", "channel", "c1"),
    "silverchat:growth-dismissed:u1:channel:c1",
  );

  const broken = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.equal(readGrowthDismissed(broken, "u1", "channel", "c1"), false);
  assert.doesNotThrow(() => writeGrowthDismissed(broken, "u1", "channel", "c1"));
});
