import type { Message } from "../types.ts";
export type MessageAction =
  | "reply"
  | "react"
  | "copy"
  | "forward"
  | "pin"
  | "unpin"
  | "edit"
  | "delete_for_me"
  | "delete_for_everyone";
export function getAvailableActions(
  message: Message,
  userId: string,
  readOnly = false,
  now = Date.now(),
): MessageAction[] {
  if (message.type === "system" || message.localStatus || message.id.startsWith("temp-")) return [];
  if (readOnly)
    return !message.deleted_for_everyone &&
      ["text", "file"].includes(message.type) &&
      message.content
      ? ["copy"]
      : [];
  if (message.channel_id && message.sender_id !== userId)
    return message.deleted_for_everyone
      ? []
      : [
          "react",
          ...(["text", "file"].includes(message.type) && message.content ? ["copy" as const] : []),
        ];
  if (message.deleted_for_everyone) return ["delete_for_me"];
  const actions: MessageAction[] = ["reply", "react"];
  if (["text", "file"].includes(message.type) && message.content) actions.push("copy");
  actions.push("forward", message.is_pinned_in_chat ? "unpin" : "pin");
  const age = now - Date.parse(message.created_at);
  if (
    message.sender_id === userId &&
    age >= 0 &&
    age < 900000 &&
    ["text", "image", "video"].includes(message.type)
  )
    actions.push("edit");
  actions.push("delete_for_me");
  if (message.sender_id === userId && age >= 0 && age < 3600000)
    actions.push("delete_for_everyone");
  return message.channel_id
    ? actions.filter((a) => !["reply", "pin", "unpin"].includes(a))
    : actions;
}
