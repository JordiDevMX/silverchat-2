export function readPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const value = localStorage.getItem(`silverchat_${key}`);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}
export function hasPreference(key: string) {
  try {
    return localStorage.getItem(`silverchat_${key}`) !== null;
  } catch {
    return false;
  }
}
export function writePreference(key: string, value: string) {
  try {
    localStorage.setItem(`silverchat_${key}`, value);
  } catch {
    /* Server persistence still works. */
  }
}
