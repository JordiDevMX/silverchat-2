import { useAuth } from "@/lib/auth-provider";
import { useMessageText } from "../i18n";
import type { Member, Message } from "../types";
import { useMessageActionUI } from "./MessageActionsProvider";
export function ReactionsDisplay({ message, members }: { message: Message; members: Member[] }) {
  const { user } = useAuth();
  const { say } = useMessageText();
  const ui = useMessageActionUI();
  const groups = new Map<string, Message["reactions"]>();
  for (const reaction of message.reactions)
    groups.set(reaction.emoji, [...(groups.get(reaction.emoji) ?? []), reaction]);
  return (
    <div className="message-reactions">
      {[...groups].map(([emoji, rows]) => {
        const names =
          rows
            .slice(0, 5)
            .map((row) =>
              row.user_id === user?.id
                ? say("You", "Tú")
                : (members.find((m) => m.user_id === row.user_id)?.profile?.display_name ??
                  say("Member", "Miembro")),
            )
            .join(", ") + (rows.length > 5 ? ` +${rows.length - 5}` : "");
        return (
          <button
            type="button"
            key={emoji}
            aria-pressed={rows.some((r) => r.user_id === user?.id)}
            aria-label={`${emoji} ${rows.length}: ${names}`}
            title={names}
            disabled={ui.busy || ui.readOnly}
            onClick={() => ui.react(message, emoji)}
          >
            {emoji} {rows.length}
          </button>
        );
      })}
      {!ui.readOnly && (
        <button
          type="button"
          aria-label={say("Add reaction", "Añadir reacción")}
          disabled={ui.busy}
          onClick={() => ui.openReactions(message)}
        >
          +
        </button>
      )}
    </div>
  );
}
