const STORAGE_KEY = "silverchat_device_id";
export function getOrCreateDeviceFingerprint(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (
      stored &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(stored)
    )
      return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/i.test(ua)) return "iOS Device";
  if (/Android/i.test(ua)) return "Android Device";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Web Browser";
}
