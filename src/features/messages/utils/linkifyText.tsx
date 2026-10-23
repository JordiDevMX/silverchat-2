import Linkify from "linkify-react";
import type { Member } from "../types";
export function LinkifiedText({
  text,
  mentions,
  members,
}: {
  text: string;
  mentions: string[] | null;
  members: Member[];
}) {
  const usernames = new Set(
    members
      .filter((m) => mentions?.includes(m.user_id))
      .map((m) => m.profile?.username?.toLowerCase()),
  );
  return (
    <Linkify
      options={{
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        defaultProtocol: "https",
        validate: { url: (value: string) => !/^javascript:|^data:/i.test(value) },
      }}
    >
      {text.split(/((?:^|\s)@[a-zA-Z0-9_]+)/g).map((part, index) =>
        usernames.has(part.trim().slice(1).toLowerCase()) && part.trim().startsWith("@") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: Stateless text fragments have no identity beyond their position in this immutable message.
          <strong className="message-mention" key={`${index}-${part}`}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </Linkify>
  );
}
