import type { Message } from "../../types";
export function SystemMessage({ message }: { message: Message }) {
  return <p className="message-system">{message.content}</p>;
}
