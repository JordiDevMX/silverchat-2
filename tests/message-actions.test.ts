import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableActions } from "../src/features/messages/lib/actionMatrix.ts";
import { audioExtension, audioMimeType } from "../src/features/messages/lib/audioMimeType.ts";
import {
  computePeaks,
  formatVoiceTime,
  recordingLimitMs,
} from "../src/features/messages/lib/voicePeaks.ts";
import { useAudioStore } from "../src/features/messages/stores/audioStore.ts";
import type { Message } from "../src/features/messages/types.ts";

const now = Date.parse("2026-10-23T12:00:00Z");
const row = (patch: Partial<Message> = {}): Message => ({
  id: "message",
  sender_id: "me",
  chat_id: "chat",
  channel_id: null,
  type: "text",
  content: "hello",
  created_at: new Date(now).toISOString(),
  deleted_at: null,
  deleted_for_everyone: false,
  edited_at: null,
  is_pinned_in_chat: false,
  reply_to_message_id: null,
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
test("action matrix enforces ownership, strict time boundaries and content types", () => {
  const actions = (patch: Partial<Message> = {}) =>
    getAvailableActions(row(patch), "me", false, now);
  assert.ok(actions().includes("edit"));
  assert.ok(actions().includes("delete_for_everyone"));
  assert.ok(actions({ created_at: new Date(now - 899999).toISOString() }).includes("edit"));
  assert.ok(!actions({ created_at: new Date(now - 900000).toISOString() }).includes("edit"));
  assert.ok(
    !actions({ created_at: new Date(now - 3600000).toISOString() }).includes("delete_for_everyone"),
  );
  assert.ok(!actions({ sender_id: "other" }).includes("edit"));
  assert.ok(!actions({ sender_id: "other" }).includes("delete_for_everyone"));
  for (const type of ["audio", "file", "contact", "location", "sticker"] as const)
    assert.ok(!actions({ type }).includes("edit"));
  assert.ok(actions({ type: "image" }).includes("edit"));
  assert.ok(actions({ type: "video" }).includes("edit"));
  assert.ok(!actions({ type: "image" }).includes("copy"));
  assert.ok(actions({ type: "file" }).includes("copy"));
  assert.deepEqual(actions({ deleted_for_everyone: true }), ["delete_for_me"]);
  assert.deepEqual(actions({ type: "system" }), []);
  assert.deepEqual(actions({ localStatus: "pending" }), []);
  assert.deepEqual(actions({ localStatus: "failed" }), []);
  assert.deepEqual(getAvailableActions(row(), "me", true, now), ["copy"]);
  assert.ok(actions({ is_pinned_in_chat: true }).includes("unpin"));
});
test("waveform includes all channels and trailing samples; short/silent data stays finite", () => {
  const left = new Float32Array(81),
    right = new Float32Array(81);
  right[80] = 0.83;
  const peaks = computePeaks({
    length: 81,
    numberOfChannels: 2,
    getChannelData: (i) => (i === 0 ? left : right),
  });
  assert.equal(peaks.length, 40);
  assert.equal(peaks.at(-1), 83);
  assert.equal(peaks[0], 0);
  const tiny = computePeaks({
    length: 2,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array([NaN, 2]),
  });
  assert.equal(tiny.length, 40);
  assert.equal(tiny.at(-1), 100);
  assert.ok(tiny.every((n) => Number.isInteger(n) && n >= 0 && n <= 100));
  assert.deepEqual(
    computePeaks({ length: 0, numberOfChannels: 1, getChannelData: () => new Float32Array() }),
    Array(40).fill(0),
  );
  assert.throws(() =>
    computePeaks({ length: 0, numberOfChannels: 0, getChannelData: () => new Float32Array() }, 0),
  );
});
test("recording MIME selection prefers Opus, falls back to MP4, and uses correct extension", () => {
  assert.equal(
    audioMimeType(() => true),
    "audio/webm;codecs=opus",
  );
  assert.equal(
    audioMimeType((m) => m === "audio/mp4"),
    "audio/mp4",
  );
  assert.equal(
    audioMimeType(() => false),
    null,
  );
  assert.equal(audioExtension("audio/mp4"), "m4a");
  assert.equal(audioExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(recordingLimitMs, 300000);
  assert.match(formatVoiceTime(125, "en"), /02:05/);
});
test("exclusive playback handles toggle, unmount, rejected play, and late play promises", async () => {
  const fake = () =>
    ({
      paused: true,
      currentTime: 12,
      pause() {
        Object.assign(this, { paused: true });
      },
      async play() {
        Object.assign(this, { paused: false });
      },
    }) as HTMLAudioElement;
  const a = fake(),
    b = fake();
  const store = () => useAudioStore.getState();
  await store().play("a", a);
  assert.equal(a.paused, false);
  await store().play("b", b);
  assert.equal(a.paused, true);
  assert.equal(a.currentTime, 0);
  store().stop("a");
  assert.equal(store().currentId, "b");
  await store().play("b", b);
  assert.equal(b.paused, true);
  await store().play("b", b);
  assert.equal(b.paused, false);
  store().stop();
  assert.equal(store().currentId, null);
  assert.equal(b.currentTime, 0);
  const bad = fake();
  bad.play = async () => {
    throw new Error("autoplay denied");
  };
  await assert.rejects(store().play("bad", bad));
  assert.equal(store().currentId, null);
  let finish!: () => void;
  const delayed = fake();
  delayed.play = () =>
    new Promise<void>((resolve) => {
      finish = () => {
        Object.assign(delayed, { paused: false });
        resolve();
      };
    });
  const pending = store().play("late", delayed);
  await store().play("b", b);
  finish();
  await pending;
  assert.equal(delayed.paused, true);
  assert.equal(store().currentId, "b");
  store().stop();
});
