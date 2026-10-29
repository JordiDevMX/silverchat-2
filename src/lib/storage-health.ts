let storageOutageUntil = 0;

const retainedImages = new Map<string, HTMLImageElement>();

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

export function retainImageInMemory(url: string) {
  if (typeof Image === "undefined" || retainedImages.has(url)) return;
  if (retainedImages.size >= 50) {
    const oldest = retainedImages.keys().next().value;
    if (oldest) retainedImages.delete(oldest);
  }
  const img = new Image();
  img.src = url;
  retainedImages.set(url, img);
}
