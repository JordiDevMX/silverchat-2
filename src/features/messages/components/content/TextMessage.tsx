import type { Member, Message } from "../../types";
import { LinkifiedText } from "../../utils/linkifyText";
export function TextMessage({ message, members }: { message: Message; members: Member[] }) {
  return (
    <p className="message-text">
      <LinkifiedText text={message.content ?? ""} mentions={message.mentions} members={members} />
    </p>
  );
}
