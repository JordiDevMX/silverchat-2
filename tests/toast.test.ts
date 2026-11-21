import assert from "node:assert/strict";
import test from "node:test";
import { useChatUIStore } from "../src/features/chat-settings/stores/uiStore.ts";
import { reactionNotificationStore } from "../src/features/chats/utils/reactionNotifications.ts";
import {
  createToastStore,
  TOAST_DURATION_MS,
  TOAST_EXIT_MS,
  toastStore,
} from "../src/lib/toast-store.ts";

test("auto-dismisses a toast after exactly 2 seconds and removes it after exit", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const store = createToastStore({
    prefersReducedMotion: () => false,
  });

  assert.equal(TOAST_DURATION_MS, 2000);

  const id = store.getState().success("Added 1 members");
  assert.equal(store.getState().toasts.length, 1);
  assert.equal(store.getState().toasts[0]?.id, id);
  assert.equal(store.getState().toasts[0]?.state, "open");

  // Still open right before 2000ms
  t.mock.timers.tick(1999);
  assert.equal(store.getState().toasts.length, 1);
  assert.equal(store.getState().toasts[0]?.state, "open");

  // Transitions to closing at exactly 2000ms
  t.mock.timers.tick(1);
  assert.equal(store.getState().toasts.length, 1);
  assert.equal(store.getState().toasts[0]?.state, "closing");

  // Removed after exit duration
  t.mock.timers.tick(TOAST_EXIT_MS);
  assert.equal(store.getState().toasts.length, 0);
});

test("re-triggering the same toast id resets the 2s timer without stacking", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const store = createToastStore({
    prefersReducedMotion: () => true,
  });

  store.getState().info("First", { id: "shared-toast" });
  t.mock.timers.tick(1500);
  assert.equal(store.getState().toasts.length, 1);

  // Re-trigger at 1500ms: old timer must be cleared so it does not close at 2000ms
  store.getState().info("Updated", { id: "shared-toast" });
  assert.equal(store.getState().toasts.length, 1);
  assert.equal(store.getState().toasts[0]?.message, "Updated");
  assert.equal(store.getState().toasts[0]?.triggerCount, 2);

  t.mock.timers.tick(1000); // 2500ms total, 1000ms since re-trigger
  assert.equal(store.getState().toasts.length, 1);
  assert.equal(store.getState().toasts[0]?.message, "Updated");

  t.mock.timers.tick(1000); // 2000ms since re-trigger
  assert.equal(store.getState().toasts.length, 0);
});

test("supports stacking up to maxVisible and queueing overflow until earlier toasts dismiss", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const store = createToastStore({
    maxVisible: 2,
    prefersReducedMotion: () => true,
  });

  store.getState().info("Toast 1");
  store.getState().info("Toast 2");
  store.getState().info("Toast 3");

  assert.deepEqual(
    store.getState().toasts.map((item) => item.message),
    ["Toast 1", "Toast 2"],
  );
  assert.deepEqual(
    store.getState().queue.map((item) => item.message),
    ["Toast 3"],
  );

  // After 2000ms Toast 1 and Toast 2 expire and Toast 3 is promoted with a fresh 2s timer
  t.mock.timers.tick(2000);
  assert.deepEqual(
    store.getState().toasts.map((item) => item.message),
    ["Toast 3"],
  );
  assert.equal(store.getState().queue.length, 0);

  t.mock.timers.tick(1999);
  assert.equal(store.getState().toasts.length, 1);
  t.mock.timers.tick(1);
  assert.equal(store.getState().toasts.length, 0);
});

test("pauses auto-dismiss while focused and resumes remaining duration on blur", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const store = createToastStore({
    prefersReducedMotion: () => true,
  });

  const id = store.getState().info("Focus-safe toast");
  t.mock.timers.tick(1200);
  store.getState().pause(id);

  // Even after 5 seconds paused, toast remains open
  t.mock.timers.tick(5000);
  assert.equal(store.getState().toasts.length, 1);

  // Resume with remaining 800ms
  store.getState().resume(id);
  t.mock.timers.tick(799);
  assert.equal(store.getState().toasts.length, 1);
  t.mock.timers.tick(1);
  assert.equal(store.getState().toasts.length, 0);
});

test("clear cancels all timers cleanly and prevents late callbacks", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const store = createToastStore({
    prefersReducedMotion: () => false,
  });
  let dismissed = 0;

  store.getState().info("A", { onDismiss: () => dismissed++ });
  store.getState().info("B", { onDismiss: () => dismissed++ });
  store.getState().clear();

  assert.equal(store.getState().toasts.length, 0);
  t.mock.timers.tick(5000);
  assert.equal(dismissed, 0);
});

test("useChatUIStore.notify bridges to toastStore, updates reactions in place, and clears on empty notify", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  toastStore.getState().clear();
  reactionNotificationStore.getState().reset();

  reactionNotificationStore.getState().setActiveToast("chat-1", "msg-1");
  useChatUIStore.getState().notify("Sofia reacted 👍", {
    kind: "reaction",
    href: "/chats/chat-1?scrollTo=msg-1",
    chatId: "chat-1",
    messageId: "msg-1",
  });

  assert.equal(toastStore.getState().toasts.length, 1);
  assert.equal(toastStore.getState().toasts[0]?.message, "Sofia reacted 👍");

  // Aggregated reaction update replaces in-place
  useChatUIStore.getState().notify("Leo and Sofia reacted ❤️", {
    kind: "reaction",
    href: "/chats/chat-1?scrollTo=msg-1",
    chatId: "chat-1",
    messageId: "msg-1",
  });

  assert.equal(toastStore.getState().toasts.length, 1);
  assert.equal(toastStore.getState().toasts[0]?.message, "Leo and Sofia reacted ❤️");

  // Empty notify dismisses immediately
  useChatUIStore.getState().notify("");
  assert.equal(toastStore.getState().toasts.length, 0);
  assert.equal(useChatUIStore.getState().notice, "");

  // Re-trigger and verify 2s auto-dismiss clears reaction activeToast and uiStore notice
  reactionNotificationStore.getState().setActiveToast("chat-1", "msg-1");
  useChatUIStore.getState().notify("Added 1 members", null, { tone: "success" });
  t.mock.timers.tick(TOAST_DURATION_MS);
  t.mock.timers.tick(TOAST_EXIT_MS);
  assert.equal(toastStore.getState().toasts.length, 0);
  assert.equal(useChatUIStore.getState().notice, "");

  toastStore.getState().clear();
  reactionNotificationStore.getState().reset();
});
