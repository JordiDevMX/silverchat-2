let storageOutageUntil = 0;

export function markStorageOutage() {
  storageOutageUntil = Date.now() + 60_000;
}

export function isStorageOutage(): boolean {
  return Date.now() < storageOutageUntil;
}

export function getStorageErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  if (typeof status === "number") return status;
  if (typeof statusCode === "number") return statusCode;
  if (typeof statusCode === "string") {
    const parsed = Number.parseInt(statusCode, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}
