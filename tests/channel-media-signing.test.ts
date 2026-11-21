import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAvatarSigningTarget,
  resolveMediaSigningTarget,
} from "../src/features/messages/lib/channelMediaSigning.ts";

const UUID_CH = "11111111-1111-4111-8111-111111111111";
const UUID_USR = "22222222-2222-4222-8222-222222222222";
const UUID_UP = "33333333-3333-4333-8333-333333333333";
const UUID_MSG = "44444444-4444-4444-8444-444444444444";

test("resolveMediaSigningTarget routes channel-media via sign-channel-media edge function", () => {
  assert.deepEqual(
    resolveMediaSigningTarget(
      { id: UUID_UP, bucket: "channel-media", path: `${UUID_CH}/post.webp` },
      { channelId: UUID_CH, messageId: UUID_MSG, download: true },
    ),
    {
      mode: "edge",
      body: {
        kind: "channel_post_media",
        uploadId: UUID_UP,
        channelId: UUID_CH,
        download: true,
      },
    },
  );

  assert.deepEqual(
    resolveMediaSigningTarget(
      { id: UUID_UP, bucket: "channel-media", path: `${UUID_CH}/post.webp` },
      { messageId: UUID_MSG },
    ),
    {
      mode: "edge",
      body: {
        kind: "forwarded_channel_media",
        uploadId: UUID_UP,
        messageId: UUID_MSG,
        download: false,
      },
    },
  );

  assert.deepEqual(
    resolveMediaSigningTarget({
      id: UUID_UP,
      bucket: "channel-media",
      path: `${UUID_CH}/post.webp`,
    }),
    {
      mode: "edge",
      body: {
        kind: "channel_post_media",
        uploadId: UUID_UP,
        channelId: UUID_CH,
        download: false,
      },
    },
  );

  assert.deepEqual(
    resolveMediaSigningTarget({
      id: UUID_UP,
      bucket: "chat-media",
      path: `${UUID_USR}/photo.webp`,
    }),
    {
      mode: "storage",
      bucket: "chat-media",
      path: `${UUID_USR}/photo.webp`,
    },
  );
});

test("resolveAvatarSigningTarget isolates channel avatars onto sign-channel-media", () => {
  assert.deepEqual(resolveAvatarSigningTarget(`chat-${UUID_CH}/channel-123.webp`), {
    mode: "edge",
    body: {
      kind: "channel_avatar",
      channelId: UUID_CH,
      path: `chat-${UUID_CH}/channel-123.webp`,
    },
  });

  assert.deepEqual(resolveAvatarSigningTarget(`chat-${UUID_CH}/group-123.webp`), {
    mode: "storage",
    bucket: "avatars",
    path: `chat-${UUID_CH}/group-123.webp`,
  });

  assert.deepEqual(resolveAvatarSigningTarget(`community-${UUID_CH}/c-123.webp`), {
    mode: "storage",
    bucket: "avatars",
    path: `community-${UUID_CH}/c-123.webp`,
  });

  assert.deepEqual(resolveAvatarSigningTarget(`${UUID_USR}/avatar.webp`), {
    mode: "storage",
    bucket: "avatars",
    path: `${UUID_USR}/avatar.webp`,
  });

  assert.equal(resolveAvatarSigningTarget(""), null);
  assert.equal(resolveAvatarSigningTarget(null), null);
});
