import assert from "node:assert/strict";
import test from "node:test";
import {
  canSwipeReplyToMessage,
  classifySwipeIntent,
  computeIndicatorMetrics,
  computeSwipeTravel,
  SWIPE_ARM_THRESHOLD_PX,
  SWIPE_DISARM_THRESHOLD_PX,
  SWIPE_MAX_TRAVEL_PX,
  stepSwipeSpring,
  updateArmedState,
} from "../src/features/messages/lib/swipeToReply.ts";
import type { Message } from "../src/features/messages/types.ts";

const baseMessage = (patch: Partial<Message> = {}): Message => ({
  id: "msg-1",
  sender_id: "other-user",
  chat_id: "chat-1",
  channel_id: null,
  type: "text",
  content: "Hello there",
  created_at: "2026-11-20T12:00:00Z",
  deleted_at: null,
  deleted_for_everyone: false,
  edited_at: null,
  is_pinned_in_chat: false,
  reply_to_message_id: null,
  reply_to_story_id: null,
  file_upload_id: null,
  media_thumbnail_upload_id: null,
  media_peaks: null,
  forwarded_from_message_id: null,
  mentions: null,
  location_data: null,
  contact_data: null,
  reactions: [],
  receipts: [],
  unreadForMe: false,
  ...patch,
});

test("classifySwipeIntent resolves horizontal lock, vertical yield, leftward ignore, and dead zone", () => {
  assert.equal(classifySwipeIntent(3, 2), "pending");
  assert.equal(classifySwipeIntent(-14, 1), "ignore-left");
  assert.equal(classifySwipeIntent(4, 14), "yield-vertical");
  assert.equal(classifySwipeIntent(11, 12), "yield-vertical");
  assert.equal(classifySwipeIntent(14, 4), "lock-horizontal");
  assert.equal(classifySwipeIntent(12, -5), "lock-horizontal");
});

test("computeSwipeTravel tracks near 1:1 initially, applies resistance, and stays bounded", () => {
  assert.equal(computeSwipeTravel(-20), 0);
  assert.equal(computeSwipeTravel(0), 0);

  const early = computeSwipeTravel(20);
  const mid = computeSwipeTravel(80);
  const far = computeSwipeTravel(400);
  const extreme = computeSwipeTravel(2000);

  assert.ok(early > 15 && early <= 20, `expected near-1:1 early travel, got ${early}`);
  assert.ok(mid > early && mid < 80, `expected damped mid travel, got ${mid}`);
  assert.ok(far > mid && far < SWIPE_MAX_TRAVEL_PX, `expected bounded far travel, got ${far}`);
  assert.ok(extreme < SWIPE_MAX_TRAVEL_PX, `expected travel < max, got ${extreme}`);
});

test("updateArmedState enforces arm threshold with disarm hysteresis", () => {
  assert.equal(updateArmedState(SWIPE_ARM_THRESHOLD_PX - 1, false), false);
  assert.equal(updateArmedState(SWIPE_ARM_THRESHOLD_PX, false), true);
  assert.equal(updateArmedState(SWIPE_DISARM_THRESHOLD_PX, true), true);
  assert.equal(updateArmedState(SWIPE_DISARM_THRESHOLD_PX - 0.5, true), false);
});

test("computeIndicatorMetrics bounds bubble translation under reduced motion while preserving progress", () => {
  const normal = computeIndicatorMetrics(SWIPE_ARM_THRESHOLD_PX, true, false);
  const reduced = computeIndicatorMetrics(SWIPE_ARM_THRESHOLD_PX, true, true);

  assert.equal(normal.bubbleTranslateX, SWIPE_ARM_THRESHOLD_PX);
  assert.ok(normal.opacity === 1);
  assert.ok(normal.scale > 1);

  assert.ok(
    reduced.bubbleTranslateX < normal.bubbleTranslateX * 0.3,
    `expected subtle reduced-motion translate, got ${reduced.bubbleTranslateX}`,
  );
  assert.equal(reduced.opacity, 1);
  assert.equal(reduced.scale, 1);
});

test("stepSwipeSpring returns cleanly to rest without NaN or infinite loops", () => {
  let pos = 64;
  let vel = 240;
  let settled = false;
  for (let i = 0; i < 180; i++) {
    const next = stepSwipeSpring(pos, vel, 1 / 60);
    pos = next.pos;
    vel = next.vel;
    assert.ok(Number.isFinite(pos) && Number.isFinite(vel));
    if (next.settled) {
      settled = true;
      break;
    }
  }
  assert.equal(settled, true);
  assert.equal(pos, 0);
  assert.equal(vel, 0);
});

test("canSwipeReplyToMessage supports all replyable types and blocks restricted/system/deleted", () => {
  const replyableTypes = [
    "text",
    "image",
    "video",
    "audio",
    "file",
    "sticker",
    "location",
    "contact",
  ] as const;
  for (const type of replyableTypes) {
    assert.equal(canSwipeReplyToMessage(baseMessage({ type }), "me", false, false), true);
    assert.equal(
      canSwipeReplyToMessage(baseMessage({ type, sender_id: "me" }), "me", false, false),
      true,
    );
  }

  assert.equal(canSwipeReplyToMessage(baseMessage({ type: "system" }), "me", false, false), false);
  assert.equal(
    canSwipeReplyToMessage(baseMessage({ deleted_for_everyone: true }), "me", false, false),
    false,
  );
  assert.equal(
    canSwipeReplyToMessage(baseMessage({ localStatus: "pending" }), "me", false, false),
    false,
  );
  assert.equal(
    canSwipeReplyToMessage(baseMessage({ localStatus: "failed" }), "me", false, false),
    false,
  );
  assert.equal(
    canSwipeReplyToMessage(baseMessage({ channel_id: "chan-1" }), "me", false, false),
    false,
  );
  assert.equal(canSwipeReplyToMessage(baseMessage(), "me", true, false), false);
  assert.equal(canSwipeReplyToMessage(baseMessage(), "me", false, true), false);
});
