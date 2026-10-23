import { useState } from "react";
import type { Member } from "../types";
export function mentionIds(text: string, members: Member[]) {
  const names = new Set(
    [...text.matchAll(/(?:^|\s)@([a-zA-Z0-9_]+)/g)].map((m) => m[1]?.toLowerCase()),
  );
  return members
    .filter((m) => m.profile?.username && names.has(m.profile.username.toLowerCase()))
    .map((m) => m.user_id);
}
export function useMentions(text: string, caret: number, members: Member[], enabled: boolean) {
  const [dismissed, setDismissed] = useState<string>();
  const [index, setIndex] = useState(0);
  const match = enabled ? text.slice(0, caret).match(/(?:^|\s)@([a-zA-Z0-9_]*)$/) : null;
  const term = match?.[1]?.toLowerCase();
  const token = `${caret}:${text}`;
  const options =
    term !== undefined && dismissed !== token
      ? members
          .filter(
            (m) =>
              m.profile?.username &&
              (m.profile.username.toLowerCase().includes(term) ||
                m.profile.display_name?.toLowerCase().includes(term)),
          )
          .slice(0, 8)
      : [];
  const choose = (member: Member) => {
    const start = caret - (term?.length ?? 0) - 1;
    const insert = `@${member.profile?.username ?? ""} `;
    return {
      text: text.slice(0, start) + insert + text.slice(caret),
      caret: start + insert.length,
    };
  };
  return {
    options,
    index: Math.min(index, options.length - 1),
    move: (offset: number) => setIndex((i) => (i + offset + options.length) % options.length),
    dismiss: () => setDismissed(token),
    choose,
  };
}
