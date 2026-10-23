import { useEffect, useState } from "react";
import { useMessageText } from "@/features/messages/i18n";
import { useCreateStory } from "../../hooks/stories/useCreateStory";
import { STORY_COLORS } from "../../lib/storyColors";
export function StoryTextEditor({
  onClose,
  onSaved,
  onBusyChange,
}: {
  onClose: () => void;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { say } = useMessageText();
  const [color, setColor] = useState(STORY_COLORS[0]);
  const [text, setText] = useState("");
  const create = useCreateStory();
  const [attempted, setAttempted] = useState(false);
  useEffect(() => {
    onBusyChange(create.isPending);
    return () => onBusyChange(false);
  }, [create.isPending, onBusyChange]);
  return (
    <div className="story-text-editor" style={{ background: color }}>
      <textarea
        autoComplete="off"
        disabled={attempted}
        aria-label={say("Story text", "Texto de historia")}
        value={text}
        maxLength={200}
        onChange={(e) => setText(e.target.value)}
        placeholder={say("What’s on your mind?", "¿Qué estás pensando?")}
      />
      <small>{text.length}/200</small>
      <div className="story-colors">
        {STORY_COLORS.map((c, i) => (
          <button
            key={c}
            disabled={attempted}
            type="button"
            aria-label={say(`Background ${i + 1}`, `Fondo ${i + 1}`)}
            aria-pressed={color === c}
            style={{ background: c }}
            onClick={() => setColor(c)}
          />
        ))}
        <input
          type="color"
          disabled={attempted}
          aria-label={say("Custom background", "Fondo personalizado")}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      {create.isError && <p role="alert">{create.error.message}</p>}
      <div className="modal-actions">
        <button
          type="button"
          className="button secondary"
          disabled={create.isPending}
          onClick={onClose}
        >
          {say("Discard", "Descartar")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={create.isPending || !text.trim()}
          onClick={() => {
            setAttempted(true);
            create.mutate(
              { p_media_type: "text", p_text_content: text, p_background_color: color },
              { onSuccess: onSaved },
            );
          }}
        >
          {say("Send story", "Enviar historia")}
        </button>
      </div>
    </div>
  );
}
