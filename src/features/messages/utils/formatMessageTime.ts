export const formatMessageTime = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
export function dateLabel(iso: string, locale: string, now = new Date()) {
  const day = new Date(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day.toDateString() === now.toDateString()) return locale === "es" ? "Hoy" : "Today";
  if (day.toDateString() === yesterday.toDateString())
    return locale === "es" ? "Ayer" : "Yesterday";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(
    day,
  );
}
export function formatBytes(bytes: number, locale: string) {
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(3, Math.max(0, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024))));
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 ** index)} ${units[index]}`;
}
