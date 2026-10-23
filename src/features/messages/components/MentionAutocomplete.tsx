import type { Member } from "../types";
export function MentionAutocomplete({
  members,
  index,
  onChoose,
}: {
  members: Member[];
  index: number;
  onChoose: (member: Member) => void;
}) {
  return (
    <div id="mention-options" role="listbox" className="mention-menu" aria-label="Mentions">
      {members.map((m, i) => (
        <button
          type="button"
          role="option"
          aria-selected={i === index}
          id={`mention-${m.user_id}`}
          key={m.user_id}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChoose(m)}
        >
          <strong>{m.profile?.display_name}</strong>
          <small>@{m.profile?.username}</small>
        </button>
      ))}
    </div>
  );
}
