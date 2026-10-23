import { useEffect, useMemo, useState } from "react";
import type { Message } from "../types";
export function useInChatSearch(messages: Message[]) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim().toLocaleLowerCase());
      setSelected(null);
    }, 150);
    return () => clearTimeout(timer);
  }, [text]);
  const results = useMemo(
    () =>
      query
        ? messages.filter(
            (m) => !m.deleted_for_everyone && m.content?.toLocaleLowerCase().includes(query),
          )
        : [],
    [messages, query],
  );
  const index = Math.max(
    0,
    results.findIndex((m) => m.id === selected),
  );
  const move = (direction: number) => {
    const next = results[(index + direction + results.length) % results.length];
    if (next) setSelected(next.id);
    return next?.id;
  };
  return { text, setText, results, index, current: results[index]?.id, move };
}
