import type { Member, Message } from "../types.ts";
export function messageStatus(
  message: Pick<Message, "id" | "localStatus" | "sender_id" | "created_at" | "receipts">,
  members: Pick<Member, "user_id" | "joined_at">[],
) {
  if (message.localStatus === "failed") return "failed";
  if (message.localStatus === "pending" || message.id.startsWith("temp-")) return "pending";
  const recipients = members.filter(
    (m) =>
      m.user_id !== message.sender_id && Date.parse(m.joined_at) <= Date.parse(message.created_at),
  );
  if (!recipients.length) return "sent";
  const receipts = recipients.map((m) => message.receipts.find((r) => r.user_id === m.user_id));
  if (receipts.every((r) => r?.read_at)) return "read";
  if (receipts.every((r) => r?.delivered_at || r?.read_at)) return "delivered";
  return "sent";
}
