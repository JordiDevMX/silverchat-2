export type DismissalStorage = Pick<Storage, "getItem" | "setItem">;

export function growthDismissalKey(userId: string, type: string, chatId: string): string {
  return `silverchat:growth-dismissed:${userId}:${type}:${chatId}`;
}

export function readGrowthDismissed(
  storage: DismissalStorage | undefined,
  userId: string,
  type: string,
  chatId: string,
): boolean {
  if (!storage || !userId || !chatId) return false;
  try {
    return storage.getItem(growthDismissalKey(userId, type, chatId)) === "1";
  } catch {
    return false;
  }
}

export function writeGrowthDismissed(
  storage: DismissalStorage | undefined,
  userId: string,
  type: string,
  chatId: string,
): void {
  if (!storage || !userId || !chatId) return;
  try {
    storage.setItem(growthDismissalKey(userId, type, chatId), "1");
  } catch {
    /* Storage quota or privacy mode must never block dismissal. */
  }
}
