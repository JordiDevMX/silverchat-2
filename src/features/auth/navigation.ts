export function safeRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    [...value].some((character) => character.charCodeAt(0) <= 32) ||
    value.includes("\\")
  )
    return "/chats";
  const url = new URL(value, "https://silverchat.invalid");
  if (
    url.origin !== "https://silverchat.invalid" ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api")
  )
    return "/chats";
  return `${url.pathname}${url.search}${url.hash}`;
}
export function searchParams() {
  return new URLSearchParams(window.location.search);
}
export function nextDestination(username: string | undefined, redirect: string): string {
  return !username || /^user_[a-f0-9]{8}$/.test(username)
    ? `/onboarding/pick-username?${new URLSearchParams({ redirect: safeRedirect(redirect) })}`
    : safeRedirect(redirect);
}
