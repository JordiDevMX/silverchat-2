export interface DeviceRecord {
  id: string;
  device_name: string;
  device_fingerprint: string | null;
  created_at: string;
}

export interface DeviceAlertState {
  baselineAt: string;
  dismissedIds: string[];
}

export interface ReenrollmentCheck {
  userId: string;
  requiresReenrollment: boolean;
  hasVerifiedFactor: boolean;
}

const MAX_DISMISSED_IDS = 50;
const deviceAlertKey = (userId: string) => `silverchat:device_alert_seen:${userId}`;
const reenrollKey = (userId: string) => `silverchat:2fa_reenroll_dismissed:${userId}`;

function toMs(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function findNewDeviceAlert(
  devices: readonly DeviceRecord[],
  currentFingerprint: string | null,
  state: DeviceAlertState | null,
  nowIso: string,
): { alertDevice: DeviceRecord | null; nextState: DeviceAlertState } {
  if (!state) {
    let newestIso: string | null = null;
    let newestMs = -Infinity;
    for (const device of devices) {
      const ms = Date.parse(device.created_at);
      if (Number.isFinite(ms) && ms > newestMs) {
        newestMs = ms;
        newestIso = device.created_at;
      }
    }
    return {
      alertDevice: null,
      nextState: {
        baselineAt: newestIso ?? nowIso,
        dismissedIds: [],
      },
    };
  }

  const baselineMs = toMs(state.baselineAt);
  const dismissed = new Set(state.dismissedIds);
  const candidates = devices
    .filter((device) => {
      if (currentFingerprint && device.device_fingerprint === currentFingerprint) return false;
      if (dismissed.has(device.id)) return false;
      return toMs(device.created_at) > baselineMs;
    })
    .sort((a, b) => toMs(b.created_at) - toMs(a.created_at));

  return {
    alertDevice: candidates[0] ?? null,
    nextState: state,
  };
}

export function dismissDeviceAlert(
  state: DeviceAlertState,
  device: Pick<DeviceRecord, "id" | "created_at">,
): DeviceAlertState {
  const dismissedIds = [...state.dismissedIds.filter((id) => id !== device.id), device.id].slice(
    -MAX_DISMISSED_IDS,
  );
  const nextBaseline =
    toMs(device.created_at) > toMs(state.baselineAt) ? device.created_at : state.baselineAt;
  return {
    baselineAt: nextBaseline,
    dismissedIds,
  };
}

export function readDeviceAlertState(
  storage: Storage | null,
  userId: string,
): DeviceAlertState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(deviceAlertKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { baselineAt?: unknown }).baselineAt !== "string" ||
      !Array.isArray((parsed as { dismissedIds?: unknown }).dismissedIds)
    ) {
      return null;
    }
    const { baselineAt, dismissedIds } = parsed as {
      baselineAt: string;
      dismissedIds: unknown[];
    };
    if (!Number.isFinite(Date.parse(baselineAt))) return null;
    return {
      baselineAt,
      dismissedIds: dismissedIds.filter((id): id is string => typeof id === "string"),
    };
  } catch {
    return null;
  }
}

export function writeDeviceAlertState(
  storage: Storage | null,
  userId: string,
  state: DeviceAlertState,
): void {
  if (!storage) return;
  try {
    storage.setItem(deviceAlertKey(userId), JSON.stringify(state));
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

export function shouldShowReenrollmentBanner(
  { userId, requiresReenrollment, hasVerifiedFactor }: ReenrollmentCheck,
  storage: Storage | null,
): boolean {
  if (!requiresReenrollment || hasVerifiedFactor) return false;
  if (!storage) return true;
  try {
    return storage.getItem(reenrollKey(userId)) !== "1";
  } catch {
    return true;
  }
}

export function dismissReenrollmentBanner(userId: string, storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.setItem(reenrollKey(userId), "1");
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

export function syncReenrollmentDismissal(
  { userId, requiresReenrollment, hasVerifiedFactor }: ReenrollmentCheck,
  storage: Storage | null,
): void {
  if (!storage || (requiresReenrollment && !hasVerifiedFactor)) return;
  try {
    storage.removeItem(reenrollKey(userId));
  } catch {
    // Ignore storage access errors.
  }
}
