import assert from "node:assert/strict";
import test from "node:test";
import {
  type DeviceAlertState,
  type DeviceRecord,
  dismissDeviceAlert,
  dismissReenrollmentBanner,
  findNewDeviceAlert,
  readDeviceAlertState,
  shouldShowReenrollmentBanner,
  syncReenrollmentDismissal,
  writeDeviceAlertState,
} from "../src/lib/security-banners.ts";

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.get(key) ?? null;
    },
    key(index) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

const fpCurrent = "11111111-1111-4111-8111-111111111111";
const fpOther = "22222222-2222-4222-8222-222222222222";

test("first initialization sets baseline without alerting for pre-existing devices", () => {
  const devices: DeviceRecord[] = [
    {
      id: "dev-old",
      device_name: "Old Mac",
      device_fingerprint: fpOther,
      created_at: "2026-11-18T10:00:00.000Z",
    },
    {
      id: "dev-current",
      device_name: "Windows PC",
      device_fingerprint: fpCurrent,
      created_at: "2026-11-19T09:00:00.000Z",
    },
  ];
  const result = findNewDeviceAlert(devices, fpCurrent, null, "2026-11-19T10:00:00.000Z");
  assert.equal(result.alertDevice, null);
  assert.equal(result.nextState.baselineAt, "2026-11-19T09:00:00.000Z");
  assert.deepEqual(result.nextState.dismissedIds, []);
});

test("first initialization uses newest historical device when current device is older", () => {
  const devices: DeviceRecord[] = [
    {
      id: "dev-older-current",
      device_name: "Windows PC",
      device_fingerprint: fpCurrent,
      created_at: "2026-11-01T09:00:00.000Z",
    },
    {
      id: "dev-newer-historical",
      device_name: "Mac",
      device_fingerprint: fpOther,
      created_at: "2026-11-10T12:00:00.000Z",
    },
  ];
  const init = findNewDeviceAlert(devices, fpCurrent, null, "2026-11-19T10:00:00.000Z");
  assert.equal(init.alertDevice, null);
  assert.equal(init.nextState.baselineAt, "2026-11-10T12:00:00.000Z");

  const next = findNewDeviceAlert(devices, fpCurrent, init.nextState, "2026-11-19T10:01:00.000Z");
  assert.equal(next.alertDevice, null);
});

test("returns newest other device created after baseline", () => {
  const state: DeviceAlertState = {
    baselineAt: "2026-11-19T09:00:00.000Z",
    dismissedIds: [],
  };
  const devices: DeviceRecord[] = [
    {
      id: "dev-newer",
      device_name: "iOS Device",
      device_fingerprint: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-11-19T12:00:00.000Z",
    },
    {
      id: "dev-other",
      device_name: "Mac",
      device_fingerprint: fpOther,
      created_at: "2026-11-19T11:00:00.000Z",
    },
  ];
  const result = findNewDeviceAlert(devices, fpCurrent, state, "2026-11-19T12:05:00.000Z");
  assert.equal(result.alertDevice?.id, "dev-newer");
});

test("never alerts for current device fingerprint even if created after baseline", () => {
  const state: DeviceAlertState = {
    baselineAt: "2026-11-19T09:00:00.000Z",
    dismissedIds: [],
  };
  const devices: DeviceRecord[] = [
    {
      id: "dev-self",
      device_name: "Windows PC",
      device_fingerprint: fpCurrent,
      created_at: "2026-11-19T10:00:00.000Z",
    },
  ];
  const result = findNewDeviceAlert(devices, fpCurrent, state, "2026-11-19T10:05:00.000Z");
  assert.equal(result.alertDevice, null);
});

test("dismissDeviceAlert hides dismissed device on subsequent checks", () => {
  const initialState: DeviceAlertState = {
    baselineAt: "2026-11-19T09:00:00.000Z",
    dismissedIds: [],
  };
  const intruder: DeviceRecord = {
    id: "dev-intruder",
    device_name: "Linux",
    device_fingerprint: fpOther,
    created_at: "2026-11-19T11:00:00.000Z",
  };
  const updated = dismissDeviceAlert(initialState, intruder);
  assert.ok(updated.dismissedIds.includes("dev-intruder"));
  assert.equal(updated.baselineAt, "2026-11-19T11:00:00.000Z");

  const next = findNewDeviceAlert([intruder], fpCurrent, updated, "2026-11-19T11:05:00.000Z");
  assert.equal(next.alertDevice, null);
});

test("readDeviceAlertState handles corrupt JSON, invalid dates, and throwing storage safely", () => {
  const corrupt = createMemoryStorage({
    "silverchat:device_alert_seen:u1": "{bad json",
    "silverchat:device_alert_seen:u2": JSON.stringify({ baselineAt: "", dismissedIds: [] }),
    "silverchat:device_alert_seen:u3": JSON.stringify({
      baselineAt: "not-a-date",
      dismissedIds: [],
    }),
  });
  assert.equal(readDeviceAlertState(corrupt, "u1"), null);
  assert.equal(readDeviceAlertState(corrupt, "u2"), null);
  assert.equal(readDeviceAlertState(corrupt, "u3"), null);

  const throwing = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  } as unknown as Storage;
  assert.equal(readDeviceAlertState(throwing, "u1"), null);
  assert.doesNotThrow(() =>
    writeDeviceAlertState(throwing, "u1", { baselineAt: "2026-11-19T00:00:00Z", dismissedIds: [] }),
  );
});

test("2FA reenrollment banner stays dismissed across reloads and re-arms after recovery clears", () => {
  const storage = createMemoryStorage();
  const pending = { userId: "u1", requiresReenrollment: true, hasVerifiedFactor: false };
  assert.equal(shouldShowReenrollmentBanner(pending, storage), true);

  dismissReenrollmentBanner("u1", storage);
  assert.equal(shouldShowReenrollmentBanner(pending, storage), false);

  const reenrolled = { userId: "u1", requiresReenrollment: false, hasVerifiedFactor: true };
  syncReenrollmentDismissal(reenrolled, storage);

  assert.equal(shouldShowReenrollmentBanner(pending, storage), true);
  assert.equal(shouldShowReenrollmentBanner(pending, null), true);
});
