import type { Message } from "../types";
export function ReactionsDisplay({ reactions }: { reactions: Message["reactions"] }) {
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  return (
    <div className="message-reactions">
      {[...counts].map(([emoji, count]) => (
        <span key={emoji}>
          {emoji} {count}
        </span>
      ))}
    </div>
  );
}
