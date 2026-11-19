import { SystemPill } from "@/components/ui/conversation-surface";
import type { Message } from "../../types";

export function SystemMessage({ message }: { message: Message }) {
  return <SystemPill className="message-system">{message.content}</SystemPill>;
}
