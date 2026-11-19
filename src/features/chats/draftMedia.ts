export interface DraftMediaEntry {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
}

interface DraftMediaRecord {
  key: string;
  ownerId: string;
  chatId: string;
  updatedAt: number;
  items: DraftMediaEntry[];
}

export interface DraftMediaFile {
  id: string;
  file: File;
}

const DB_NAME = "silverchat_draft_media";
const STORE_NAME = "draft_media";
const DB_VERSION = 1;
const MAX_AGE_MS = 30 * 86400000;

const memoryStore = new Map<string, { updatedAt: number; items: DraftMediaEntry[] }>();
const writeGenerations = new Map<string, number>();

export function clearMemoryDraftMedia(): void {
  memoryStore.clear();
}

function makeKey(ownerId: string, chatId: string): string {
  return `${ownerId}:${chatId}`;
}

function nextGeneration(key: string): number {
  const next = (writeGenerations.get(key) ?? 0) + 1;
  writeGenerations.set(key, next);
  return next;
}

function openDraftMediaDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function toEntries(items: DraftMediaFile[]): DraftMediaEntry[] {
  return items.map(({ id, file }) => ({
    id,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    blob: file,
  }));
}

function fromEntries(
  entries: DraftMediaEntry[],
  expectedIds?: string[],
): DraftMediaFile[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = expectedIds
    ? expectedIds
        .map((id) => byId.get(id))
        .filter((entry): entry is DraftMediaEntry => Boolean(entry))
    : entries;

  return ordered.map((entry) => ({
    id: entry.id,
    file:
      entry.blob instanceof File &&
      entry.blob.name === entry.name &&
      entry.blob.type === entry.type
        ? entry.blob
        : new File([entry.blob], entry.name, {
            type: entry.type,
            lastModified: entry.lastModified,
          }),
  }));
}

export function readMemoryDraftMedia(
  ownerId: string,
  chatId: string,
  expectedIds?: string[],
): DraftMediaFile[] | null {
  const record = memoryStore.get(makeKey(ownerId, chatId));
  if (!record) return null;
  if (Date.now() - record.updatedAt > MAX_AGE_MS) {
    memoryStore.delete(makeKey(ownerId, chatId));
    return null;
  }
  return fromEntries(record.items, expectedIds);
}

export async function saveDraftMedia(
  ownerId: string,
  chatId: string,
  items: DraftMediaFile[],
): Promise<void> {
  const key = makeKey(ownerId, chatId);
  const gen = nextGeneration(key);
  const now = Date.now();
  const entries = toEntries(items);

  if (entries.length === 0) {
    memoryStore.delete(key);
  } else {
    memoryStore.set(key, { updatedAt: now, items: entries });
  }

  const db = await openDraftMediaDb();
  if (!db) return;
  try {
    if (writeGenerations.get(key) !== gen) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (entries.length === 0) {
        store.delete(key);
      } else {
        const record: DraftMediaRecord = {
          key,
          ownerId,
          chatId,
          updatedAt: now,
          items: entries,
        };
        store.put(record);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* Storage is optional in private/restricted environments. */
  } finally {
    db.close();
  }
}

export async function loadDraftMedia(
  ownerId: string,
  chatId: string,
  expectedIds?: string[],
): Promise<DraftMediaFile[]> {
  if (expectedIds && expectedIds.length === 0) return [];
  const cached = readMemoryDraftMedia(ownerId, chatId, expectedIds);
  if (cached) return cached;

  const key = makeKey(ownerId, chatId);
  const db = await openDraftMediaDb();
  if (!db) return [];
  try {
    const record = await new Promise<DraftMediaRecord | undefined>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as DraftMediaRecord | undefined);
      req.onerror = () => resolve(undefined);
    });
    if (!record || record.ownerId !== ownerId || Date.now() - record.updatedAt > MAX_AGE_MS) {
      return [];
    }
    // Only populate memory cache if nothing newer overwrote it while IDB was reading.
    if (!memoryStore.has(key)) {
      memoryStore.set(key, { updatedAt: record.updatedAt, items: record.items });
    }
    return fromEntries(record.items, expectedIds);
  } catch {
    return [];
  } finally {
    db.close();
  }
}

export async function deleteDraftMediaForChat(chatId: string): Promise<void> {
  const suffix = `:${chatId}`;
  for (const key of memoryStore.keys()) {
    if (key.endsWith(suffix)) {
      nextGeneration(key);
      memoryStore.delete(key);
    }
  }

  const db = await openDraftMediaDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && cursor.key.endsWith(suffix)) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* Optional cleanup. */
  } finally {
    db.close();
  }
}

export async function cleanupExpiredDraftMedia(now = Date.now()): Promise<void> {
  for (const [key, record] of memoryStore.entries()) {
    if (now - record.updatedAt > MAX_AGE_MS) {
      memoryStore.delete(key);
    }
  }

  const db = await openDraftMediaDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const val = cursor.value as DraftMediaRecord | undefined;
        if (!val || !Number.isFinite(val.updatedAt) || now - val.updatedAt > MAX_AGE_MS) {
          cursor.delete();
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* Optional cleanup. */
  } finally {
    db.close();
  }
}
