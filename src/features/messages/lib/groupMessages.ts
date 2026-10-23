import type { MessageRow } from "../types.ts";
export function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}
export function grouped(a: MessageRow | undefined, b: MessageRow | undefined) {
  return (
    !!a &&
    !!b &&
    a.type !== "system" &&
    b.type !== "system" &&
    a.sender_id === b.sender_id &&
    sameDay(a.created_at, b.created_at) &&
    Math.abs(Date.parse(b.created_at) - Date.parse(a.created_at)) <= 300000
  );
}
export function groupMessages<T extends MessageRow>(messages: T[]) {
  return messages.map((message, i) => ({
    message,
    groupedBefore: grouped(messages[i - 1], message),
    groupedAfter: grouped(message, messages[i + 1]),
    newDay:
      !messages[i - 1] ||
      !sameDay(messages[i - 1]?.created_at ?? message.created_at, message.created_at),
  }));
}
